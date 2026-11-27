/** Acesso aos dados de sessões de login. Recebe sempre o hash do código, nunca o código. */
import { consultar } from '../database/conexao.js';

export async function criar({ tokenHash, usuarioId, expiraEm }) {
  await consultar('INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES ($1, $2, $3)', [
    tokenHash,
    usuarioId,
    expiraEm,
  ]);
}

/** Usuário dono da sessão, se ela existir e ainda não tiver vencido. */
export async function buscarUsuario(tokenHash) {
  const { rows } = await consultar(
    `SELECT u.id, u.usuario, u.nome
       FROM sessoes s
       JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = $1
        AND s.expira_em > NOW()`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function apagar(tokenHash) {
  await consultar('DELETE FROM sessoes WHERE token_hash = $1', [tokenHash]);
}

export async function apagarVencidas() {
  await consultar('DELETE FROM sessoes WHERE expira_em <= NOW()');
}

/** Encerra todas as sessões de um usuário (usado quando a senha dele muda). */
export async function apagarDoUsuario(usuarioId) {
  await consultar('DELETE FROM sessoes WHERE usuario_id = $1', [usuarioId]);
}
