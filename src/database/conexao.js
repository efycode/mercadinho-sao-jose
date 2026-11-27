/**
 * Conexão com o PostgreSQL usando um pool (conjunto de conexões reaproveitadas).
 * Todas as consultas do sistema passam por aqui, sempre com parâmetros ($1, $2...),
 * o que impede ataques de SQL injection.
 */
import pg from 'pg';
import { ambiente } from '../config/ambiente.js';

const TIPO_DATE = 1082;
const TIPO_NUMERIC = 1700;
const TIPO_BIGINT = 20;

// DATE continua como texto "AAAA-MM-DD" (evita mudar o dia por causa do fuso horário).
pg.types.setTypeParser(TIPO_DATE, (valor) => valor);
pg.types.setTypeParser(TIPO_NUMERIC, (valor) => Number.parseFloat(valor));
pg.types.setTypeParser(TIPO_BIGINT, (valor) => Number.parseInt(valor, 10));

if (!ambiente.urlDoBancoDeDados) {
  console.error(
    'A variável DATABASE_URL não foi definida. No Render, cadastre-a em Environment; no computador, copie .env.example para .env.',
  );
  process.exit(1);
}

export const pool = new pg.Pool({
  connectionString: ambiente.urlDoBancoDeDados,
  max: 5,
  idleTimeoutMillis: 10_000, // fecha conexões paradas há 10 s, para o Neon poder "dormir" sem uso
  connectionTimeoutMillis: 15_000, // dá tempo de o Neon "acordar" antes de avisar o erro
});

// Sem este tratamento, uma conexão ociosa encerrada pelo servidor derrubaria a aplicação.
pool.on('error', (erro) => {
  console.warn('Uma conexão ociosa com o banco foi encerrada:', erro.message);
});

/** Executa uma consulta. "executor" permite participar de uma transação já aberta. */
export function consultar(sql, parametros = [], executor = pool) {
  return executor.query(sql, parametros);
}

/** Executa várias operações como uma só: ou todas são gravadas, ou nenhuma é. */
export async function comTransacao(operacoes) {
  const cliente = await pool.connect();
  let conexaoQuebrada = null;
  try {
    await cliente.query('BEGIN');
    const resultado = await operacoes(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    // Se nem o ROLLBACK funcionar, a conexão caiu: ela é descartada em vez de voltar ao pool.
    await cliente.query('ROLLBACK').catch((falha) => {
      conexaoQuebrada = falha;
    });
    throw erro;
  } finally {
    cliente.release(conexaoQuebrada ?? undefined);
  }
}

export function encerrarConexoes() {
  return pool.end();
}
