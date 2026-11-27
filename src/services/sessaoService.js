/**
 * Regras de acesso ao sistema: entrar, sair e descobrir quem é o dono de uma sessão.
 */
import { createHash, randomBytes } from 'node:crypto';
import { REGRAS_DO_LOGIN } from '../../shared/validacao.js';
import { ErroDeAutenticacao } from '../errors/errosDaAplicacao.js';
import * as sessaoRepository from '../repositories/sessaoRepository.js';
import * as usuarioRepository from '../repositories/usuarioRepository.js';
import { conferirSenha, gerarHashDeSenha } from '../seguranca/senha.js';
import { normalizarEValidar } from './validacaoDeEntrada.js';

const DURACAO_DA_SESSAO_EM_MS = 8 * 60 * 60 * 1000; // um turno de trabalho

// A mesma mensagem para usuário inexistente e para senha errada: a resposta não revela
// quais usuários existem.
const MENSAGEM_DE_FALHA = 'Usuário ou senha inválidos.';

// Hash de uma senha aleatória, conferido quando o usuário não existe. Assim a resposta demora
// o mesmo tempo nos dois casos, e nem o tempo revela se o usuário existe.
let hashParaUsuarioInexistente;

const hashDoCodigo = (codigo) => createHash('sha256').update(codigo).digest('hex');

export async function entrar(dadosRecebidos) {
  const { usuario, senha } = normalizarEValidar(dadosRecebidos, REGRAS_DO_LOGIN);
  const registro = await usuarioRepository.buscarPorUsuario(usuario);
  hashParaUsuarioInexistente ??= await gerarHashDeSenha(randomBytes(16).toString('hex'));
  const senhaConfere = await conferirSenha(senha, registro?.senhaHash ?? hashParaUsuarioInexistente);
  if (!registro || !senhaConfere) throw new ErroDeAutenticacao(MENSAGEM_DE_FALHA);

  await sessaoRepository.apagarVencidas();
  const codigo = randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + DURACAO_DA_SESSAO_EM_MS);
  await sessaoRepository.criar({ tokenHash: hashDoCodigo(codigo), usuarioId: registro.id, expiraEm });
  return { codigo, expiraEm, usuario: { usuario: registro.usuario, nome: registro.nome } };
}

/** Dono da sessão, ou null se não houver sessão válida. Sem código, nem consulta o banco. */
export async function buscarUsuarioDaSessao(codigo) {
  if (!codigo) return null;
  return sessaoRepository.buscarUsuario(hashDoCodigo(codigo));
}

export async function sair(codigo) {
  if (codigo) await sessaoRepository.apagar(hashDoCodigo(codigo));
}

/**
 * Deixa o acesso igual ao da configuração (LOGIN_USUARIO, LOGIN_SENHA e LOGIN_NOME) a cada subida.
 * - Senha trocada: grava o novo hash e encerra as sessões abertas com a senha antiga.
 * - Usuário trocado: o anterior é removido, para o acesso antigo não continuar valendo.
 */
export async function garantirUsuarioInicial({ usuario, senha, nome }) {
  const atual = await usuarioRepository.buscarPorUsuario(usuario);
  const senhaMudou = !atual || !(await conferirSenha(senha, atual.senhaHash));
  if (senhaMudou || atual.nome !== nome) {
    await usuarioRepository.salvar({ usuario, nome, senhaHash: senhaMudou ? await gerarHashDeSenha(senha) : atual.senhaHash });
  }
  if (atual && senhaMudou) await sessaoRepository.apagarDoUsuario(atual.id);
  await usuarioRepository.apagarTodosExceto(usuario);
}
