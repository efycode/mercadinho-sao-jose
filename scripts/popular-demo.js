/**
 * npm run db:popular → insere os dados de demonstração se o banco estiver vazio.
 * npm run db:recriar → APAGA TODOS OS DADOS e insere a demonstração de novo
 *                      (útil antes de gravar as capturas de tela do relatório).
 */
import { aplicarMigracoes } from '../src/database/migracao.js';
import { apagarTodosOsDados, popularDadosDemo, popularDadosDemoSeVazio } from '../src/database/dadosDemo.js';
import { encerrarConexoes } from '../src/database/conexao.js';

const recriar = process.argv.includes('--recriar');

try {
  await aplicarMigracoes();
  if (recriar) {
    await apagarTodosOsDados();
    const resumo = await popularDadosDemo();
    console.log(`Banco recriado: ${resumo.fornecedores} fornecedores, ${resumo.produtos} produtos, ${resumo.movimentacoes} movimentações.`);
  } else if (!(await popularDadosDemoSeVazio())) {
    console.log('O banco já tem fornecedores; nada foi alterado. Use "npm run db:recriar" para apagar e recriar.');
  }
} catch (erro) {
  console.error('Falha ao popular o banco:', erro.message);
  process.exitCode = 1;
} finally {
  await encerrarConexoes();
}
