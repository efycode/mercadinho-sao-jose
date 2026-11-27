/**
 * Liga o banco de dados às regras puras de previsão (src/domain/previsao.js):
 * busca o histórico de saídas e devolve situação, data prevista de ruptura,
 * sazonalidade e quantidade sugerida de compra de cada produto.
 */
import * as movimentacaoRepository from '../repositories/movimentacaoRepository.js';
import * as produtoRepository from '../repositories/produtoRepository.js';
import { montarPrevisao, PARAMETROS_DA_PREVISAO, projetarCurvaDeEstoque } from '../domain/previsao.js';
import { adicionarDias, hojeIso, primeiroDiaDoMes } from '../../shared/datas.js';
import { ambiente } from '../config/ambiente.js';

export function dataDeHoje() {
  return hojeIso(ambiente.fusoHorario);
}

function historicoVazio() {
  return { totaisMensais: {}, saidasPorDia: {}, inicio: null };
}

/** Busca o histórico de vários produtos com apenas três consultas, seja qual for a quantidade. */
async function carregarHistoricos(produtoIds, hoje) {
  const historicos = new Map(produtoIds.map((id) => [id, historicoVazio()]));
  if (produtoIds.length === 0) return historicos;

  const inicioDaJanela = adicionarDias(hoje, -(PARAMETROS_DA_PREVISAO.janelaDeConsumoEmDias - 1));
  const [totaisMensais, saidasDiarias, inicios] = await Promise.all([
    movimentacaoRepository.somarSaidasPorMes(produtoIds, primeiroDiaDoMes(hoje)),
    movimentacaoRepository.somarSaidasPorDia(produtoIds, inicioDaJanela, hoje),
    movimentacaoRepository.buscarInicioDosHistoricos(produtoIds),
  ]);

  for (const { produtoId, mes, total } of totaisMensais) historicos.get(produtoId).totaisMensais[mes] = total;
  for (const { produtoId, data, total } of saidasDiarias) historicos.get(produtoId).saidasPorDia[data] = total;
  for (const { produtoId, inicio } of inicios) historicos.get(produtoId).inicio = inicio;
  return historicos;
}

/** Devolve os produtos recebidos, cada um com o campo "previsao" preenchido. */
export async function anexarPrevisoes(produtos) {
  const hoje = dataDeHoje();
  const historicos = await carregarHistoricos(
    produtos.map((produto) => produto.id),
    hoje,
  );
  return produtos.map((produto) => ({
    ...produto,
    previsao: montarPrevisao({ produto, historico: historicos.get(produto.id), hoje }),
  }));
}

export async function calcularPrevisao(produto) {
  const [produtoComPrevisao] = await anexarPrevisoes([produto]);
  return produtoComPrevisao.previsao;
}

/**
 * Previsão completa para a tela do produto, com a curva de estoque dos próximos 60 dias.
 * "hoje" vai junto para a tela usar a mesma data do servidor (fuso de FUSO_HORARIO), e não a do navegador.
 */
export async function detalharPrevisao(produto) {
  const hoje = dataDeHoje();
  const previsao = await calcularPrevisao(produto);
  const curvaDeEstoque = projetarCurvaDeEstoque({
    estoqueAtual: produto.quantidadeEstoque,
    consumoDiarioBase: previsao.consumoDiarioBase,
    indices: previsao.sazonalidade.indices,
    hoje,
  });
  return { ...previsao, hoje, curvaDeEstoque, parametros: PARAMETROS_DA_PREVISAO };
}

/** Índices sazonais de todos os produtos, dos mais sazonais para os mais estáveis. */
export async function listarSazonalidades() {
  const produtos = await anexarPrevisoes(await produtoRepository.listarTodos());
  const amplitude = ({ indices }) => Math.max(...indices) - Math.min(...indices);
  return produtos
    .map(({ id, nome, fornecedorId, fornecedorNome, previsao }) => ({
      id,
      nome,
      fornecedorId,
      fornecedorNome,
      ...previsao.sazonalidade,
    }))
    .sort((a, b) => Number(b.confiavel) - Number(a.confiavel) || amplitude(b) - amplitude(a));
}
