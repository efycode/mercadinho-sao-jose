/**
 * Quem está usando o sistema, do lado da interface.
 *
 * Guarda só o nome e o usuário. O código da sessão fica num cookie HttpOnly, que o JavaScript
 * não consegue ler, e quem decide o acesso aos dados é sempre o serviço Web (middleware
 * exigirLogin). Aqui só se decide o que mostrar: o menu e o botão "Sair" aparecem no topo
 * apenas para quem entrou.
 */
import { consultarSessao } from './api/sessaoApi.js';

let usuarioAtual = null;
let acessoDeDemonstracao = null;
let caminhoPretendido = null;

export const usuarioLogado = () => usuarioAtual;

/**
 * O serviço só informa o acesso de avaliação a quem não está logado. Se a página abriu já com
 * sessão e depois a pessoa saiu (ou a sessão venceu), o acesso é buscado agora, para o quadro
 * aparecer na tela de login sem precisar recarregar a página.
 */
export async function obterAcessoDeDemonstracao() {
  if (!acessoDeDemonstracao && !usuarioAtual) {
    try {
      acessoDeDemonstracao = (await consultarSessao()).acessoDeDemonstracao ?? null;
    } catch {
      // sem resposta do serviço, a tela de login aparece sem o quadro
    }
  }
  return acessoDeDemonstracao;
}

/** Pergunta ao serviço se já existe sessão (ex.: a pessoa recarregou a página). */
export async function carregarSessao() {
  try {
    const sessao = await consultarSessao();
    usuarioAtual = sessao.usuario;
    acessoDeDemonstracao = sessao.acessoDeDemonstracao;
  } catch {
    usuarioAtual = null; // sem resposta do serviço: a tela de login mostra o erro ao tentar entrar
  }
  atualizarTopo();
}

export function definirUsuario(usuario) {
  usuarioAtual = usuario;
  atualizarTopo();
}

export function esquecerUsuario() {
  usuarioAtual = null;
  atualizarTopo();
}

/** Lembra a tela que a pessoa tentou abrir antes do login, para levá-la até lá depois. */
export function guardarCaminhoPretendido(caminho) {
  if (caminho !== '/login') caminhoPretendido = caminho;
}

export function retirarCaminhoPretendido() {
  const caminho = caminhoPretendido ?? '/';
  caminhoPretendido = null;
  return caminho;
}

function atualizarTopo() {
  const logado = Boolean(usuarioAtual);
  document.querySelector('[data-menu]').hidden = !logado;
  document.querySelector('[data-usuario-logado]').hidden = !logado;
  document.querySelector('[data-nome-do-usuario]').textContent = usuarioAtual?.nome ?? '';
}
