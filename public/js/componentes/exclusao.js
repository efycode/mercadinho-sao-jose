/**
 * Fluxo único de exclusão: pergunta, chama a API e avisa o resultado.
 * Se o serviço recusar (ex.: fornecedor que ainda tem produtos), mostra o motivo dado por ele.
 * Cada função devolve true quando a exclusão aconteceu.
 */
import { excluirFornecedor } from '../api/fornecedorApi.js';
import { excluirProduto } from '../api/produtoApi.js';
import { confirmar } from './dialogo.js';
import { notificar } from './notificacoes.js';

async function confirmarEExcluir({ titulo, mensagem, textoDoBotao, excluir, mensagemDeSucesso }) {
  const confirmado = await confirmar({ titulo, mensagem, textoDoBotao, perigoso: true });
  if (!confirmado) return false;
  try {
    await excluir();
    notificar({ tipo: 'sucesso', mensagem: mensagemDeSucesso });
    return true;
  } catch (erro) {
    notificar({ tipo: 'erro', mensagem: erro.message });
    return false;
  }
}

export function excluirFornecedorComConfirmacao({ id, razaoSocial }) {
  return confirmarEExcluir({
    titulo: 'Excluir fornecedor?',
    mensagem: `"${razaoSocial}" será removido do sistema. Fornecedores com produtos cadastrados não podem ser excluídos.`,
    textoDoBotao: 'Excluir fornecedor',
    excluir: () => excluirFornecedor(id),
    mensagemDeSucesso: 'Fornecedor excluído.',
  });
}

export function excluirProdutoComConfirmacao({ id, nome }) {
  return confirmarEExcluir({
    titulo: 'Excluir produto?',
    mensagem: `"${nome}" e todo o seu histórico de movimentações e cotações serão apagados.`,
    textoDoBotao: 'Excluir produto',
    excluir: () => excluirProduto(id),
    mensagemDeSucesso: 'Produto excluído.',
  });
}
