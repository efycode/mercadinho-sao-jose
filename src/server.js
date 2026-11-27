/**
 * Ponto de entrada do servidor (npm start).
 * 1. Cria as tabelas que faltarem.  2. Garante o usuário de acesso (login) com a senha da configuração.
 * 3. Popula a demonstração, se configurado e se o banco estiver vazio.
 * 4. Sobe o servidor HTTP.          5. Encerra com cuidado quando a hospedagem pede (SIGTERM).
 */
import { criarAplicacao } from './app.js';
import { ambiente } from './config/ambiente.js';
import { aplicarMigracoes } from './database/migracao.js';
import { popularDadosDemoSeVazio } from './database/dadosDemo.js';
import { encerrarConexoes } from './database/conexao.js';
import { ehFalhaDeConexao } from './database/falhasDeConexao.js';
import { garantirUsuarioInicial } from './services/sessaoService.js';

// O proxy da hospedagem (no Render, o balanceador de carga) reaproveita conexões com o servidor.
// Se o Node fechasse uma conexão ociosa cedo demais (o padrão do Node é 5 s), o proxy poderia
// enviar uma requisição numa conexão já fechada e devolver erro 502 ao visitante.
const TEMPO_DE_CONEXAO_OCIOSA_EM_MS = 65_000;
const TENTATIVAS_DE_CONEXAO = 5;
const ESPERA_ENTRE_TENTATIVAS_EM_MS = 5_000;
const PRAZO_PARA_ENCERRAR_EM_MS = 10_000;

const esperar = (milissegundos) => new Promise((resolver) => setTimeout(resolver, milissegundos));

/** O primeiro contato com o banco tenta algumas vezes: o Neon pode levar segundos para "acordar". */
async function aplicarMigracoesComNovasTentativas() {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await aplicarMigracoes();
    } catch (erro) {
      if (tentativa >= TENTATIVAS_DE_CONEXAO || !ehFalhaDeConexao(erro)) throw erro;
      console.warn(`Banco indisponível (${erro.message}). Tentativa ${tentativa} de ${TENTATIVAS_DE_CONEXAO}; nova tentativa em 5 s.`);
      await esperar(ESPERA_ENTRE_TENTATIVAS_EM_MS);
    }
  }
}

function prepararEncerramento(servidor) {
  let encerrando = false;
  const encerrar = (sinal) => {
    if (encerrando) return;
    encerrando = true;
    console.log(`${sinal} recebido: terminando as requisições em andamento e encerrando.`);
    setTimeout(() => process.exit(0), PRAZO_PARA_ENCERRAR_EM_MS).unref(); // não espera para sempre
    servidor.close(() => {
      encerrarConexoes()
        .catch(() => {})
        .finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
}

async function iniciar() {
  await aplicarMigracoesComNovasTentativas();
  await garantirUsuarioInicial(ambiente.acesso);
  if (ambiente.popularDemoSeVazio) await popularDadosDemoSeVazio();

  const servidor = criarAplicacao().listen(ambiente.porta, () => {
    console.log(`${ambiente.nomeDoNegocio} no ar em http://localhost:${ambiente.porta}`);
  });
  servidor.on('error', (erro) => {
    const motivo = erro.code === 'EADDRINUSE' ? `a porta ${ambiente.porta} já está em uso (mude PORT no .env)` : erro.message;
    console.error(`Não foi possível abrir o servidor: ${motivo}.`);
    process.exit(1);
  });
  servidor.keepAliveTimeout = TEMPO_DE_CONEXAO_OCIOSA_EM_MS;
  servidor.headersTimeout = TEMPO_DE_CONEXAO_OCIOSA_EM_MS + 1_000;
  prepararEncerramento(servidor);
}

iniciar().catch((erro) => {
  console.error('Não foi possível iniciar o servidor:', erro.message);
  process.exit(1);
});
