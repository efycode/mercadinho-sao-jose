/**
 * Janela modal usando o elemento nativo <dialog>, que já prende o foco do teclado
 * e fecha com a tecla Esc. Um único <dialog> (em index.html) é reaproveitado.
 */
import { html } from '/shared/html.js';

function abrir(conteudo) {
  const dialogo = document.getElementById('dialogo');
  dialogo.returnValue = '';
  dialogo.innerHTML = conteudo;
  return new Promise((resolver) => {
    dialogo.addEventListener('close', () => resolver(dialogo.returnValue), { once: true });
    dialogo.showModal();
  });
}

/** Pergunta antes de uma ação. Devolve true se a pessoa confirmou. */
export async function confirmar({ titulo, mensagem, textoDoBotao, perigoso = false }) {
  const resposta = await abrir(html`
    <form method="dialog" class="dialogo__conteudo">
      <h2 id="dialogo-titulo">${titulo}</h2>
      <p>${mensagem}</p>
      <div class="dialogo__acoes">
        <button class="botao botao--secundario" value="cancelar">Voltar</button>
        <button class="botao ${perigoso ? 'botao--perigo-cheio' : 'botao--primario'}" value="confirmar">${textoDoBotao}</button>
      </div>
    </form>`);
  return resposta === 'confirmar';
}

/** Mostra um e-mail de cotação exatamente como foi (ou seria) enviado. */
export async function mostrarEmail({ titulo, destinatario, assunto, texto }) {
  await abrir(html`
    <form method="dialog" class="dialogo__conteudo">
      <h2 id="dialogo-titulo">${titulo}</h2>
      <dl class="ficha">
        <div><dt>Para</dt><dd>${destinatario}</dd></div>
        <div><dt>Assunto</dt><dd>${assunto}</dd></div>
      </dl>
      <pre class="dialogo__email">${texto}</pre>
      <div class="dialogo__acoes">
        <button class="botao botao--primario" value="fechar">Fechar</button>
      </div>
    </form>`);
}
