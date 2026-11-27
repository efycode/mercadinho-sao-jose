/**
 * Telas de "nada aqui ainda" e de erro. Sempre dizem o que aconteceu e o próximo passo.
 */
import { html } from '/shared/html.js';

/** acao = { href, texto } (opcional). */
export function estadoVazio({ titulo, texto, acao }) {
  return html`
    <div class="estado folha">
      <h2>${titulo}</h2>
      <p>${texto}</p>
      ${acao && html`<a class="botao botao--primario" href="${acao.href}">${acao.texto}</a>`}
    </div>`;
}

export function estadoDeErro(erro) {
  const naoEncontrado = erro?.status === 404;
  return html`
    <div class="estado folha" role="alert">
      <h2 tabindex="-1">${naoEncontrado ? 'Não encontramos o que você procurava' : 'Não foi possível carregar esta tela'}</h2>
      <p>${erro?.message ?? 'Erro inesperado.'}</p>
      <div class="acoes">
        ${!naoEncontrado && html`<button class="botao botao--primario" type="button" data-tentar-novamente>Tentar de novo</button>`}
        <a class="botao botao--secundario" href="#/">Ir para o painel</a>
      </div>
    </div>`;
}
