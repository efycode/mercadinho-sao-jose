/**
 * Mapa de calor da sazonalidade: cada linha é um produto, cada coluna um mês.
 * Laranja = mês em que vende acima da média; azul = abaixo.
 */
import { html } from '/shared/html.js';
import { hojeIso, indiceDoMes, MESES_ABREVIADOS, NOMES_DOS_MESES } from '/shared/datas.js';
import { formatarNumero } from '/shared/formatacao.js';
import { classificarTemporada } from '/shared/temporada.js';
import { listarSazonalidade } from '../api/painelApi.js';
import { estadoVazio } from '../componentes/estados.js';

const VARIACAO_FORTE = Object.freeze({ acima: 1.5, abaixo: 0.5 });

function temVariacaoForte({ confiavel, indices }) {
  return confiavel && (Math.max(...indices) >= VARIACAO_FORTE.acima || Math.min(...indices) <= VARIACAO_FORTE.abaixo);
}

function intensidadeDa(temporada, indice) {
  if (temporada === 'alta') return Math.min(1, (indice - 1) / 1.2);
  if (temporada === 'baixa') return Math.min(1, (1 - indice) / 0.8);
  return 0;
}

function celula(indice, mes, mesAtual) {
  const temporada = classificarTemporada(indice);
  const intensidade = intensidadeDa(temporada, indice);
  const classes = [`celula--${temporada}`, temporada === 'alta' && intensidade > 0.55 ? 'celula--forte' : '', mes === mesAtual ? 'mes-atual' : '']
    .filter(Boolean)
    .join(' ');
  return html`<td class="${classes}" style="--intensidade: ${intensidade.toFixed(2)}" title="${NOMES_DOS_MESES[mes]}: ${formatarNumero(indice, 2)} vezes a média">${formatarNumero(indice, 1)}</td>`;
}

function linhaDoProduto(item, mesAtual) {
  const cabecalho = html`<th scope="row"><a href="#/produtos/${item.id}">${item.nome}</a><span class="texto-secundario">${item.fornecedorNome}</span></th>`;
  if (!item.confiavel) {
    return html`<tr>${cabecalho}<td colspan="12" class="texto-secundario">Histórico insuficiente: ${item.mesesAnalisados} de 12 meses completos.</td></tr>`;
  }
  return html`<tr>${cabecalho}${item.indices.map((indice, mes) => celula(indice, mes, mesAtual))}</tr>`;
}

function mapaDeCalor(itens, mesAtual) {
  if (itens.length === 0) {
    return estadoVazio({ titulo: 'Nenhum produto para mostrar', texto: 'Cadastre produtos e registre as vendas para ver a sazonalidade.' });
  }
  return html`
    <section class="tabela-rolavel" tabindex="0" aria-label="Mapa de sazonalidade (no celular, role para os lados)">
      <table class="tabela mapa-de-calor">
        <caption class="visualmente-oculto">Índice de vendas de cada produto em cada mês</caption>
        <thead><tr>
          <th scope="col">Produto</th>
          ${MESES_ABREVIADOS.map((nome, mes) => html`<th scope="col" class="${mes === mesAtual ? 'mes-atual' : ''}">${nome}</th>`)}
        </tr></thead>
        <tbody>${itens.map((item) => linhaDoProduto(item, mesAtual))}</tbody>
      </table>
    </section>`;
}

export async function paginaDeSazonalidade(destino) {
  destino.dataset.titulo = 'Sazonalidade';
  const itens = await listarSazonalidade();
  const mesAtual = indiceDoMes(hojeIso());
  const filtros = { fortes: itens.filter(temVariacaoForte), todos: itens };
  const filtroInicial = filtros.fortes.length > 0 ? 'fortes' : 'todos';

  destino.innerHTML = html`
    <header class="cabecalho-da-pagina">
      <div class="cabecalho-da-pagina__texto">
        <h1 tabindex="-1">Sazonalidade dos produtos</h1>
        <p class="subtitulo">Quanto cada produto vende em cada mês, comparado à média dele no ano: 1,0 é um mês comum, 2,0 é o dobro e 0,5 é a metade.
          O cálculo usa as saídas registradas e exige 12 meses completos de histórico.</p>
      </div>
    </header>
    <div class="secao__cabecalho">
      <div class="alternador" role="group" aria-label="Quais produtos mostrar">
        <button type="button" data-filtro="fortes" aria-pressed="${String(filtroInicial === 'fortes')}">Com variação forte (${filtros.fortes.length})</button>
        <button type="button" data-filtro="todos" aria-pressed="${String(filtroInicial === 'todos')}">Todos os produtos (${itens.length})</button>
      </div>
      <p class="legenda">
        <span><i class="amostra-alta"></i>vende acima da média</span>
        <span><i class="amostra-baixa"></i>vende abaixo da média</span>
        <span>contorno: ${NOMES_DOS_MESES[mesAtual]}, o mês atual</span>
      </p>
    </div>
    <div data-mapa>${mapaDeCalor(filtros[filtroInicial], mesAtual)}</div>`;

  destino.querySelector('.alternador').addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-filtro]');
    if (!botao) return;
    for (const opcao of destino.querySelectorAll('[data-filtro]')) opcao.setAttribute('aria-pressed', String(opcao === botao));
    destino.querySelector('[data-mapa]').innerHTML = mapaDeCalor(filtros[botao.dataset.filtro], mesAtual);
  });
}
