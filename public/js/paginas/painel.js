/**
 * Painel: responde à pergunta do gerente "o que vai faltar e o que eu faço agora?".
 */
import { html } from '/shared/html.js';
import { descreverDataPorExtenso } from '/shared/datas.js';
import { formatarDiaLocal, plural } from '/shared/formatacao.js';
import { obterPainel } from '../api/painelApi.js';
import { descreverRuptura, formatarIndice, reguaDeEstoque, seloDeSituacao } from '../componentes/indicadores.js';
import { estadoVazio } from '../componentes/estados.js';
import { pedirCotacao } from '../componentes/pedidoDeCotacao.js';

const GRUPOS_DE_FALTA = [
  { titulo: 'Esgotados', situacao: 'sem_estoque' },
  { titulo: 'No estoque mínimo', situacao: 'critico' },
  { titulo: 'Podem acabar antes da entrega', situacao: 'atencao' },
  { titulo: 'Acabam nos próximos dias', situacao: 'ok' },
];

function fraseDoDia({ hoje, resumo }) {
  const partes = [
    `${plural(resumo.produtosNoMinimo, 'produto precisa', 'produtos precisam')} de reposição agora`,
    `${plural(resumo.produtosEmAtencao, 'pode', 'podem')} acabar antes da próxima entrega`,
    `${plural(resumo.cotacoesEmAberto, 'cotação aguarda', 'cotações aguardam')} resposta`,
  ];
  return `Hoje, ${descreverDataPorExtenso(hoje)}: ${partes[0]}, ${partes[1]} e ${partes[2]}.`;
}

function acaoDoProduto(produto) {
  if (produto.temCotacaoAberta) return html`<a href="#/cotacoes">Cotação enviada</a>`;
  return html`<button class="botao botao--secundario botao--pequeno" type="button" data-pedir-cotacao="${produto.id}">Pedir cotação</button>`;
}

function linhaDeFalta(produto) {
  return html`
    <tr>
      <th scope="row">
        <a href="#/produtos/${produto.id}">${produto.nome}</a>
        <span class="texto-secundario">${produto.fornecedorNome}</span>
      </th>
      <td>${reguaDeEstoque(produto)}<span class="texto-secundario">mínimo ${produto.estoqueMinimo}</span></td>
      <td>${seloDeSituacao(produto.situacao)}<span class="texto-secundario">${descreverRuptura(produto)}</span></td>
      <td class="tabela__acoes">${acaoDoProduto(produto)}</td>
    </tr>`;
}

function tabelaDeFaltas(faltas, horizonteEmDias) {
  if (faltas.length === 0) {
    return estadoVazio({
      titulo: 'Nada deve faltar nos próximos dias',
      texto: `Nenhum produto está no mínimo ou deve acabar em até ${horizonteEmDias} dias.`,
    });
  }
  const grupos = GRUPOS_DE_FALTA.map((grupo) => ({ ...grupo, produtos: faltas.filter((p) => p.situacao === grupo.situacao) })).filter(
    (grupo) => grupo.produtos.length > 0,
  );
  return html`
    <div class="tabela-rolavel">
      <table class="tabela tabela--responsiva">
        <caption class="visualmente-oculto">Produtos que podem faltar, agrupados por urgência</caption>
        <thead><tr><th scope="col">Produto</th><th scope="col">Estoque</th><th scope="col">Quando acaba</th><th scope="col"><span class="visualmente-oculto">Ação</span></th></tr></thead>
        ${grupos.map(
          (grupo) => html`
            <tbody>
              <tr class="tabela__grupo"><th colspan="4" scope="colgroup">${grupo.titulo}<span class="texto-secundario">${plural(grupo.produtos.length, 'produto', 'produtos')}</span></th></tr>
              ${grupo.produtos.map(linhaDeFalta)}
            </tbody>`,
        )}
      </table>
    </div>`;
}

function listaDeAltaTemporada({ mes, produtos }) {
  if (produtos.length === 0) return html`<p class="subtitulo">Nenhum produto tem pico de vendas previsto para ${mes}.</p>`;
  return html`
    <p class="subtitulo">Estes produtos vendem mais que o normal em ${mes}. Vale antecipar as compras.</p>
    <ul class="lista-simples">
      ${produtos.slice(0, 8).map(
        (produto) => html`
          <li>
            <span><a href="#/produtos/${produto.id}">${produto.nome}</a><span class="texto-secundario">${produto.fornecedorNome}</span></span>
            <span class="indice-sazonal" title="Vende ${formatarIndice(produto.indice)} a média do ano">${formatarIndice(produto.indice)}</span>
          </li>`,
      )}
    </ul>
    <a href="#/sazonalidade">Ver a sazonalidade de todos os produtos</a>`;
}

function listaDeCotacoes(cotacoes) {
  if (cotacoes.length === 0) return html`<p class="subtitulo">Nenhuma cotação aguardando resposta.</p>`;
  return html`
    <ul class="lista-simples">
      ${cotacoes.map(
        (cotacao) => html`
          <li>
            <span><a href="#/produtos/${cotacao.produtoId}">${cotacao.produtoNome}</a>
              <span class="texto-secundario">${cotacao.fornecedorNome}, pedida em ${formatarDiaLocal(cotacao.criadaEm)}</span></span>
            <span>${cotacao.quantidadeSugerida} ${cotacao.produtoUnidade}</span>
          </li>`,
      )}
    </ul>
    <a href="#/cotacoes">Gerenciar cotações</a>`;
}

export async function paginaDoPainel(destino) {
  destino.dataset.titulo = 'Painel';
  const painel = await obterPainel();

  if (painel.resumo.totalDeProdutos === 0) {
    destino.innerHTML = html`
      <h1 tabindex="-1">Painel de compras</h1>
      ${estadoVazio({
        titulo: 'Comece cadastrando um fornecedor',
        texto: 'Com fornecedores e produtos cadastrados, este painel mostra o que vai faltar e quando pedir cotação.',
        acao: { href: '#/fornecedores/novo', texto: 'Cadastrar fornecedor' },
      })}`;
    return;
  }

  destino.innerHTML = html`
    <header class="cabecalho-da-pagina">
      <div class="cabecalho-da-pagina__texto">
        <h1 tabindex="-1">Painel de compras</h1>
        <p class="subtitulo">${fraseDoDia(painel)}</p>
      </div>
    </header>
    <div class="painel">
      <section class="secao" aria-labelledby="titulo-faltas">
        <h2 id="titulo-faltas">O que pode faltar nos próximos ${painel.horizonteEmDias} dias</h2>
        ${tabelaDeFaltas(painel.faltasPrevistas, painel.horizonteEmDias)}
      </section>
      <div class="secao">
        <section class="secao folha bloco" aria-labelledby="titulo-temporada">
          <h2 id="titulo-temporada">Alta temporada em ${painel.altaTemporada.mes}</h2>
          ${listaDeAltaTemporada(painel.altaTemporada)}
        </section>
        <section class="secao folha bloco" aria-labelledby="titulo-cotacoes">
          <h2 id="titulo-cotacoes">Cotações em aberto</h2>
          ${listaDeCotacoes(painel.cotacoesEmAberto)}
        </section>
      </div>
    </div>`;

  destino.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-pedir-cotacao]');
    if (botao) pedirCotacao(botao, botao.dataset.pedirCotacao);
  });
}
