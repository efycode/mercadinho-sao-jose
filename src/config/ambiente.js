/**
 * Configuração da aplicação, lida das variáveis de ambiente.
 * Em desenvolvimento, os valores vêm do arquivo .env (veja .env.example).
 * Em produção, vêm das variáveis cadastradas no painel do Render (Environment).
 */

function carregarArquivoEnv() {
  try {
    process.loadEnvFile();
  } catch (erro) {
    if (erro.code !== 'ENOENT') throw erro; // sem .env: usa só as variáveis do ambiente
  }
}

/** Valores colados no painel do Render costumam vir com espaços nas pontas; eles são ignorados. */
function lerTexto(nome) {
  return (process.env[nome] ?? '').trim();
}

function lerInteiro(nome, padrao) {
  const valor = Number.parseInt(lerTexto(nome), 10);
  return Number.isNaN(valor) ? padrao : valor;
}

function lerBooleano(nome, padrao) {
  const valor = lerTexto(nome).toLowerCase();
  return valor === '' ? padrao : ['true', '1', 'sim', 'yes'].includes(valor);
}

/**
 * Aceita o endereço do banco mesmo colado com aspas ou com o "psql" do painel do Neon na frente.
 * O pg já trata sslmode=require (o que o Neon mostra) como verify-full, mas escreve um aviso
 * no log; a troca deixa explícita a verificação do certificado e evita o aviso.
 */
function lerUrlDoBanco() {
  const url = lerTexto('DATABASE_URL')
    .replace(/^psql\s+/i, '')
    .replace(/^(['"])(.*)\1$/, '$2')
    .trim()
    .replace(/([?&]sslmode=)(?:require|prefer|verify-ca)(?=&|$)/i, '$1verify-full');
  return url || undefined;
}

const FUSO_PADRAO = 'America/Fortaleza';

/** Um fuso digitado errado quebraria todas as datas; nesse caso, vale o padrão, com aviso. */
function lerFusoHorario() {
  const fuso = lerTexto('FUSO_HORARIO') || FUSO_PADRAO;
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: fuso });
    return fuso;
  } catch {
    console.warn(`FUSO_HORARIO "${fuso}" não existe; usando "${FUSO_PADRAO}". Use um nome como America/Fortaleza.`);
    return FUSO_PADRAO;
  }
}

// Usuário de acesso: de 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado.
const FORMATO_DO_USUARIO = /^[a-z0-9._-]{3,40}$/;
const ACESSO_PADRAO = Object.freeze({ usuario: 'avaliacao', senha: 'mercadinho2026' });

/** Lê o usuário e a senha de acesso. Valores inválidos não derrubam o sistema: viram o padrão, com aviso. */
function lerAcesso() {
  let usuario = lerTexto('LOGIN_USUARIO').toLowerCase() || ACESSO_PADRAO.usuario;
  if (!FORMATO_DO_USUARIO.test(usuario)) {
    console.warn(`LOGIN_USUARIO inválido; usando "${ACESSO_PADRAO.usuario}". Use de 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado.`);
    usuario = ACESSO_PADRAO.usuario;
  }
  let senha = lerTexto('LOGIN_SENHA') || ACESSO_PADRAO.senha;
  if (senha.length < 8 || senha.length > 128) {
    console.warn('LOGIN_SENHA deve ter de 8 a 128 caracteres; usando a senha padrão.');
    senha = ACESSO_PADRAO.senha;
  }
  return Object.freeze({
    usuario,
    senha,
    nome: (lerTexto('LOGIN_NOME') || 'Equipe de avaliação').slice(0, 80),
    mostrarNaTelaDeLogin: lerBooleano('MOSTRAR_ACESSO_NA_TELA_DE_LOGIN', true),
  });
}

carregarArquivoEnv();

const nomeDoNegocio = lerTexto('NOME_DO_NEGOCIO') || 'Mercadinho São José';

export const ambiente = Object.freeze({
  producao: lerTexto('NODE_ENV').toLowerCase() === 'production',
  porta: lerInteiro('PORT', 3000),
  urlDoBancoDeDados: lerUrlDoBanco(),
  fusoHorario: lerFusoHorario(),
  popularDemoSeVazio: lerBooleano('POPULAR_DEMO_SE_VAZIO', false),
  nomeDoNegocio,
  // Acesso ao sistema, ajustado a cada subida do servidor (veja garantirUsuarioInicial em sessaoService.js).
  acesso: lerAcesso(),
  email: Object.freeze({
    modo: (lerTexto('EMAIL_MODO') || 'simulacao').toLowerCase(),
    remetente: Object.freeze({
      name: lerTexto('EMAIL_REMETENTE_NOME') || nomeDoNegocio,
      address: lerTexto('EMAIL_REMETENTE_ENDERECO') || 'compras@mercadinho-sao-jose.example',
    }),
    responderPara: lerTexto('EMAIL_RESPONDER_PARA'),
    limiteDiario: lerInteiro('EMAIL_LIMITE_DIARIO', 20),
    smtp: Object.freeze({
      host: lerTexto('SMTP_HOST'),
      porta: lerInteiro('SMTP_PORTA', 465),
      usuario: lerTexto('SMTP_USUARIO'),
      senha: lerTexto('SMTP_SENHA'),
    }),
    brevo: Object.freeze({
      chaveDeApi: lerTexto('BREVO_API_KEY'),
    }),
  }),
});
