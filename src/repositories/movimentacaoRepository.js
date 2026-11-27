/**
 * Acesso ao histórico de movimentações (entradas e saídas de estoque).
 * As consultas agregadas recebem vários produtos de uma vez (produto_id = ANY($1)),
 * assim o painel calcula a previsão de todos os produtos com poucas idas ao banco.
 */
import { consultar } from '../database/conexao.js';

const COLUNAS = `
  id,
  produto_id  AS "produtoId",
  tipo,
  quantidade,
  data,
  observacao,
  criado_em   AS "criadoEm"`;

export async function inserir({ produtoId, tipo, quantidade, data, observacao }, executor) {
  const { rows } = await consultar(
    `INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, data, observacao)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUNAS}`,
    [produtoId, tipo, quantidade, data, observacao],
    executor,
  );
  return rows[0];
}

/** Insere muitas movimentações numa única instrução (usado pelos dados de demonstração). */
export async function inserirEmLote(movimentacoes, executor) {
  if (movimentacoes.length === 0) return;
  await consultar(
    `INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, data, observacao)
     SELECT * FROM UNNEST($1::int[], $2::varchar[], $3::int[], $4::date[], $5::varchar[])`,
    [
      movimentacoes.map((m) => m.produtoId),
      movimentacoes.map((m) => m.tipo),
      movimentacoes.map((m) => m.quantidade),
      movimentacoes.map((m) => m.data),
      movimentacoes.map((m) => m.observacao ?? null),
    ],
    executor,
  );
}

export async function listarPorProduto(produtoId, limite = 30) {
  const { rows } = await consultar(
    `SELECT ${COLUNAS} FROM movimentacoes_estoque
      WHERE produto_id = $1
      ORDER BY data DESC, id DESC
      LIMIT $2`,
    [produtoId, limite],
  );
  return rows;
}

/** Total de saídas por produto e por mês, apenas de meses anteriores a "antesDe". */
export async function somarSaidasPorMes(produtoIds, antesDe) {
  const { rows } = await consultar(
    `SELECT produto_id AS "produtoId", TO_CHAR(data, 'YYYY-MM') AS mes, SUM(quantidade)::int AS total
       FROM movimentacoes_estoque
      WHERE tipo = 'saida' AND produto_id = ANY($1::int[]) AND data < $2
      GROUP BY produto_id, mes`,
    [produtoIds, antesDe],
  );
  return rows;
}

/** Total de saídas por produto e por dia, entre duas datas (inclusive). */
export async function somarSaidasPorDia(produtoIds, desde, ate) {
  const { rows } = await consultar(
    `SELECT produto_id AS "produtoId", data, SUM(quantidade)::int AS total
       FROM movimentacoes_estoque
      WHERE tipo = 'saida' AND produto_id = ANY($1::int[]) AND data BETWEEN $2 AND $3
      GROUP BY produto_id, data`,
    [produtoIds, desde, ate],
  );
  return rows;
}

/** Data da primeira movimentação de cada produto: marca o início do histórico. */
export async function buscarInicioDosHistoricos(produtoIds) {
  const { rows } = await consultar(
    `SELECT produto_id AS "produtoId", MIN(data) AS inicio
       FROM movimentacoes_estoque
      WHERE produto_id = ANY($1::int[])
      GROUP BY produto_id`,
    [produtoIds],
  );
  return rows;
}
