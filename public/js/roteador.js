/**
 * Navegação entre telas pelo endereço depois do "#" (ex.: #/fornecedores/3/produtos).
 * Cada rota aponta para uma função de página que recebe um elemento vazio para preencher.
 * A tela nova só substitui a antiga quando terminou de carregar; se a pessoa navegar de novo
 * antes disso, o resultado antigo é descartado. Antes de abrir uma tela, o roteador pergunta a
 * verificarAcesso se a pessoa pode vê-la (ex.: sem login, só a tela de login é pública).
 */
import { estadoDeErro } from './componentes/estados.js';

const rotas = [];
let numeroDaNavegacao = 0;
let areaDeConteudo;
let verificarAcesso = () => null;

/** padrao: "/fornecedores/:id/produtos" (cada :nome vira um número da URL). publica: abre sem login. */
export function registrarRota(padrao, pagina, { publica = false } = {}) {
  const nomesDosParametros = [];
  const expressao = padrao.replace(/:(\w+)/g, (_, nome) => {
    nomesDosParametros.push(nome);
    return '(\\d+)';
  });
  rotas.push({ expressao: new RegExp(`^${expressao}$`), nomesDosParametros, pagina, publica });
}

/** verificarAcesso({ caminho, publica }) devolve o caminho para onde desviar, ou null para seguir. */
export function iniciarRoteador(elemento, opcoes = {}) {
  areaDeConteudo = elemento;
  if (opcoes.verificarAcesso) verificarAcesso = opcoes.verificarAcesso;
  window.addEventListener('hashchange', exibirRotaAtual);
  exibirRotaAtual();
}

export function navegarPara(caminho) {
  if (location.hash === `#${caminho}`) exibirRotaAtual();
  else location.hash = caminho;
}

export function recarregarRotaAtual() {
  return exibirRotaAtual({ manterRolagem: true });
}

function caminhoAtual() {
  const caminho = location.hash.replace(/^#/, '');
  return caminho.startsWith('/') ? caminho : '/';
}

function encontrarRota(caminho) {
  for (const { expressao, nomesDosParametros, pagina, publica } of rotas) {
    const correspondencia = caminho.match(expressao);
    if (correspondencia) {
      const parametros = Object.fromEntries(nomesDosParametros.map((nome, i) => [nome, Number(correspondencia[i + 1])]));
      return { pagina, parametros, publica };
    }
  }
  return null;
}

function paginaNaoEncontrada(destino) {
  destino.dataset.titulo = 'Página não encontrada';
  destino.innerHTML = estadoDeErro({ status: 404, message: 'Este endereço não existe no sistema. Use o menu acima.' });
}

function destacarMenu(caminho) {
  for (const item of document.querySelectorAll('[data-secao]')) {
    const secao = item.dataset.secao;
    const ativo = secao === '/' ? caminho === '/' : caminho.startsWith(secao) || (secao === '/fornecedores' && caminho.startsWith('/produtos'));
    if (ativo) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
}

async function exibirRotaAtual({ manterRolagem = false } = {}) {
  const caminho = caminhoAtual();
  const minhaNavegacao = ++numeroDaNavegacao;
  const { pagina, parametros, publica = false } = encontrarRota(caminho) ?? { pagina: paginaNaoEncontrada, parametros: {} };
  const desvio = verificarAcesso({ caminho, publica });
  if (desvio && desvio !== caminho) {
    location.replace(`#${desvio}`); // troca o endereço sem criar entrada no histórico
    return;
  }
  const destino = document.createElement('div');
  destino.className = 'pagina';
  areaDeConteudo.setAttribute('aria-busy', 'true');

  try {
    await pagina(destino, parametros);
  } catch (erro) {
    destino.dataset.titulo = 'Erro';
    destino.innerHTML = estadoDeErro(erro);
    destino.querySelector('[data-tentar-novamente]')?.addEventListener('click', () => recarregarRotaAtual());
  }

  if (minhaNavegacao !== numeroDaNavegacao) return; // a pessoa já foi para outra tela
  areaDeConteudo.replaceChildren(destino);
  areaDeConteudo.removeAttribute('aria-busy');
  document.title = `${destino.dataset.titulo ?? 'Início'} | Mercadinho São José`;
  destacarMenu(caminho);
  if (!manterRolagem) {
    window.scrollTo(0, 0);
    destino.querySelector('h1, h2')?.focus({ preventScroll: true });
  }
}
