/**
 * Tela mínima 1 do cenário: lista de fornecedores.
 */
import { html } from '/shared/html.js';
import { formatarCnpj, formatarTelefone, plural } from '/shared/formatacao.js';
import { listarFornecedores } from '../api/fornecedorApi.js';
import { estadoVazio } from '../componentes/estados.js';
import { excluirFornecedorComConfirmacao } from '../componentes/exclusao.js';
import { notificar } from '../componentes/notificacoes.js';

const ESPERA_DA_BUSCA_EM_MS = 300;

function resumoDeProdutos({ totalDeProdutos, produtosNoMinimo }) {
  const total = plural(totalDeProdutos, 'produto', 'produtos');
  return produtosNoMinimo > 0
    ? html`${total}<span class="texto-secundario"><span class="selo selo--critico">${produtosNoMinimo} no mínimo</span></span>`
    : total;
}

function linhaDoFornecedor(fornecedor) {
  return html`
    <tr>
      <th scope="row">
        <a href="#/fornecedores/${fornecedor.id}/produtos">${fornecedor.razaoSocial}</a>
        <span class="texto-secundario">CNPJ ${formatarCnpj(fornecedor.cnpj)}</span>
      </th>
      <td>${fornecedor.nomeContato ?? ''}<span class="texto-secundario">${fornecedor.email}</span><span class="texto-secundario">${formatarTelefone(fornecedor.telefone)}</span></td>
      <td>${plural(fornecedor.prazoEntregaDias, 'dia', 'dias')}</td>
      <td>${resumoDeProdutos(fornecedor)}</td>
      <td class="tabela__acoes">
        <a class="botao botao--discreto" href="#/fornecedores/${fornecedor.id}/produtos">Produtos</a>
        <a class="botao botao--discreto" href="#/fornecedores/${fornecedor.id}/editar">Editar</a>
        <button class="botao botao--discreto botao--perigo" type="button" data-excluir="${fornecedor.id}" data-nome="${fornecedor.razaoSocial}">Excluir</button>
      </td>
    </tr>`;
}

function tabela(fornecedores, busca) {
  if (fornecedores.length === 0) {
    return busca
      ? estadoVazio({ titulo: 'Nenhum fornecedor encontrado', texto: `Nada corresponde a "${busca}". Tente parte do nome ou do CNPJ.` })
      : estadoVazio({
          titulo: 'Nenhum fornecedor cadastrado',
          texto: 'Cadastre o primeiro fornecedor para depois incluir os produtos que ele entrega.',
          acao: { href: '#/fornecedores/novo', texto: 'Cadastrar fornecedor' },
        });
  }
  return html`
    <div class="tabela-rolavel">
      <table class="tabela tabela--responsiva">
        <caption>${plural(fornecedores.length, 'fornecedor', 'fornecedores')}</caption>
        <thead><tr>
          <th scope="col">Fornecedor</th><th scope="col">Contato</th><th scope="col">Prazo de entrega</th>
          <th scope="col">Produtos</th><th scope="col"><span class="visualmente-oculto">Ações</span></th>
        </tr></thead>
        <tbody>${fornecedores.map(linhaDoFornecedor)}</tbody>
      </table>
    </div>`;
}

export async function paginaListaDeFornecedores(destino) {
  destino.dataset.titulo = 'Fornecedores';
  const fornecedores = await listarFornecedores();
  destino.innerHTML = html`
    <header class="cabecalho-da-pagina">
      <div class="cabecalho-da-pagina__texto">
        <h1 tabindex="-1">Fornecedores</h1>
        <p class="subtitulo">Quem entrega cada produto, em quantos dias, e para qual e-mail vão os pedidos de cotação.</p>
      </div>
      <a class="botao botao--primario" href="#/fornecedores/novo">Cadastrar fornecedor</a>
    </header>
    <div class="barra-de-busca">
      <label for="busca">Buscar fornecedor</label>
      <input id="busca" type="search" placeholder="Razão social, contato ou CNPJ" autocomplete="off">
    </div>
    <div data-lista>${tabela(fornecedores, '')}</div>`;

  const areaDaLista = destino.querySelector('[data-lista]');
  const campoDeBusca = destino.querySelector('#busca');
  const atualizarLista = async () => {
    try {
      areaDaLista.innerHTML = tabela(await listarFornecedores(campoDeBusca.value.trim()), campoDeBusca.value.trim());
    } catch (erro) {
      notificar({ tipo: 'erro', mensagem: erro.message });
    }
  };

  let temporizador;
  campoDeBusca.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(atualizarLista, ESPERA_DA_BUSCA_EM_MS);
  });

  areaDaLista.addEventListener('click', async (evento) => {
    const botao = evento.target.closest('[data-excluir]');
    if (!botao) return;
    const excluiu = await excluirFornecedorComConfirmacao({ id: botao.dataset.excluir, razaoSocial: botao.dataset.nome });
    if (excluiu) await atualizarLista();
  });
}
