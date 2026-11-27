import { ErroDeValidacao } from '../errors/errosDaAplicacao.js';
import { LIMITES } from '../../shared/validacao.js';

/** Só dígitos, sem zero à esquerda, e dentro do que uma coluna INTEGER do banco comporta. */
function ehIdentificadorValido(texto) {
  return /^[1-9]\d{0,9}$/.test(texto) && Number(texto) <= LIMITES.maiorId;
}

/** Lê um identificador numérico da URL (ex.: /api/fornecedores/7) e recusa valores inválidos. */
export function lerId(requisicao, nome = 'id') {
  const texto = String(requisicao.params[nome]);
  if (!ehIdentificadorValido(texto)) {
    throw new ErroDeValidacao(`O identificador "${texto}" na URL é inválido.`);
  }
  return Number(texto);
}

/** Lê um identificador opcional da query string (ex.: ?produtoId=3). */
export function lerIdOpcional(valor) {
  if (valor === undefined || valor === '') return null;
  const texto = String(valor);
  if (!ehIdentificadorValido(texto)) throw new ErroDeValidacao(`O identificador "${texto}" é inválido.`);
  return Number(texto);
}
