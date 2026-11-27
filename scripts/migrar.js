/**
 * npm run db:migrar → cria as tabelas no banco apontado por DATABASE_URL.
 * (O servidor também faz isso sozinho ao iniciar; este script é útil para conferir a conexão.)
 */
import { aplicarMigracoes } from '../src/database/migracao.js';
import { encerrarConexoes } from '../src/database/conexao.js';

try {
  await aplicarMigracoes();
  console.log('Estrutura do banco criada/atualizada com sucesso.');
} catch (erro) {
  console.error('Falha ao criar a estrutura do banco:', erro.message);
  process.exitCode = 1;
} finally {
  await encerrarConexoes();
}
