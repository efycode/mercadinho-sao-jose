/**
 * Peças de formulário reaproveitadas por todas as telas de cadastro.
 * A validação usa as mesmas regras do serviço (shared/validacao.js): o erro aparece
 * quando a pessoa sai do campo e de novo ao enviar. Se o serviço recusar algo
 * (ex.: CNPJ já cadastrado), a mensagem dele aparece no campo certo.
 */
import { html, htmlConfiavel } from '/shared/html.js';
import { temErros } from '/shared/validacao.js';
import { notificar } from './notificacoes.js';

function rotuloDoCampo(rotulo, obrigatorio) {
  return obrigatorio
    ? html`${rotulo} <span aria-hidden="true">*</span>`
    : html`${rotulo} <span class="campo__opcional">(opcional)</span>`;
}

function idsDescritivos(nome, dica) {
  return [dica ? `${nome}-dica` : '', `${nome}-erro`].filter(Boolean).join(' ');
}

function rodapeDoCampo(nome, dica) {
  return html`
    ${dica && html`<p class="campo__dica" id="${nome}-dica">${dica}</p>`}
    <p class="campo__erro" id="${nome}-erro" hidden></p>`;
}

/** Campo de texto, número, e-mail ou data. "atributos" recebe atributos HTML fixos do próprio sistema. */
export function campo({ nome, rotulo, tipo = 'text', valor = '', dica = '', obrigatorio = false, atributos = '' }) {
  return html`
    <div class="campo" data-campo="${nome}">
      <label for="${nome}">${rotuloDoCampo(rotulo, obrigatorio)}</label>
      <input id="${nome}" name="${nome}" type="${tipo}" value="${valor ?? ''}"
        aria-describedby="${idsDescritivos(nome, dica)}" ${obrigatorio && htmlConfiavel('aria-required="true"')} ${htmlConfiavel(atributos)}>
      ${rodapeDoCampo(nome, dica)}
    </div>`;
}

/** Lista de opções: opcoes = [{ valor, texto }]. */
export function campoDeSelecao({ nome, rotulo, opcoes, valor = '', dica = '', obrigatorio = false }) {
  return html`
    <div class="campo" data-campo="${nome}">
      <label for="${nome}">${rotuloDoCampo(rotulo, obrigatorio)}</label>
      <select id="${nome}" name="${nome}" aria-describedby="${idsDescritivos(nome, dica)}" ${obrigatorio && htmlConfiavel('aria-required="true"')}>
        <option value="">Selecione</option>
        ${opcoes.map(
          (opcao) => html`<option value="${opcao.valor}" ${String(opcao.valor) === String(valor) && htmlConfiavel('selected')}>${opcao.texto}</option>`,
        )}
      </select>
      ${rodapeDoCampo(nome, dica)}
    </div>`;
}

/** Botões de escolha única (rádio), usados em entrada/saída. opcoes = [{ valor, texto }]. */
export function campoDeOpcoes({ nome, rotulo, opcoes, valor }) {
  return html`
    <fieldset class="campo campo--opcoes" data-campo="${nome}" aria-describedby="${nome}-erro">
      <legend>${rotulo}</legend>
      <div class="opcoes">
        ${opcoes.map(
          (opcao) => html`
            <label class="opcao">
              <input type="radio" name="${nome}" value="${opcao.valor}" ${opcao.valor === valor && htmlConfiavel('checked')}>
              <span>${opcao.texto}</span>
            </label>`,
        )}
      </div>
      <p class="campo__erro" id="${nome}-erro" hidden></p>
    </fieldset>`;
}

/** Reformata o valor enquanto a pessoa digita (ex.: CNPJ e telefone). */
export function aplicarMascara(entrada, formatar) {
  entrada.addEventListener('input', () => {
    entrada.value = formatar(entrada.value);
  });
}

export function lerCampos(formulario) {
  return Object.fromEntries(new FormData(formulario));
}

function mostrarErroNoCampo(formulario, nome, mensagem) {
  const bloco = formulario.querySelector(`[data-campo="${nome}"]`);
  if (!bloco) return;
  const areaDoErro = bloco.querySelector('.campo__erro');
  areaDoErro.textContent = mensagem ?? '';
  areaDoErro.hidden = !mensagem;
  for (const controle of bloco.querySelectorAll('input, select, textarea')) {
    if (mensagem) controle.setAttribute('aria-invalid', 'true');
    else controle.removeAttribute('aria-invalid');
  }
}

function mostrarErros(formulario, erros) {
  for (const bloco of formulario.querySelectorAll('[data-campo]')) {
    mostrarErroNoCampo(formulario, bloco.dataset.campo, erros[bloco.dataset.campo]);
  }
  formulario.querySelector('[aria-invalid="true"]')?.focus();
}

async function executarComBotaoOcupado(formulario, textoOcupado, operacao) {
  const botao = formulario.querySelector('[type="submit"]');
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = textoOcupado;
  try {
    await operacao();
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

/** Ao corrigir um campo, a mensagem de erro dele some na hora, sem esperar a pessoa sair do campo. */
function limparErroAoCorrigir(formulario, validar) {
  formulario.addEventListener('input', (evento) => {
    const { name: nome, dataset } = evento.target;
    if (!nome) return;
    dataset.alterado = 'true';
    if (!validar().erros[nome]) mostrarErroNoCampo(formulario, nome, null);
  });
}

/**
 * Ao sair de um campo alterado (ou depois da primeira tentativa de envio), mostra o erro dele.
 * Indo direto para um botão ou link (Salvar, Cancelar), não mexe no layout: se uma mensagem
 * aparecesse ou sumisse nessa hora, o botão sairia de baixo do ponteiro entre apertar e soltar,
 * e o clique se perderia. O envio valida todos os campos de qualquer forma.
 */
function validarAoSairDoCampo(formulario, validar, jaTentouEnviar) {
  formulario.addEventListener('focusout', (evento) => {
    const { name: nome, dataset } = evento.target;
    if (!nome || (!jaTentouEnviar() && dataset.alterado !== 'true')) return;
    if (evento.relatedTarget?.closest('button, a')) return;
    mostrarErroNoCampo(formulario, nome, validar().erros[nome]);
  });
}

/** Envia os dados à API; se ela recusar, mostra as mensagens nos campos e num aviso. */
async function enviarMostrandoErrosDaApi(formulario, { enviar, textoOcupado }, dados) {
  await executarComBotaoOcupado(formulario, textoOcupado, async () => {
    try {
      await enviar(dados);
    } catch (erro) {
      if (erro.camposInvalidos) mostrarErros(formulario, erro.camposInvalidos);
      notificar({ tipo: 'erro', mensagem: erro.message });
    }
  });
}

/**
 * Liga validação e envio a um formulário.
 * @param {object} opcoes.regras    { normalizar, validar } de shared/validacao.js
 * @param {Function} opcoes.contexto devolve dados extras para a validação (ex.: estoque atual)
 * @param {Function} opcoes.enviar   recebe os dados já normalizados e chama a API
 * @param {string} opcoes.textoOcupado texto do botão enquanto a API responde
 */
export function prepararFormulario(formulario, { regras, contexto = () => ({}), enviar, textoOcupado = 'Salvando…' }) {
  let tentouEnviar = false;
  const validar = () => {
    const dados = regras.normalizar(lerCampos(formulario));
    return { dados, erros: regras.validar(dados, contexto()) };
  };
  limparErroAoCorrigir(formulario, validar);
  validarAoSairDoCampo(formulario, validar, () => tentouEnviar);

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    tentouEnviar = true;
    const { dados, erros } = validar();
    mostrarErros(formulario, erros);
    if (temErros(erros)) {
      notificar({ tipo: 'erro', mensagem: 'Revise os campos destacados em vermelho.' });
      return;
    }
    await enviarMostrandoErrosDaApi(formulario, { enviar, textoOcupado }, dados);
  });
}
