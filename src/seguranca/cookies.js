/**
 * Cookie da sessão de login.
 *
 * - HttpOnly: o JavaScript da página não consegue ler o cookie, então um script malicioso
 *   não teria como roubar a sessão.
 * - Secure (em produção): o cookie só trafega por HTTPS.
 * - SameSite=Strict: o navegador não envia o cookie em pedidos que partem de outros sites,
 *   o que bloqueia ataques de falsificação de requisição (CSRF).
 */
import { ambiente } from '../config/ambiente.js';

export const NOME_DO_COOKIE_DE_SESSAO = 'mercadinho_sessao';

export function opcoesDoCookieDeSessao({ expiraEm } = {}) {
  return {
    httpOnly: true,
    secure: ambiente.producao,
    sameSite: 'strict',
    path: '/',
    ...(expiraEm && { expires: expiraEm }),
  };
}

/** Lê um cookie do cabeçalho "Cookie" da requisição, sem depender de outra biblioteca. */
export function lerCookie(requisicao, nome) {
  const cabecalho = requisicao.headers?.cookie;
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(';')) {
    const separador = parte.indexOf('=');
    if (separador === -1 || parte.slice(0, separador).trim() !== nome) continue;
    try {
      return decodeURIComponent(parte.slice(separador + 1).trim()) || null;
    } catch {
      return null; // valor malformado: trata como se não houvesse cookie
    }
  }
  return null;
}
