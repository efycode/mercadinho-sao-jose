/**
 * Regras de negócio dos produtos.
 * Regras do cenário aplicadas aqui: campos obrigatórios e quantidade em estoque
 * não negativa (via shared/validacao.js), sempre ligados a um fornecedor existente.
 */
import * as produtoRepository from '../repositories/produtoRepository.js';
import { REGRAS_DO_PRODUTO } from '../../shared/validacao.js';
import { ErroDeValidacao, ErroNaoEncontrado } from '../errors/errosDaAplicacao.js';
import { normalizarEValidar } from './validacaoDeEntrada.js';
import * as fornecedorService from './fornecedorService.js';
import * as previsaoService from './previsaoService.js';
import * as cotacaoService from './cotacaoService.js';

export async function listarProdutos() {
  return previsaoService.anexarPrevisoes(await produtoRepository.listarTodos());
}

export async function listarProdutosDoFornecedor(fornecedorId) {
  await fornecedorService.buscarFornecedor(fornecedorId);
  return previsaoService.anexarPrevisoes(await produtoRepository.listarPorFornecedor(fornecedorId));
}

export async function buscarProduto(id) {
  const produto = await produtoRepository.buscarPorId(id);
  if (!produto) throw new ErroNaoEncontrado('Produto não encontrado. Ele pode ter sido excluído.');
  return produto;
}

export async function detalharPrevisaoDoProduto(id) {
  return previsaoService.detalharPrevisao(await buscarProduto(id));
}

/** O fornecedor escolhido pode ter sido excluído em outra aba: vira erro no campo, não "não encontrado". */
async function garantirFornecedorExistente(fornecedorId) {
  try {
    await fornecedorService.buscarFornecedor(fornecedorId);
  } catch (erro) {
    if (!(erro instanceof ErroNaoEncontrado)) throw erro;
    throw new ErroDeValidacao(undefined, { fornecedorId: 'Este fornecedor não existe mais. Escolha outro da lista.' });
  }
}

export async function criarProduto(dadosRecebidos) {
  const dados = normalizarEValidar(dadosRecebidos, REGRAS_DO_PRODUTO);
  await garantirFornecedorExistente(dados.fornecedorId);
  const produto = await produtoRepository.inserir(dados);
  return { ...produto, cotacaoAutomatica: await cotacaoService.revisarReposicao(produto.id) };
}

export async function atualizarProduto(id, dadosRecebidos) {
  const anterior = await buscarProduto(id);
  const dados = normalizarEValidar(dadosRecebidos, REGRAS_DO_PRODUTO);
  await garantirFornecedorExistente(dados.fornecedorId);
  const produto = await produtoRepository.atualizar(id, dados);
  if (!produto) throw new ErroNaoEncontrado('Produto não encontrado. Ele pode ter sido excluído.');
  const trocouDeFornecedor = anterior.fornecedorId !== produto.fornecedorId;
  return { ...produto, cotacaoAutomatica: await cotacaoService.revisarReposicao(id, { trocouDeFornecedor }) };
}

export async function excluirProduto(id) {
  await buscarProduto(id);
  await produtoRepository.excluir(id);
}
