/**
 * Mensagens de retorno no canto da tela. A área tem aria-live, então leitores
 * de tela anunciam cada mensagem. Erros ficam mais tempo visíveis.
 */
import { html } from '/shared/html.js';
import { MODOS_DE_EMAIL } from './indicadores.js';

const DURACAO_EM_MS = { sucesso: 5000, aviso: 9000, erro: 10000 };

export function notificar({ tipo = 'sucesso', mensagem }) {
  const area = document.getElementById('notificacoes');
  for (const repetida of area.querySelectorAll('.notificacao')) {
    if (repetida.dataset.mensagem === mensagem) repetida.remove(); // evita empilhar o mesmo aviso
  }
  const notificacao = document.createElement('div');
  notificacao.dataset.mensagem = mensagem;
  notificacao.className = `notificacao notificacao--${tipo}`;
  notificacao.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  notificacao.innerHTML = html`
    <p>${mensagem}</p>
    <button class="notificacao__fechar" type="button" aria-label="Fechar mensagem">×</button>`;
  notificacao.querySelector('button').addEventListener('click', () => notificacao.remove());
  area.append(notificacao);
  setTimeout(() => notificacao.remove(), DURACAO_EM_MS[tipo]);
}

/** Avisa o resultado de uma cotação criada (automática ou manual). */
export function notificarCotacao(cotacao, { automatica = false } = {}) {
  if (!cotacao) return;
  const inicio = automatica ? 'O estoque chegou ao mínimo: ' : '';
  if (cotacao.status === 'falha_envio') {
    notificar({
      tipo: 'erro',
      mensagem: `${inicio}a cotação foi criada, mas o e-mail não saiu (${cotacao.erroDeEnvio}). Reenvie pela tela Cotações.`,
    });
    return;
  }
  const pedido = `pedido de cotação de ${cotacao.quantidadeSugerida} ${cotacao.produtoUnidade} para ${cotacao.emailDestino}`;
  const mensagem =
    cotacao.modoDeEnvio === 'simulacao'
      ? `${inicio}${pedido} registrado em modo simulação. O texto do e-mail está na tela Cotações.`
      : `${inicio}${pedido} enviado por ${MODOS_DE_EMAIL[cotacao.modoDeEnvio]}.`;
  notificar({ tipo: 'aviso', mensagem });
}
