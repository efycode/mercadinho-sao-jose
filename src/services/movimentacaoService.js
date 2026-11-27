/**
 * Entradas (recebimentos) e saídas (vendas) de estoque.
 * A atualização do estoque e o registro no histórico acontecem na mesma transação:
 * se um falhar, o outro é desfeito. Depois disso, verifica se é hora de pedir cotação.
 */
import * as movimentacaoRepository from '../repositories/movimentacaoRepository.js';
import * as produtoRepository from '../repositories/produtoRepository.js';
import { comTransacao } from '../database/conexao.js';
import { LIMITES, REGRAS_DA_MOVIMENTACAO } from '../../shared/validacao.js';
import { formatarNumero, formatarQuantidade } from '../../shared/formatacao.js';
import { ErroDeConflito, ErroNaoEncontrado } from '../errors/errosDaAplicacao.js';
import { normalizarEValidar } from './validacaoDeEntrada.js';
import { dataDeHoje } from './previsaoService.js';
import { buscarProduto } from './produtoService.js';
import * as cotacaoService from './cotacaoService.js';

export async function listarMovimentacoes(produtoId) {
  await buscarProduto(produtoId);
  return movimentacaoRepository.listarPorProduto(produtoId);
}

export async function registrarMovimentacao(produtoId, dadosRecebidos = {}) {
  const hoje = dataDeHoje();
  const dados = normalizarEValidar({ ...dadosRecebidos, data: dadosRecebidos.data || hoje }, REGRAS_DA_MOVIMENTACAO, { hoje });

  const { movimentacao, produto } = await comTransacao(async (transacao) => {
    const produtoAtualizado = await aplicarNoEstoque(produtoId, dados, transacao);
    const registro = await movimentacaoRepository.inserir({ produtoId, ...dados }, transacao);
    return { movimentacao: registro, produto: produtoAtualizado };
  });

  const cotacaoAutomatica = await cotacaoService.revisarReposicao(produtoId);
  return { movimentacao, produto, cotacaoAutomatica };
}

async function aplicarNoEstoque(produtoId, { tipo, quantidade }, transacao) {
  const variacao = tipo === 'entrada' ? quantidade : -quantidade;
  const alterou = await produtoRepository.ajustarEstoque(produtoId, variacao, LIMITES.quantidade, transacao);
  const produto = await produtoRepository.buscarPorId(produtoId, transacao);
  if (!produto) throw new ErroNaoEncontrado('Produto não encontrado. Ele pode ter sido excluído.');
  if (!alterou) throw erroDeEstoqueForaDosLimites(produto, tipo, quantidade);
  return produto;
}

function erroDeEstoqueForaDosLimites(produto, tipo, quantidade) {
  const disponivel = formatarQuantidade(produto.quantidadeEstoque, produto.unidade);
  if (tipo === 'entrada') {
    const limite = formatarNumero(LIMITES.quantidade);
    return new ErroDeConflito(`Com essa entrada, o estoque passaria do limite de ${limite} (hoje há ${disponivel}).`, {
      quantidade: `O estoque não pode passar de ${limite}.`,
    });
  }
  return new ErroDeConflito(`Estoque insuficiente: há ${disponivel} disponíveis e a saída pedida é de ${quantidade}.`, {
    quantidade: `A saída não pode ser maior que o estoque atual (${produto.quantidadeEstoque}).`,
  });
}
