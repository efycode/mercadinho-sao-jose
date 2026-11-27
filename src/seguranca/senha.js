/**
 * Guarda e confere senhas sem nunca gravar a senha em si.
 *
 * Usa o scrypt, que já vem no Node (node:crypto): ele é lento e gasta memória de propósito,
 * o que torna caro testar milhões de senhas caso alguém copie o banco. Cada senha recebe um
 * sal aleatório, então duas pessoas com a mesma senha têm hashes diferentes.
 *
 * Formato guardado: scrypt$N$r$p$sal$hash (sal e hash em base64).
 */
import { randomBytes, scrypt as scryptComCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptComCallback);

const PARAMETROS = Object.freeze({ N: 16_384, r: 8, p: 1 });
const TAMANHO_DO_SAL = 16;
const TAMANHO_DO_HASH = 64;

export async function gerarHashDeSenha(senha) {
  const sal = randomBytes(TAMANHO_DO_SAL);
  const hash = await scrypt(senha, sal, TAMANHO_DO_HASH, PARAMETROS);
  return ['scrypt', PARAMETROS.N, PARAMETROS.r, PARAMETROS.p, sal.toString('base64'), hash.toString('base64')].join('$');
}

/** true se a senha gera o mesmo hash. A comparação leva o mesmo tempo, acerte ou erre. */
export async function conferirSenha(senha, hashGuardado) {
  const partes = String(hashGuardado ?? '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, N, r, p, salEmBase64, hashEmBase64] = partes;
  const esperado = Buffer.from(hashEmBase64, 'base64');
  if (esperado.length !== TAMANHO_DO_HASH) return false;

  const calculado = await scrypt(senha, Buffer.from(salEmBase64, 'base64'), esperado.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(calculado, esperado);
}
