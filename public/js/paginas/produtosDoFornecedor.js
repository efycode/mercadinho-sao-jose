/**
 * Tela mínima 3 do cenário: lista de produtos de um fornecedor, com acesso ao
 * cadastro e à edição de cada produto.
 */
import { html } from '/shared/html.js';
import { formatarCnpj, formatarMoeda, formatarTelefone, plural } from '/shared/formatacao.js';
import { buscarFornecedor, listarProdutosDoFornecedor } from '../api/fornecedorApi.js';
import { descreverRuptura, reguaDeEstoque, seloDeSituacao } from '../componentes/indicadores.js';
import { estadoVazio } from '../componentes/estados.js';
import { excluirFornecedorComConfirmacao, excluirProdutoComConfirmacao } from '../componentes/exclusao.js';
import { navegarPara, recarregarRotaAtual } from '../roteador.js';

function fichaDoFornecedor(fornecedor) {
  return html`
    <dl class="ficha">
      <div><dt>CNPJ</dt><dd>${formatarCnpj(fornecedor.cnpj)}</dd></div>
      <div><dt>E-mail para cotações</dt><dd>${fornecedor.email}</dd></div>
      <div><dt>Telefone</dt><dd>${formatarTelefone(fornecedor.telefone)}</dd></div>
      ${fornecedor.nomeContato && html`<div><dt>Contato</dt><dd>${fornecedor.nomeContato}</dd></div>`}
      <div><dt>Prazo de entrega</dt><dd>${plural(fornecedor.prazoEntregaDias, 'dia', 'dias')}</dd></div>
    </dl>`;
}

function linhaDoProduto(produto) {
  const { previsao } = produto;
  return html`
    <tr>
      <th scope="row">
        <a href="#/produtos/${produto.id}">${produto.nome}</a>
        ${produto.precoCusto && html`<span class="texto-secundario">Custo ${formatarMoeda(produto.precoCusto)}</span>`}
      </th>
      <td>${reguaDeEstoque({ ...produto, situacao: previsao.situacao })}<span class="texto-secundario">mínimo ${produto.estoqueMinimo}</span></td>
      <td>${seloDeSituacao(previsao.situacao)}</td>
      <td>${descreverRuptura(previsao, previsao.consumoDiarioBase)}</td>
      <td class="tabela__acoes">
        <a class="botao botao--discreto" href="#/produtos/${produto.id}">Previsão</a>
        <a class="botao botao--discreto" href="#/produtos/${produto.id}/editar">Editar</a>
        <button class="botao botao--discreto botao--perigo" type="button" data-excluir-produto="${produto.id}" data-nome="${produto.nome}">Excluir</button>
      </td>
    </tr>`;
}

function tabelaDeProdutos(fornecedor, produtos) {
  if (produtos.length === 0) {
    return estadoVazio({
      titulo: 'Nenhum produto deste fornecedor',
      texto: 'Cadastre os produtos que ele entrega para acompanhar o estoque e receber alertas de reposição.',
      acao: { href: `#/fornecedores/${fornecedor.id}/produtos/novo`, texto: 'Cadastrar produto' },
    });
  }
  return html`
    <div class="tabela-rolavel">
      <table class="tabela tabela--responsiva">
        <caption>${plural(produtos.length, 'produto', 'produtos')} de ${fornecedor.razaoSocial}</caption>
        <thead><tr>
          <th scope="col">Produto</th><th scope="col">Estoque</th><th scope="col">Situação</th>
          <th scope="col">Quando acaba</th><th scope="col"><span class="visualmente-oculto">Ações</span></th>
        </tr></thead>
        <tbody>${produtos.map(linhaDoProduto)}</tbody>
      </table>
    </div>`;
}

export async function paginaProdutosDoFornecedor(destino, { id }) {
  const [fornecedor, produtos] = await Promise.all([buscarFornecedor(id), listarProdutosDoFornecedor(id)]);
  destino.dataset.titulo = fornecedor.razaoSocial;

  destino.innerHTML = html`
    <nav class="trilha" aria-label="Você está em">
      <ol><li><a href="#/fornecedores">Fornecedores</a></li><li aria-current="page">${fornecedor.razaoSocial}</li></ol>
    </nav>
    <header class="cabecalho-da-pagina">
      <div class="cabecalho-da-pagina__texto">
        <h1 tabindex="-1">${fornecedor.razaoSocial}</h1>
        ${fichaDoFornecedor(fornecedor)}
      </div>
      <div class="acoes">
        <a class="botao botao--primario" href="#/fornecedores/${id}/produtos/novo">Cadastrar produto</a>
        <a class="botao botao--secundario" href="#/fornecedores/${id}/editar">Editar fornecedor</a>
        <button class="botao botao--perigo" type="button" data-excluir-fornecedor>Excluir fornecedor</button>
      </div>
    </header>
    <section class="secao" aria-label="Produtos do fornecedor">${tabelaDeProdutos(fornecedor, produtos)}</section>`;

  destino.querySelector('[data-excluir-fornecedor]').addEventListener('click', async () => {
    const excluiu = await excluirFornecedorComConfirmacao(fornecedor);
    if (excluiu) navegarPara('/fornecedores');
  });

  destino.addEventListener('click', async (evento) => {
    const botao = evento.target.closest('[data-excluir-produto]');
    if (!botao) return;
    const excluiu = await excluirProdutoComConfirmacao({ id: botao.dataset.excluirProduto, nome: botao.dataset.nome });
    if (excluiu) await recarregarRotaAtual();
  });
}
