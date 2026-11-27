/**
 * Reconhece erros de conexão com o banco: fora do ar, "acordando" (o Neon dorme sem uso)
 * ou conexão que caiu no meio. Eles viram HTTP 503 na API e novas tentativas ao iniciar o servidor.
 */
const CODIGOS_DE_FALHA_DE_CONEXAO = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '53300', // too_many_connections
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
]);

// O driver pg lança estes sem código quando a conexão cai ou demora demais para abrir.
const MENSAGENS_DE_FALHA_DE_CONEXAO = /Connection terminated|timeout exceeded when trying to connect/i;

export function ehFalhaDeConexao(erro) {
  return CODIGOS_DE_FALHA_DE_CONEXAO.has(erro?.code) || MENSAGENS_DE_FALHA_DE_CONEXAO.test(erro?.message ?? '');
}
