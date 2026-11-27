/**
 * Botão "Pedir cotação": usado no painel e na tela do produto.
 */
import { solicitarCotacao } from '../api/produtoApi.js';
import { notificar, notificarCotacao } from './notificacoes.js';
import { recarregarRotaAtual } from '../roteador.js';

export async function pedirCotacao(botao, produtoId) {
  botao.disabled = true;
  try {
    notificarCotacao(await solicitarCotacao(produtoId));
    await recarregarRotaAtual();
  } catch (erro) {
    notificar({ tipo: 'erro', mensagem: erro.message });
    botao.disabled = false;
  }
}
