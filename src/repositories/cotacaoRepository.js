/**
 * Acesso aos pedidos de cotação. O índice único parcial do banco garante no máximo
 * uma cotação em aberto por produto; "inserirSeNaoHouverAberta" se apoia nele.
 */
import { consultar } from '../database/conexao.js';

export const STATUS_EM_ABERTO = Object.freeze(['pendente', 'enviada', 'falha_envio']);

const COLUNAS = `
  c.id,
  c.produto_id           AS "produtoId",
  p.nome                 AS "produtoNome",
  p.unidade              AS "produtoUnidade",
  c.fornecedor_id        AS "fornecedorId",
  f.razao_social         AS "fornecedorNome",
  c.quantidade_sugerida  AS "quantidadeSugerida",
  c.status,
  c.origem,
  c.email_destino        AS "emailDestino",
  c.assunto,
  c.corpo_texto          AS "corpoTexto",
  c.modo_envio           AS "modoDeEnvio",
  c.erro_envio           AS "erroDeEnvio",
  c.criada_em            AS "criadaEm",
  c.enviada_em           AS "enviadaEm",
  c.atualizada_em        AS "atualizadaEm"`;

const DE_COTACOES = `
  FROM cotacoes c
  JOIN produtos p ON p.id = c.produto_id
  JOIN fornecedores f ON f.id = c.fornecedor_id`;

export async function listar({ status = null, produtoId = null, limite = 100 } = {}) {
  const { rows } = await consultar(
    `SELECT ${COLUNAS} ${DE_COTACOES}
      WHERE ($1::text[] IS NULL OR c.status = ANY($1))
        AND ($2::int IS NULL OR c.produto_id = $2)
      ORDER BY c.criada_em DESC, c.id DESC
      LIMIT $3`,
    [status, produtoId, limite],
  );
  return rows;
}

export async function buscarPorId(id) {
  const { rows } = await consultar(`SELECT ${COLUNAS}, c.corpo_html AS "corpoHtml" ${DE_COTACOES} WHERE c.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function buscarAbertaDoProduto(produtoId) {
  const { rows } = await consultar(
    `SELECT ${COLUNAS} ${DE_COTACOES} WHERE c.produto_id = $1 AND c.status = ANY($2) LIMIT 1`,
    [produtoId, STATUS_EM_ABERTO],
  );
  return rows[0] ?? null;
}

/** Ids dos produtos que já têm cotação em aberto (para a interface não oferecer outra). */
export async function listarProdutosComCotacaoAberta() {
  const { rows } = await consultar('SELECT produto_id AS "produtoId" FROM cotacoes WHERE status = ANY($1)', [STATUS_EM_ABERTO]);
  return new Set(rows.map((linha) => linha.produtoId));
}

/** Cria a cotação e devolve o id, ou null se o produto já tinha uma em aberto. */
export async function inserirSeNaoHouverAberta(cotacao, executor) {
  const { rows } = await consultar(
    `INSERT INTO cotacoes
       (produto_id, fornecedor_id, quantidade_sugerida, origem, email_destino, assunto, corpo_texto, corpo_html, modo_envio)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (produto_id) WHERE status IN ('pendente', 'enviada', 'falha_envio') DO NOTHING
     RETURNING id`,
    [
      cotacao.produtoId,
      cotacao.fornecedorId,
      cotacao.quantidadeSugerida,
      cotacao.origem,
      cotacao.emailDestino,
      cotacao.assunto,
      cotacao.corpoTexto,
      cotacao.corpoHtml,
      cotacao.modoDeEnvio,
    ],
    executor,
  );
  return rows[0]?.id ?? null;
}

export async function registrarResultadoDoEnvio(id, { status, modoDeEnvio, erroDeEnvio = null }) {
  await consultar(
    `UPDATE cotacoes
        SET status = $2::text, modo_envio = $3, erro_envio = $4, atualizada_em = NOW(),
            enviada_em = CASE WHEN $2::text = 'enviada' THEN NOW() ELSE enviada_em END
      WHERE id = $1`,
    [id, status, modoDeEnvio, erroDeEnvio?.slice(0, 500) ?? null],
  );
  return buscarPorId(id);
}

export async function alterarStatus(id, status) {
  await consultar('UPDATE cotacoes SET status = $2, atualizada_em = NOW() WHERE id = $1', [id, status]);
  return buscarPorId(id);
}

/**
 * Fecha as cotações em aberto do produto: "concluida" quando o estoque volta acima do mínimo,
 * "cancelada" quando o produto passa para outro fornecedor.
 */
export async function encerrarAbertasDoProduto(produtoId, status, executor) {
  const { rowCount } = await consultar(
    `UPDATE cotacoes SET status = $3, atualizada_em = NOW()
      WHERE produto_id = $1 AND status = ANY($2)`,
    [produtoId, STATUS_EM_ABERTO, status],
    executor,
  );
  return rowCount;
}

/** Quantos e-mails reais (não simulados) saíram nas últimas 24 horas. */
export async function contarEnviosReaisRecentes() {
  const { rows } = await consultar(
    `SELECT COUNT(*)::int AS total FROM cotacoes
      WHERE modo_envio <> 'simulacao' AND enviada_em >= NOW() - INTERVAL '24 hours'`,
  );
  return rows[0].total;
}

export async function contarAbertas() {
  const { rows } = await consultar('SELECT COUNT(*)::int AS total FROM cotacoes WHERE status = ANY($1)', [STATUS_EM_ABERTO]);
  return rows[0].total;
}
