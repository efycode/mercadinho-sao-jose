/**
 * Montagem de HTML com proteção contra XSS.
 *
 * Uso: html`<p>${nomeDigitadoPeloUsuario}</p>`
 * Todo valor interpolado é escapado (< vira &lt; etc.). Trechos criados com html``
 * podem ser aninhados sem escape duplo, porque já são considerados seguros.
 */

const MARCA_DE_HTML_SEGURO = Symbol('htmlSeguro');

const ENTIDADES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

export function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (caractere) => ENTIDADES[caractere]);
}

function criarHtmlSeguro(texto) {
  return { [MARCA_DE_HTML_SEGURO]: true, texto, toString: () => texto };
}

function converterValor(valor) {
  if (valor === null || valor === undefined || valor === false) return '';
  if (Array.isArray(valor)) return valor.map(converterValor).join('');
  if (valor[MARCA_DE_HTML_SEGURO]) return valor.texto;
  return escaparHtml(valor);
}

export function html(partes, ...valores) {
  const texto = partes.reduce(
    (acumulado, parte, indice) => acumulado + parte + (indice < valores.length ? converterValor(valores[indice]) : ''),
    '',
  );
  return criarHtmlSeguro(texto);
}

/** Marca como seguro um HTML fixo escrito pelo próprio sistema (nunca use com dados do usuário). */
export function htmlConfiavel(texto) {
  return criarHtmlSeguro(String(texto));
}
