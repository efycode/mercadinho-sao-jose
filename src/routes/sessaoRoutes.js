import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import * as sessaoController from '../controllers/sessaoController.js';

/**
 * Freia quem tenta adivinhar senhas: no máximo 10 tentativas erradas a cada 15 minutos, contadas
 * por endereço e por usuário. Logins certos não contam.
 */
const limitadorDeTentativas = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (requisicao) => {
    const usuario = String(requisicao.body?.usuario ?? '').trim().toLowerCase().slice(0, 40);
    return `${ipKeyGenerator(requisicao.ip)}|${usuario}`;
  },
  message: { mensagem: 'Muitas tentativas de login erradas. Aguarde 15 minutos e tente de novo.' },
});

/** Rotas de acesso (/api/sessao): consultar quem está logado, entrar e sair. */
const rotasDeSessao = Router();

rotasDeSessao.get('/', sessaoController.consultar);
rotasDeSessao.post('/', limitadorDeTentativas, sessaoController.entrar);
rotasDeSessao.delete('/', sessaoController.sair);

export default rotasDeSessao;
