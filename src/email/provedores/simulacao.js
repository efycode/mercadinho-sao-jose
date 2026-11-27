/**
 * Provedor de simulação: não envia nada, apenas registra no log do servidor.
 * O conteúdo completo do e-mail fica salvo na cotação e pode ser lido na tela "Cotações".
 * É o modo padrão, seguro para demonstrações e para quem ainda não configurou um provedor.
 */
export function criarProvedorDeSimulacao() {
  return {
    modo: 'simulacao',
    async enviar({ para, assunto }) {
      console.info(`[e-mail simulado] Para: ${para} | Assunto: ${assunto}`);
    },
  };
}
