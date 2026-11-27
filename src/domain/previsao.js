/**
 * Previsão de estoque: regras de negócio puras (sem banco de dados e sem HTTP),
 * por isso podem ser testadas isoladamente em tests/previsao.test.js.
 *
 * 1. Sazonalidade: índice do mês = média diária de vendas naquele mês ÷ média diária geral.
 *    1,00 = mês normal; 2,00 = vende o dobro; 0,50 = vende a metade.
 * 2. Consumo-base: média diária das saídas dos últimos 30 dias, "dessazonalizada"
 *    (cada dia é dividido pelo índice do seu mês) para não contar a sazonalidade duas vezes.
 * 3. Previsão: simula o estoque dia a dia, descontando consumo-base × índice do mês de cada dia.
 */
import {
  adicionarDias,
  chaveDoMes,
  diasNoMes,
  diferencaEmDias,
  indiceDoMes,
  listarMeses,
  mesAnterior,
  mesSeguinte,
} from '../../shared/datas.js';
import { classificarTemporada, LIMIARES_DE_TEMPORADA } from '../../shared/temporada.js';

export const PARAMETROS_DA_PREVISAO = Object.freeze({
  janelaDeConsumoEmDias: 30,
  horizonteEmDias: 365,
  diasDeCoberturaDaCompra: 30,
  margemDeSegurancaEmDias: 3,
  mesesParaSazonalidade: 12,
  mesesMaximosNaSazonalidade: 24,
  limiarDeAltaTemporada: LIMIARES_DE_TEMPORADA.alta,
  limiarDeBaixaTemporada: LIMIARES_DE_TEMPORADA.baixa,
  indiceMinimoNaDivisao: 0.1,
  diasNaCurvaDeEstoque: 60,
});

export const SITUACOES = Object.freeze({
  semEstoque: 'sem_estoque',
  critico: 'critico',
  atencao: 'atencao',
  ok: 'ok',
});

const INDICES_NEUTROS = Object.freeze(new Array(12).fill(1));

function arredondar(valor, casas) {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

function media(valores) {
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
}

// ---------------------------------------------------------------------------
// 1. Sazonalidade
// ---------------------------------------------------------------------------

/** Meses completos do histórico: ignora o mês corrente e o primeiro mês se ele começou no meio. */
function listarMesesCompletos(inicioDoHistorico, hoje) {
  if (!inicioDoHistorico) return [];
  const primeiroMes = inicioDoHistorico.endsWith('-01')
    ? chaveDoMes(inicioDoHistorico)
    : mesSeguinte(chaveDoMes(inicioDoHistorico));
  const ultimoMes = mesAnterior(chaveDoMes(hoje));
  return listarMeses(primeiroMes, ultimoMes).slice(-PARAMETROS_DA_PREVISAO.mesesMaximosNaSazonalidade);
}

function calcularMediaDiariaPorMesDoAno(meses, totaisMensais) {
  const somas = new Array(12).fill(0);
  const ocorrencias = new Array(12).fill(0);
  for (const mes of meses) {
    const posicao = Number(mes.slice(5, 7)) - 1;
    somas[posicao] += (totaisMensais[mes] ?? 0) / diasNoMes(mes);
    ocorrencias[posicao] += 1;
  }
  return somas.map((soma, posicao) => soma / ocorrencias[posicao]);
}

/**
 * @param {object} entrada
 * @param {Record<string, number>} entrada.totaisMensais  saídas por mês: { "2026-06": 310, ... }
 * @param {string|null} entrada.inicioDoHistorico         data da primeira movimentação do produto
 * @param {string} entrada.hoje                           data de referência (AAAA-MM-DD)
 */
export function calcularSazonalidade({ totaisMensais, inicioDoHistorico, hoje }) {
  const meses = listarMesesCompletos(inicioDoHistorico, hoje);
  const neutra = { indices: [...INDICES_NEUTROS], confiavel: false, mesesAnalisados: meses.length };
  if (meses.length < PARAMETROS_DA_PREVISAO.mesesParaSazonalidade) return neutra;

  const mediasPorMes = calcularMediaDiariaPorMesDoAno(meses, totaisMensais);
  const mediaGeral = media(mediasPorMes);
  if (mediaGeral === 0) return neutra;

  return {
    indices: mediasPorMes.map((mediaDoMes) => arredondar(mediaDoMes / mediaGeral, 2)),
    confiavel: true,
    mesesAnalisados: meses.length,
  };
}

// ---------------------------------------------------------------------------
// 2. Consumo-base
// ---------------------------------------------------------------------------

/**
 * @param {Record<string, number>} entrada.saidasPorDia  saídas por dia: { "2026-11-09": 12, ... }
 * @param {number[]} entrada.indices                      12 índices sazonais (jan a dez)
 */
export function calcularConsumoDiarioBase({ saidasPorDia, indices, inicioDoHistorico, hoje }) {
  if (!inicioDoHistorico || inicioDoHistorico > hoje) return 0;
  const inicioDaJanela = adicionarDias(hoje, -(PARAMETROS_DA_PREVISAO.janelaDeConsumoEmDias - 1));
  const primeiroDia = inicioDoHistorico > inicioDaJanela ? inicioDoHistorico : inicioDaJanela;
  const diasObservados = diferencaEmDias(primeiroDia, hoje) + 1;

  let somaDessazonalizada = 0;
  for (let deslocamento = 0; deslocamento < diasObservados; deslocamento++) {
    const dia = adicionarDias(primeiroDia, deslocamento);
    const indiceDoDia = Math.max(indices[indiceDoMes(dia)], PARAMETROS_DA_PREVISAO.indiceMinimoNaDivisao);
    somaDessazonalizada += (saidasPorDia[dia] ?? 0) / indiceDoDia;
  }
  return somaDessazonalizada / diasObservados;
}

// ---------------------------------------------------------------------------
// 3. Simulação do estoque futuro
// ---------------------------------------------------------------------------

/** Gera, dia após dia a partir de amanhã, o consumo acumulado e o estoque restante previstos. */
function* simularEstoque({ estoqueAtual, consumoDiarioBase, indices, hoje }) {
  let consumoAcumulado = 0;
  for (let dia = 1; ; dia++) {
    const data = adicionarDias(hoje, dia);
    consumoAcumulado += consumoDiarioBase * indices[indiceDoMes(data)];
    yield { dia, data, consumoAcumulado, estoque: estoqueAtual - consumoAcumulado };
  }
}

export function preverRuptura({ estoqueAtual, consumoDiarioBase, indices, hoje }) {
  if (estoqueAtual <= 0) return { diasAteRuptura: 0, dataDaRuptura: hoje };
  if (consumoDiarioBase <= 0) return { diasAteRuptura: null, dataDaRuptura: null };

  for (const passo of simularEstoque({ estoqueAtual, consumoDiarioBase, indices, hoje })) {
    if (passo.estoque <= 0) return { diasAteRuptura: passo.dia, dataDaRuptura: passo.data };
    if (passo.dia >= PARAMETROS_DA_PREVISAO.horizonteEmDias) break;
  }
  return { diasAteRuptura: null, dataDaRuptura: null };
}

export function estimarConsumo({ consumoDiarioBase, indices, hoje, dias }) {
  if (consumoDiarioBase <= 0 || dias <= 0) return 0;
  for (const passo of simularEstoque({ estoqueAtual: 0, consumoDiarioBase, indices, hoje })) {
    if (passo.dia >= dias) return passo.consumoAcumulado;
  }
  return 0;
}

export function projetarCurvaDeEstoque({
  estoqueAtual,
  consumoDiarioBase,
  indices,
  hoje,
  dias = PARAMETROS_DA_PREVISAO.diasNaCurvaDeEstoque,
}) {
  const pontos = [{ data: hoje, estoque: estoqueAtual }];
  for (const passo of simularEstoque({ estoqueAtual, consumoDiarioBase, indices, hoje })) {
    pontos.push({ data: passo.data, estoque: arredondar(Math.max(0, passo.estoque), 1) });
    if (passo.dia >= dias) break;
  }
  return pontos;
}

// ---------------------------------------------------------------------------
// 4. Decisões: situação do produto e quantidade a comprar
// ---------------------------------------------------------------------------

export function classificarSituacao({ estoqueAtual, estoqueMinimo, diasAteRuptura, prazoEntregaDias }) {
  if (estoqueAtual <= 0) return SITUACOES.semEstoque;
  if (estoqueAtual <= estoqueMinimo) return SITUACOES.critico;
  const limiteDeAtencao = prazoEntregaDias + PARAMETROS_DA_PREVISAO.margemDeSegurancaEmDias;
  if (diasAteRuptura !== null && diasAteRuptura <= limiteDeAtencao) return SITUACOES.atencao;
  return SITUACOES.ok;
}

/** Quanto pedir para cobrir o prazo de entrega + 30 dias e ainda manter o estoque mínimo. */
export function calcularQuantidadeSugerida({ estoqueAtual, estoqueMinimo, consumoDiarioBase, indices, hoje, prazoEntregaDias }) {
  const diasCobertos = prazoEntregaDias + PARAMETROS_DA_PREVISAO.diasDeCoberturaDaCompra;
  const consumoPrevisto = estimarConsumo({ consumoDiarioBase, indices, hoje, dias: diasCobertos });
  const estoqueDesejado = consumoPrevisto > 0 ? estoqueMinimo + consumoPrevisto : Math.max(estoqueMinimo * 2, 1);
  return Math.max(1, Math.ceil(estoqueDesejado - estoqueAtual));
}

/** Reposição automática vale só para quem tem estoque mínimo definido (maior que zero). */
export function precisaDeReposicao({ quantidadeEstoque, estoqueMinimo }) {
  return estoqueMinimo > 0 && quantidadeEstoque <= estoqueMinimo;
}

/**
 * Junta todas as regras acima e monta a previsão completa de um produto.
 * @param {object} entrada.produto    { quantidadeEstoque, estoqueMinimo, prazoEntregaDias }
 * @param {object} entrada.historico  { totaisMensais, saidasPorDia, inicio }
 */
export function montarPrevisao({ produto, historico, hoje }) {
  const sazonalidade = calcularSazonalidade({
    totaisMensais: historico.totaisMensais,
    inicioDoHistorico: historico.inicio,
    hoje,
  });
  const { indices } = sazonalidade;
  const consumoDiarioBase = calcularConsumoDiarioBase({
    saidasPorDia: historico.saidasPorDia,
    indices,
    inicioDoHistorico: historico.inicio,
    hoje,
  });
  const ruptura = preverRuptura({ estoqueAtual: produto.quantidadeEstoque, consumoDiarioBase, indices, hoje });
  const indiceDeHoje = indices[indiceDoMes(hoje)];
  const indiceDoProximoMes = indices[(indiceDoMes(hoje) + 1) % 12];

  return {
    situacao: classificarSituacao({
      estoqueAtual: produto.quantidadeEstoque,
      estoqueMinimo: produto.estoqueMinimo,
      diasAteRuptura: ruptura.diasAteRuptura,
      prazoEntregaDias: produto.prazoEntregaDias,
    }),
    ...ruptura,
    consumoDiarioBase: arredondar(consumoDiarioBase, 2),
    consumoPrevistoHoje: arredondar(consumoDiarioBase * indiceDeHoje, 2),
    quantidadeSugerida: calcularQuantidadeSugerida({
      estoqueAtual: produto.quantidadeEstoque,
      estoqueMinimo: produto.estoqueMinimo,
      consumoDiarioBase,
      indices,
      hoje,
      prazoEntregaDias: produto.prazoEntregaDias,
    }),
    sazonalidade: {
      ...sazonalidade,
      temporadaAtual: sazonalidade.confiavel ? classificarTemporada(indiceDeHoje) : 'normal',
      indiceDoProximoMes,
      temporadaDoProximoMes: sazonalidade.confiavel ? classificarTemporada(indiceDoProximoMes) : 'normal',
    },
  };
}
