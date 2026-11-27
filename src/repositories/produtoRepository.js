/**
 * Acesso aos dados de produtos. Cada produto já vem com o nome e o prazo de entrega
 * do seu fornecedor (JOIN), porque a interface e a previsão sempre precisam deles.
 */
import { consultar } from '../database/conexao.js';

const COLUNAS = `
  p.id,
  p.fornecedor_id       AS "fornecedorId",
  f.razao_social        AS "fornecedorNome",
  f.prazo_entrega_dias  AS "prazoEntregaDias",
  p.nome,
  p.unidade,
  p.quantidade_estoque  AS "quantidadeEstoque",
  p.estoque_minimo      AS "estoqueMinimo",
  p.preco_custo         AS "precoCusto",
  p.criado_em           AS "criadoEm",
  p.atualizado_em       AS "atualizadoEm"`;

const DE_PRODUTOS_COM_FORNECEDOR = 'FROM produtos p JOIN fornecedores f ON f.id = p.fornecedor_id';

function valoresParaGravar(produto) {
  return [
    produto.fornecedorId,
    produto.nome,
    produto.unidade,
    produto.quantidadeEstoque,
    produto.estoqueMinimo,
    produto.precoCusto,
  ];
}

export async function listarTodos() {
  const { rows } = await consultar(`SELECT ${COLUNAS} ${DE_PRODUTOS_COM_FORNECEDOR} ORDER BY p.nome`);
  return rows;
}

export async function listarPorFornecedor(fornecedorId) {
  const { rows } = await consultar(
    `SELECT ${COLUNAS} ${DE_PRODUTOS_COM_FORNECEDOR} WHERE p.fornecedor_id = $1 ORDER BY p.nome`,
    [fornecedorId],
  );
  return rows;
}

export async function buscarPorId(id, executor) {
  const { rows } = await consultar(`SELECT ${COLUNAS} ${DE_PRODUTOS_COM_FORNECEDOR} WHERE p.id = $1`, [id], executor);
  return rows[0] ?? null;
}

/** Como buscarPorId, mas trava a linha do produto até o fim da transação (FOR UPDATE). */
export async function buscarParaAtualizar(id, transacao) {
  const { rows } = await consultar(
    `SELECT ${COLUNAS} ${DE_PRODUTOS_COM_FORNECEDOR} WHERE p.id = $1 FOR UPDATE OF p`,
    [id],
    transacao,
  );
  return rows[0] ?? null;
}

export async function inserir(produto) {
  const { rows } = await consultar(
    `INSERT INTO produtos (fornecedor_id, nome, unidade, quantidade_estoque, estoque_minimo, preco_custo)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    valoresParaGravar(produto),
  );
  return buscarPorId(rows[0].id);
}

export async function atualizar(id, produto) {
  await consultar(
    `UPDATE produtos
        SET fornecedor_id = $1, nome = $2, unidade = $3, quantidade_estoque = $4,
            estoque_minimo = $5, preco_custo = $6, atualizado_em = NOW()
      WHERE id = $7`,
    [...valoresParaGravar(produto), id],
  );
  return buscarPorId(id);
}

export async function excluir(id) {
  const { rowCount } = await consultar('DELETE FROM produtos WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function contarPorFornecedor(fornecedorId) {
  const { rows } = await consultar('SELECT COUNT(*)::int AS total FROM produtos WHERE fornecedor_id = $1', [fornecedorId]);
  return rows[0].total;
}

/**
 * Soma (entrada) ou subtrai (saída) do estoque numa única instrução SQL.
 * A condição "quantidade_estoque + variação >= 0" garante, mesmo com dois usuários
 * ao mesmo tempo, que o estoque nunca fique negativo; numa entrada, o estoque também
 * não passa do limite aceito no cadastro. Devolve false se não alterou.
 */
export async function ajustarEstoque(id, variacao, limite, executor) {
  const { rowCount } = await consultar(
    `UPDATE produtos
        SET quantidade_estoque = quantidade_estoque + $2, atualizado_em = NOW()
      WHERE id = $1
        AND quantidade_estoque + $2 >= 0
        AND ($2 <= 0 OR quantidade_estoque + $2 <= $3)`,
    [id, variacao, limite],
    executor,
  );
  return rowCount === 1;
}
