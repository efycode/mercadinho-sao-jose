/**
 * Camada HTTP das cotações enviadas aos fornecedores.
 */
import * as cotacaoService from '../services/cotacaoService.js';
import { lerId, lerIdOpcional } from './parametros.js';

export async function listar(requisicao, resposta) {
  const situacao = typeof requisicao.query.situacao === 'string' ? requisicao.query.situacao : 'todas';
  const produtoId = lerIdOpcional(requisicao.query.produtoId);
  resposta.json(await cotacaoService.listarCotacoes({ situacao, produtoId }));
}

export async function buscar(requisicao, resposta) {
  resposta.json(await cotacaoService.buscarCotacao(lerId(requisicao)));
}

export async function alterarStatus(requisicao, resposta) {
  resposta.json(await cotacaoService.alterarStatus(lerId(requisicao), requisicao.body?.status));
}

export async function reenviar(requisicao, resposta) {
  resposta.json(await cotacaoService.reenviarCotacao(lerId(requisicao)));
}
