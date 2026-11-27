/**
 * Barra as rotas da API para quem não entrou no sistema (HTTP 401).
 * A interface esconde as telas, mas quem protege os dados de verdade é este middleware:
 * sem ele, qualquer pessoa poderia chamar a API diretamente.
 */
import { ErroDeAutenticacao } from '../errors/errosDaAplicacao.js';
import { lerCookie, NOME_DO_COOKIE_DE_SESSAO } from '../seguranca/cookies.js';
import { buscarUsuarioDaSessao } from '../services/sessaoService.js';

export async function exigirLogin(requisicao, resposta, proximo) {
  const usuario = await buscarUsuarioDaSessao(lerCookie(requisicao, NOME_DO_COOKIE_DE_SESSAO));
  if (!usuario) throw new ErroDeAutenticacao();
  requisicao.usuario = usuario;
  proximo();
}
