/**
 * Envio por SMTP (ex.: Gmail com "senha de app"), útil para testar no seu computador.
 * O plano gratuito do Render bloqueia as portas SMTP (25, 465 e 587); lá, use EMAIL_MODO=brevo.
 * Use SMTP_PORTA=465 (SSL) ou 587 (STARTTLS).
 */
import nodemailer from 'nodemailer';

export function criarProvedorSmtp({ smtp, remetente, responderPara }) {
  if (!smtp.host || !smtp.usuario || !smtp.senha) {
    throw new Error('Para EMAIL_MODO=smtp defina SMTP_HOST, SMTP_USUARIO e SMTP_SENHA.');
  }
  const transporte = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.porta,
    secure: smtp.porta === 465,
    auth: { user: smtp.usuario, pass: smtp.senha },
    connectionTimeout: 15_000,
  });

  return {
    modo: 'smtp',
    async enviar({ para, assunto, html, texto }) {
      await transporte.sendMail({
        from: remetente,
        to: para,
        replyTo: responderPara || undefined,
        subject: assunto,
        html,
        text: texto,
      });
    },
  };
}
