/** Acesso aos dados de usuários (login). */
import { consultar } from '../database/conexao.js';

export async function buscarPorUsuario(usuario) {
  const { rows } = await consultar(
    `SELECT id, usuario, nome, senha_hash AS "senhaHash"
       FROM usuarios
      WHERE usuario = $1`,
    [usuario],
  );
  return rows[0] ?? null;
}

/** O sistema tem um único acesso: remove qualquer outro usuário (as sessões dele vão junto, em cascata). */
export async function apagarTodosExceto(usuario) {
  await consultar('DELETE FROM usuarios WHERE usuario <> $1', [usuario]);
}

/** Cria o usuário ou, se ele já existir, atualiza o nome e a senha. */
export async function salvar({ usuario, nome, senhaHash }) {
  await consultar(
    `INSERT INTO usuarios (usuario, nome, senha_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (usuario) DO UPDATE SET nome = EXCLUDED.nome, senha_hash = EXCLUDED.senha_hash`,
    [usuario, nome, senhaHash],
  );
}
