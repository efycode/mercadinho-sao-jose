/**
 * Camada HTTP do login: consulta, cria e encerra a sessão. O código da sessão vai e volta
 * num cookie HttpOnly (veja seguranca/cookies.js); o corpo da resposta nunca o contém.
 */
import { ambiente } from '../config/ambiente.js';
import { lerCookie, NOME_DO_COOKIE_DE_SESSAO, opcoesDoCookieDeSessao } from '../seguranca/cookies.js';
import * as sessaoService from '../services/sessaoService.js';

/** Usuário e senha mostrados na tela de login, para a avaliação (desligável na configuração). */
function acessoDeDemonstracao() {
  return ambiente.acesso.mostrarNaTelaDeLogin
    ? { usuario: ambiente.acesso.usuario, senha: ambiente.acesso.senha }
    : null;
}

export async function consultar(requisicao, resposta) {
  const usuario = await sessaoService.buscarUsuarioDaSessao(lerCookie(requisicao, NOME_DO_COOKIE_DE_SESSAO));
  resposta.json({
    autenticado: Boolean(usuario),
    usuario: usuario && { usuario: usuario.usuario, nome: usuario.nome },
    acessoDeDemonstracao: usuario ? null : acessoDeDemonstracao(),
  });
}

export async function entrar(requisicao, resposta) {
  const { codigo, expiraEm, usuario } = await sessaoService.entrar(requisicao.body);
  resposta.cookie(NOME_DO_COOKIE_DE_SESSAO, codigo, opcoesDoCookieDeSessao({ expiraEm }));
  resposta.json({ autenticado: true, usuario });
}

export async function sair(requisicao, resposta) {
  await sessaoService.sair(lerCookie(requisicao, NOME_DO_COOKIE_DE_SESSAO));
  resposta.clearCookie(NOME_DO_COOKIE_DE_SESSAO, opcoesDoCookieDeSessao());
  resposta.status(204).end();
}
