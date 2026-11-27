/**
 * Acesso aos dados de fornecedores. Só esta camada conhece SQL e nomes de colunas;
 * os aliases ("razaoSocial" etc.) já entregam os objetos no formato usado pela API.
 */
import { consultar } from '../database/conexao.js';
import { somenteDigitos } from '../../shared/formatacao.js';

const COLUNAS = `
  f.id,
  f.razao_social        AS "razaoSocial",
  f.cnpj,
  f.email,
  f.telefone,
  f.nome_contato        AS "nomeContato",
  f.prazo_entrega_dias  AS "prazoEntregaDias",
  f.criado_em           AS "criadoEm",
  f.atualizado_em       AS "atualizadoEm"`;

function valoresParaGravar(fornecedor) {
  return [
    fornecedor.razaoSocial,
    fornecedor.cnpj,
    fornecedor.email,
    fornecedor.telefone,
    fornecedor.nomeContato,
    fornecedor.prazoEntregaDias,
  ];
}

const TAMANHO_MAXIMO_DA_BUSCA = 100;

/** % e _ são curingas no LIKE; escapados, são procurados como texto comum. */
function escaparCuringasDoLike(texto) {
  return texto.replace(/[\\%_]/g, '\\$&');
}

/** Busca por razão social, contato ou CNPJ (com ou sem pontuação). */
export async function listar({ busca = '' } = {}) {
  const textoBuscado = busca.trim().slice(0, TAMANHO_MAXIMO_DA_BUSCA);
  const termo = textoBuscado ? `%${escaparCuringasDoLike(textoBuscado)}%` : null;
  const digitos = somenteDigitos(textoBuscado);
  const termoDeCnpj = digitos.length >= 2 ? `%${digitos}%` : null;

  const { rows } = await consultar(
    `SELECT ${COLUNAS},
            COUNT(p.id)::int AS "totalDeProdutos",
            COUNT(p.id) FILTER (WHERE p.estoque_minimo > 0 AND p.quantidade_estoque <= p.estoque_minimo)::int
              AS "produtosNoMinimo"
       FROM fornecedores f
       LEFT JOIN produtos p ON p.fornecedor_id = f.id
      WHERE $1::text IS NULL
         OR f.razao_social ILIKE $1
         OR f.nome_contato ILIKE $1
         OR f.cnpj LIKE $2
      GROUP BY f.id
      ORDER BY f.razao_social`,
    [termo, termoDeCnpj],
  );
  return rows;
}

export async function buscarPorId(id) {
  const { rows } = await consultar(`SELECT ${COLUNAS} FROM fornecedores f WHERE f.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function buscarPorCnpj(cnpj) {
  const { rows } = await consultar(`SELECT ${COLUNAS} FROM fornecedores f WHERE f.cnpj = $1`, [cnpj]);
  return rows[0] ?? null;
}

export async function inserir(fornecedor) {
  const { rows } = await consultar(
    `INSERT INTO fornecedores AS f (razao_social, cnpj, email, telefone, nome_contato, prazo_entrega_dias)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUNAS}`,
    valoresParaGravar(fornecedor),
  );
  return rows[0];
}

export async function atualizar(id, fornecedor) {
  const { rows } = await consultar(
    `UPDATE fornecedores AS f
        SET razao_social = $1, cnpj = $2, email = $3, telefone = $4,
            nome_contato = $5, prazo_entrega_dias = $6, atualizado_em = NOW()
      WHERE f.id = $7
      RETURNING ${COLUNAS}`,
    [...valoresParaGravar(fornecedor), id],
  );
  return rows[0] ?? null;
}

export async function excluir(id) {
  const { rowCount } = await consultar('DELETE FROM fornecedores WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function contar() {
  const { rows } = await consultar('SELECT COUNT(*)::int AS total FROM fornecedores');
  return rows[0].total;
}
