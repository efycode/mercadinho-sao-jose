/**
 * Tela de login (#/login), a única que abre sem estar logado.
 * Usa o mesmo componente de formulário das outras telas e as regras de shared/validacao.js.
 */
import { html } from '/shared/html.js';
import { LIMITES, REGRAS_DO_LOGIN } from '/shared/validacao.js';
import { entrar } from '../api/sessaoApi.js';
import { campo, prepararFormulario } from '../componentes/formulario.js';
import { notificar } from '../componentes/notificacoes.js';
import { navegarPara } from '../roteador.js';
import { definirUsuario, obterAcessoDeDemonstracao, retirarCaminhoPretendido } from '../sessao.js';

function quadroDeAcessoDeDemonstracao(acesso) {
  return html`
    <aside class="entrada__demonstracao" aria-labelledby="titulo-demonstracao">
      <h2 id="titulo-demonstracao">Acesso para avaliação</h2>
      <p>Use estes dados para conhecer o sistema:</p>
      <dl class="entrada__credenciais">
        <dt>Usuário</dt><dd><code>${acesso.usuario}</code></dd>
        <dt>Senha</dt><dd><code>${acesso.senha}</code></dd>
      </dl>
      <button class="botao botao--secundario botao--pequeno" type="button" data-preencher>Preencher para mim</button>
    </aside>`;
}

function formularioDeLogin() {
  return html`
    <form class="formulario" novalidate>
      ${campo({
        nome: 'usuario',
        rotulo: 'Usuário',
        obrigatorio: true,
        atributos: `maxlength="${LIMITES.usuario}" autocomplete="username" autocapitalize="none" spellcheck="false"`,
      })}
      ${campo({
        nome: 'senha',
        rotulo: 'Senha',
        tipo: 'password',
        obrigatorio: true,
        atributos: `maxlength="${LIMITES.senha}" autocomplete="current-password"`,
      })}
      <div class="formulario__acoes">
        <button class="botao botao--primario" type="submit">Entrar</button>
      </div>
    </form>`;
}

/** "Preencher para mim": põe o acesso de avaliação nos campos e leva o foco ao botão Entrar. */
function ligarPreenchimentoAutomatico(destino, formulario, acesso) {
  destino.querySelector('[data-preencher]')?.addEventListener('click', () => {
    for (const nome of ['usuario', 'senha']) {
      formulario.elements[nome].value = acesso[nome];
      formulario.elements[nome].dispatchEvent(new Event('input', { bubbles: true })); // apaga erros antigos
    }
    formulario.querySelector('[type="submit"]').focus();
  });
}

async function entrarNoSistema(formulario, dados) {
  try {
    const resposta = await entrar(dados);
    definirUsuario(resposta.usuario);
    notificar({ tipo: 'sucesso', mensagem: `Olá, ${resposta.usuario.nome}!` });
    navegarPara(retirarCaminhoPretendido());
  } catch (erro) {
    formulario.elements.senha.value = ''; // nunca deixa uma senha recusada no campo
    throw erro;
  }
}

export async function paginaDeLogin(destino) {
  destino.dataset.titulo = 'Entrar';
  const acesso = await obterAcessoDeDemonstracao();
  destino.innerHTML = html`
    <section class="entrada">
      <div class="entrada__cartao folha">
        <h1 tabindex="-1">Entrar no sistema</h1>
        <p class="subtitulo">Acesso restrito à equipe do Mercadinho São José.</p>
        ${formularioDeLogin()}
      </div>
      ${acesso && quadroDeAcessoDeDemonstracao(acesso)}
    </section>`;

  const formulario = destino.querySelector('form');
  ligarPreenchimentoAutomatico(destino, formulario, acesso);
  prepararFormulario(formulario, {
    regras: REGRAS_DO_LOGIN,
    textoOcupado: 'Entrando…',
    enviar: (dados) => entrarNoSistema(formulario, dados),
  });
}
