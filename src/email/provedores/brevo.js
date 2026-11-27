/**
 * Envio pela API HTTP da Brevo (plano gratuito: 300 e-mails por dia).
 * Usa HTTPS (porta 443), que funciona inclusive no plano gratuito do Render, onde o SMTP é bloqueado.
 * O endereço do remetente precisa estar verificado no painel da Brevo (Senders).
 */
const URL_DA_API_DA_BREVO = 'https://api.brevo.com/v3/smtp/email';
const TEMPO_LIMITE_EM_MS = 15_000;

export function criarProvedorBrevo({ brevo, remetente, responderPara }) {
  if (!brevo.chaveDeApi) throw new Error('Para EMAIL_MODO=brevo defina BREVO_API_KEY.');

  return {
    modo: 'brevo',
    async enviar({ para, assunto, html, texto }) {
      const resposta = await fetch(URL_DA_API_DA_BREVO, {
        method: 'POST',
        headers: { 'api-key': brevo.chaveDeApi, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: remetente.name, email: remetente.address },
          to: [{ email: para }],
          replyTo: responderPara ? { email: responderPara } : undefined,
          subject: assunto,
          htmlContent: html,
          textContent: texto,
        }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_EM_MS),
      });
      if (!resposta.ok) {
        const detalhe = await resposta.text();
        throw new Error(`A Brevo recusou o envio (HTTP ${resposta.status}): ${detalhe.slice(0, 300)}`);
      }
    },
  };
}
