/**
 * Camada HTTP dos fornecedores: lê a requisição, chama o serviço e devolve a resposta.
 * Nenhuma regra de negócio fica aqui. No Express 5, erros lançados em funções async
 * vão direto para o tratador central (middlewares/tratadorDeErros.js).
 */
import * as fornecedorService from '../services/fornecedorService.js';
import * as produtoService from '../services/produtoService.js';
import { lerId } from './parametros.js';

export async function listar(requisicao, resposta) {
  const busca = typeof requisicao.query.busca === 'string' ? requisicao.query.busca : '';
  resposta.json(await fornecedorService.listarFornecedores({ busca }));
}

export async function buscar(requisicao, resposta) {
  resposta.json(await fornecedorService.buscarFornecedor(lerId(requisicao)));
}

export async function criar(requisicao, resposta) {
  resposta.status(201).json(await fornecedorService.criarFornecedor(requisicao.body));
}

export async function atualizar(requisicao, resposta) {
  resposta.json(await fornecedorService.atualizarFornecedor(lerId(requisicao), requisicao.body));
}

export async function excluir(requisicao, resposta) {
  await fornecedorService.excluirFornecedor(lerId(requisicao));
  resposta.status(204).end();
}

export async function listarProdutos(requisicao, resposta) {
  resposta.json(await produtoService.listarProdutosDoFornecedor(lerId(requisicao)));
}
