import { readFile } from 'node:fs/promises';
import { consultar } from './conexao.js';

/** Cria as tabelas e índices que ainda não existem (lê o arquivo schema.sql). */
export async function aplicarMigracoes() {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await consultar(sql);
}
