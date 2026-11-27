/**
 * Monta a aplicação Express: segurança, API (/api), interface (arquivos de /public)
 * e o código compartilhado (/shared), que o navegador importa como módulo.
 */
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import rotasDaApi from './routes/index.js';
import { responderRotaNaoEncontrada, tratarErros } from './middlewares/tratadorDeErros.js';
import { ambiente } from './config/ambiente.js';

const pastaDoProjeto = (pasta) => fileURLToPath(new URL(`../${pasta}`, import.meta.url));

function configurarSeguranca(app) {
  // No Render, as requisições chegam por um proxy reverso. Confiar só no proxy imediato faz o
  // Express usar o endereço que ele repassa (base do limite de requisições), sem aceitar a lista
  // inteira do X-Forwarded-For, que o visitante poderia forjar.
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // 'unsafe-inline' só para atributos style com variáveis CSS
          fontSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: ambiente.producao ? [] : null,
        },
      },
    }),
  );
}

// Folgado o bastante para uma sala de aula inteira atrás do mesmo endereço IP (uma tela abre de 2
// a 4 chamadas à API), mas ainda barra robôs que disparam milhares de requisições.
const limitadorDaApi = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { mensagem: 'Muitas requisições em pouco tempo. Aguarde alguns minutos e tente de novo.' },
});

// Formato dos endereços das telas: só letras, números e hífens entre barras (ex.: /fornecedores/3/produtos).
const FORMATO_DE_ENDERECO_DE_TELA = /^(\/[\w-]+)+\/?$/;

/** Quem digitar um endereço da interface sem o "#" (ex.: /fornecedores) vai para a tela certa. */
function redirecionarParaATela(requisicao, resposta, proximo) {
  if (requisicao.method !== 'GET' || !FORMATO_DE_ENDERECO_DE_TELA.test(requisicao.path)) return proximo();
  resposta.redirect(302, `/#${requisicao.path}`);
}

export function criarAplicacao() {
  const app = express();
  configurarSeguranca(app);

  app.use('/api', limitadorDaApi, express.json({ limit: '100kb' }), rotasDaApi);
  app.use('/api', responderRotaNaoEncontrada);

  app.use('/shared', express.static(pastaDoProjeto('shared')));
  app.use(express.static(pastaDoProjeto('public')));
  app.use(redirecionarParaATela);

  app.use(tratarErros);
  return app;
}
