/**
 * Regras de negócio dos fornecedores.
 * Regras do cenário aplicadas aqui: campos obrigatórios, CNPJ com 14 dígitos
 * (via shared/validacao.js) e impedir a exclusão de fornecedor que ainda tem produtos.
 */
import * as fornecedorRepository from '../repositories/fornecedorRepository.js';
import * as produtoRepository from '../repositories/produtoRepository.js';
import { REGRAS_DO_FORNECEDOR } from '../../shared/validacao.js';
import { plural } from '../../shared/formatacao.js';
import { ErroDeConflito, ErroNaoEncontrado } from '../errors/errosDaAplicacao.js';
import { normalizarEValidar } from './validacaoDeEntrada.js';

export function listarFornecedores(filtros) {
  return fornecedorRepository.listar(filtros);
}

export async function buscarFornecedor(id) {
  const fornecedor = await fornecedorRepository.buscarPorId(id);
  if (!fornecedor) throw new ErroNaoEncontrado('Fornecedor não encontrado. Ele pode ter sido excluído.');
  return fornecedor;
}

export async function criarFornecedor(dadosRecebidos) {
  const dados = normalizarEValidar(dadosRecebidos, REGRAS_DO_FORNECEDOR);
  await garantirCnpjDisponivel(dados.cnpj);
  return fornecedorRepository.inserir(dados);
}

export async function atualizarFornecedor(id, dadosRecebidos) {
  await buscarFornecedor(id);
  const dados = normalizarEValidar(dadosRecebidos, REGRAS_DO_FORNECEDOR);
  await garantirCnpjDisponivel(dados.cnpj, id);
  const fornecedor = await fornecedorRepository.atualizar(id, dados);
  if (!fornecedor) throw new ErroNaoEncontrado('Fornecedor não encontrado. Ele pode ter sido excluído.');
  return fornecedor;
}

export async function excluirFornecedor(id) {
  const fornecedor = await buscarFornecedor(id);
  const totalDeProdutos = await produtoRepository.contarPorFornecedor(id);
  if (totalDeProdutos > 0) {
    throw new ErroDeConflito(
      `Não é possível excluir "${fornecedor.razaoSocial}": ainda há ${plural(totalDeProdutos, 'produto cadastrado', 'produtos cadastrados')} para ele. Exclua os produtos ou transfira-os para outro fornecedor antes.`,
    );
  }
  await fornecedorRepository.excluir(id);
}

async function garantirCnpjDisponivel(cnpj, idDoProprioFornecedor = null) {
  const existente = await fornecedorRepository.buscarPorCnpj(cnpj);
  if (existente && existente.id !== idDoProprioFornecedor) {
    throw new ErroDeConflito(`Este CNPJ já pertence a "${existente.razaoSocial}".`, {
      cnpj: 'Já existe um fornecedor com este CNPJ.',
    });
  }
}
