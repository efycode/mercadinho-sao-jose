import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularConsumoDiarioBase,
  calcularQuantidadeSugerida,
  calcularSazonalidade,
  classificarSituacao,
  montarPrevisao,
  precisaDeReposicao,
  preverRuptura,
  SITUACOES,
} from '../src/domain/previsao.js';
import { adicionarDias, diasNoMes, listarMeses } from '../shared/datas.js';

const NEUTROS = new Array(12).fill(1);

/** Monta totais mensais em que cada mês vende "média diária × fator do mês". */
function gerarTotaisMensais(primeiroMes, ultimoMes, fatores, mediaDiaria = 10) {
  const totais = {};
  for (const mes of listarMeses(primeiroMes, ultimoMes)) {
    const fator = fatores[Number(mes.slice(5, 7)) - 1];
    totais[mes] = mediaDiaria * fator * diasNoMes(mes);
  }
  return totais;
}

describe('Sazonalidade', () => {
  test('com menos de 12 meses completos, não aplica sazonalidade', () => {
    const resultado = calcularSazonalidade({
      totaisMensais: gerarTotaisMensais('2026-05', '2026-10', NEUTROS),
      inicioDoHistorico: '2026-05-01',
      hoje: '2026-11-10',
    });
    assert.equal(resultado.confiavel, false);
    assert.equal(resultado.mesesAnalisados, 6);
    assert.deepEqual(resultado.indices, NEUTROS);
  });

  test('identifica o pico de dezembro de um produto natalino', () => {
    const fatores = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 4];
    const resultado = calcularSazonalidade({
      totaisMensais: gerarTotaisMensais('2025-01', '2026-10', fatores),
      inicioDoHistorico: '2025-01-01',
      hoje: '2026-11-10',
    });
    const mediaDosFatores = 16 / 12;
    assert.equal(resultado.confiavel, true);
    assert.equal(resultado.indices[11], Math.round((4 / mediaDosFatores) * 100) / 100);
    assert.equal(resultado.indices[0], Math.round((1 / mediaDosFatores) * 100) / 100);
  });

  test('ignora o primeiro mês quando o histórico começa no meio dele', () => {
    const resultado = calcularSazonalidade({
      totaisMensais: gerarTotaisMensais('2025-10', '2026-10', NEUTROS),
      inicioDoHistorico: '2025-10-15',
      hoje: '2026-11-10',
    });
    assert.equal(resultado.mesesAnalisados, 12);
  });
});

describe('Consumo e ruptura', () => {
  const hoje = '2026-11-10';
  const saidasConstantes = (quantidadePorDia) => {
    const saidas = {};
    for (let dia = 0; dia < 30; dia++) saidas[adicionarDias(hoje, -dia)] = quantidadePorDia;
    return saidas;
  };

  test('consumo-base é a média diária dos últimos 30 dias', () => {
    const consumo = calcularConsumoDiarioBase({
      saidasPorDia: saidasConstantes(5),
      indices: NEUTROS,
      inicioDoHistorico: '2025-01-01',
      hoje,
    });
    assert.equal(consumo, 5);
  });

  test('produto novo usa só os dias desde a primeira movimentação', () => {
    const consumo = calcularConsumoDiarioBase({
      saidasPorDia: { [hoje]: 6, [adicionarDias(hoje, -1)]: 6 },
      indices: NEUTROS,
      inicioDoHistorico: adicionarDias(hoje, -1),
      hoje,
    });
    assert.equal(consumo, 6);
  });

  test('com consumo constante, prevê a ruptura no dia exato', () => {
    const ruptura = preverRuptura({ estoqueAtual: 50, consumoDiarioBase: 5, indices: NEUTROS, hoje });
    assert.deepEqual(ruptura, { diasAteRuptura: 10, dataDaRuptura: '2026-11-20' });
  });

  test('alta temporada antecipa a ruptura', () => {
    const indicesComDezembroForte = [...NEUTROS];
    indicesComDezembroForte[11] = 4;
    const semSazonalidade = preverRuptura({ estoqueAtual: 200, consumoDiarioBase: 5, indices: NEUTROS, hoje });
    const comSazonalidade = preverRuptura({ estoqueAtual: 200, consumoDiarioBase: 5, indices: indicesComDezembroForte, hoje });
    assert.ok(comSazonalidade.diasAteRuptura < semSazonalidade.diasAteRuptura);
  });

  test('sem vendas não há previsão; sem estoque a ruptura é hoje', () => {
    assert.deepEqual(preverRuptura({ estoqueAtual: 10, consumoDiarioBase: 0, indices: NEUTROS, hoje }), {
      diasAteRuptura: null,
      dataDaRuptura: null,
    });
    assert.deepEqual(preverRuptura({ estoqueAtual: 0, consumoDiarioBase: 3, indices: NEUTROS, hoje }), {
      diasAteRuptura: 0,
      dataDaRuptura: hoje,
    });
  });
});

describe('Decisões de compra', () => {
  test('quantidade sugerida cobre prazo de entrega + 30 dias e repõe o mínimo', () => {
    const quantidade = calcularQuantidadeSugerida({
      estoqueAtual: 20,
      estoqueMinimo: 20,
      consumoDiarioBase: 2,
      indices: NEUTROS,
      hoje: '2026-11-10',
      prazoEntregaDias: 5,
    });
    assert.equal(quantidade, 20 + 2 * 35 - 20);
  });

  test('classifica a situação do estoque', () => {
    const base = { estoqueMinimo: 10, prazoEntregaDias: 2 };
    assert.equal(classificarSituacao({ ...base, estoqueAtual: 0, diasAteRuptura: 0 }), SITUACOES.semEstoque);
    assert.equal(classificarSituacao({ ...base, estoqueAtual: 10, diasAteRuptura: 4 }), SITUACOES.critico);
    assert.equal(classificarSituacao({ ...base, estoqueAtual: 15, diasAteRuptura: 5 }), SITUACOES.atencao);
    assert.equal(classificarSituacao({ ...base, estoqueAtual: 90, diasAteRuptura: 30 }), SITUACOES.ok);
  });

  test('reposição automática só dispara com estoque mínimo maior que zero', () => {
    assert.equal(precisaDeReposicao({ quantidadeEstoque: 5, estoqueMinimo: 5 }), true);
    assert.equal(precisaDeReposicao({ quantidadeEstoque: 6, estoqueMinimo: 5 }), false);
    assert.equal(precisaDeReposicao({ quantidadeEstoque: 0, estoqueMinimo: 0 }), false);
  });

  test('monta a previsão completa de um produto', () => {
    const hoje = '2026-11-10';
    const saidasPorDia = {};
    for (let dia = 0; dia < 30; dia++) saidasPorDia[adicionarDias(hoje, -dia)] = 4;
    const previsao = montarPrevisao({
      produto: { quantidadeEstoque: 40, estoqueMinimo: 12, prazoEntregaDias: 3 },
      historico: { totaisMensais: {}, saidasPorDia, inicio: '2026-10-01' },
      hoje,
    });
    assert.equal(previsao.situacao, SITUACOES.ok);
    assert.equal(previsao.diasAteRuptura, 10);
    assert.equal(previsao.consumoPrevistoHoje, 4);
    assert.equal(previsao.sazonalidade.confiavel, false);
  });
});
