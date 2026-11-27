/**
 * Camada HTTP dos produtos, das movimentações de estoque e da previsão.
 */
import * as produtoService from '../services/produtoService.js';
import * as movimentacaoService from '../services/movimentacaoService.js';
import * as cotacaoService from '../services/cotacaoService.js';
import * as previsaoService from '../services/previsaoService.js';
import { lerId } from './parametros.js';

export async function listar(requisicao, resposta) {
  resposta.json(await produtoService.listarProdutos());
}

export async function buscar(requisicao, resposta) {
  resposta.json(await produtoService.buscarProduto(lerId(requisicao)));
}

export async function criar(requisicao, resposta) {
  resposta.status(201).json(await produtoService.criarProduto(requisicao.body));
}

export async function atualizar(requisicao, resposta) {
  resposta.json(await produtoService.atualizarProduto(lerId(requisicao), requisicao.body));
}

export async function excluir(requisicao, resposta) {
  await produtoService.excluirProduto(lerId(requisicao));
  resposta.status(204).end();
}

export async function buscarPrevisao(requisicao, resposta) {
  resposta.json(await produtoService.detalharPrevisaoDoProduto(lerId(requisicao)));
}

export async function listarMovimentacoes(requisicao, resposta) {
  resposta.json(await movimentacaoService.listarMovimentacoes(lerId(requisicao)));
}

export async function registrarMovimentacao(requisicao, resposta) {
  resposta.status(201).json(await movimentacaoService.registrarMovimentacao(lerId(requisicao), requisicao.body));
}

export async function solicitarCotacao(requisicao, resposta) {
  resposta.status(201).json(await cotacaoService.solicitarCotacaoManual(lerId(requisicao)));
}

export async function listarSazonalidades(requisicao, resposta) {
  resposta.json(await previsaoService.listarSazonalidades());
}
