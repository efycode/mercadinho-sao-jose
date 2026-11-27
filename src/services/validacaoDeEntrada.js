import { temErros } from '../../shared/validacao.js';
import { ErroDeValidacao } from '../errors/errosDaAplicacao.js';

/**
 * Limpa os dados recebidos e aplica as regras compartilhadas com a interface.
 * Se houver erro, interrompe a operação com HTTP 400 e a mensagem de cada campo.
 */
export function normalizarEValidar(dadosRecebidos, { normalizar, validar }, contexto) {
  const dados = normalizar(dadosRecebidos ?? {});
  const erros = validar(dados, contexto);
  if (temErros(erros)) throw new ErroDeValidacao(undefined, erros);
  return dados;
}
