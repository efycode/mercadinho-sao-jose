/**
 * Dados do painel inicial: o que vai faltar, o que entra em alta temporada no
 * próximo mês e quais cotações aguardam resposta.
 */
import * as produtoRepository from '../repositories/produtoRepository.js';
import * as fornecedorRepository from '../repositories/fornecedorRepository.js';
import * as cotacaoRepository from '../repositories/cotacaoRepository.js';
import { STATUS_EM_ABERTO } from '../repositories/cotacaoRepository.js';
import { SITUACOES } from '../domain/previsao.js';
import { indiceDoMes, NOMES_DOS_MESES } from '../../shared/datas.js';
import * as previsaoService from './previsaoService.js';

const HORIZONTE_DO_PAINEL_EM_DIAS = 7;

function resumirProduto(produto, produtosComCotacaoAberta) {
  const { previsao } = produto;
  return {
    id: produto.id,
    nome: produto.nome,
    unidade: produto.unidade,
    fornecedorId: produto.fornecedorId,
    fornecedorNome: produto.fornecedorNome,
    quantidadeEstoque: produto.quantidadeEstoque,
    estoqueMinimo: produto.estoqueMinimo,
    situacao: previsao.situacao,
    diasAteRuptura: previsao.diasAteRuptura,
    dataDaRuptura: previsao.dataDaRuptura,
    temCotacaoAberta: produtosComCotacaoAberta.has(produto.id),
  };
}

function precisaDeAtencao({ previsao }) {
  const acabaEmBreve = previsao.diasAteRuptura !== null && previsao.diasAteRuptura <= HORIZONTE_DO_PAINEL_EM_DIAS;
  return previsao.situacao !== SITUACOES.ok || acabaEmBreve;
}

function ordenarPorUrgencia(a, b) {
  return (a.diasAteRuptura ?? Infinity) - (b.diasAteRuptura ?? Infinity) || a.nome.localeCompare(b.nome, 'pt-BR');
}

function listarAltaTemporadaDoProximoMes(produtos) {
  return produtos
    .filter(({ previsao }) => previsao.sazonalidade.temporadaDoProximoMes === 'alta')
    .map(({ id, nome, fornecedorNome, previsao }) => ({ id, nome, fornecedorNome, indice: previsao.sazonalidade.indiceDoProximoMes }))
    .sort((a, b) => b.indice - a.indice);
}

export async function montarPainel() {
  const hoje = previsaoService.dataDeHoje();
  const [produtos, totalDeFornecedores, cotacoesEmAberto, produtosComCotacaoAberta] = await Promise.all([
    produtoRepository.listarTodos().then(previsaoService.anexarPrevisoes),
    fornecedorRepository.contar(),
    cotacaoRepository.listar({ status: STATUS_EM_ABERTO, limite: 50 }),
    cotacaoRepository.listarProdutosComCotacaoAberta(),
  ]);

  const contarSituacao = (...situacoes) => produtos.filter(({ previsao }) => situacoes.includes(previsao.situacao)).length;

  return {
    hoje,
    horizonteEmDias: HORIZONTE_DO_PAINEL_EM_DIAS,
    resumo: {
      totalDeFornecedores,
      totalDeProdutos: produtos.length,
      produtosNoMinimo: contarSituacao(SITUACOES.semEstoque, SITUACOES.critico),
      produtosEmAtencao: contarSituacao(SITUACOES.atencao),
      cotacoesEmAberto: cotacoesEmAberto.length,
    },
    faltasPrevistas: produtos
      .filter(precisaDeAtencao)
      .map((produto) => resumirProduto(produto, produtosComCotacaoAberta))
      .sort(ordenarPorUrgencia),
    altaTemporada: {
      mes: NOMES_DOS_MESES[(indiceDoMes(hoje) + 1) % 12],
      produtos: listarAltaTemporadaDoProximoMes(produtos),
    },
    cotacoesEmAberto: cotacoesEmAberto.slice(0, 6).map(({ corpoTexto, ...cotacao }) => cotacao),
  };
}
