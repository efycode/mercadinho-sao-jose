/**
 * Cadastro e edição de produto (parte da tela mínima 3 do cenário).
 * Rotas: #/fornecedores/:fornecedorId/produtos/novo e #/produtos/:id/editar
 */
import { html } from '/shared/html.js';
import { LIMITES, REGRAS_DO_PRODUTO, UNIDADES_DE_MEDIDA } from '/shared/validacao.js';
import { ErroDaApi } from '../api/clienteHttp.js';
import { listarFornecedores } from '../api/fornecedorApi.js';
import { atualizarProduto, buscarProduto, criarProduto } from '../api/produtoApi.js';
import { campo, campoDeSelecao, prepararFormulario } from '../componentes/formulario.js';
import { notificar, notificarCotacao } from '../componentes/notificacoes.js';
import { navegarPara } from '../roteador.js';

const OPCOES_DE_UNIDADE = Object.entries(UNIDADES_DE_MEDIDA).map(([valor, nome]) => ({ valor, texto: `${valor} (${nome})` }));

function camposDoProduto(produto, fornecedores, editando) {
  return html`
    ${campo({ nome: 'nome', rotulo: 'Nome do produto', valor: produto.nome, obrigatorio: true, atributos: `maxlength="${LIMITES.nomeDoProduto}"` })}
    ${campoDeSelecao({
      nome: 'fornecedorId',
      rotulo: 'Fornecedor',
      opcoes: fornecedores.map((fornecedor) => ({ valor: fornecedor.id, texto: fornecedor.razaoSocial })),
      valor: produto.fornecedorId,
      obrigatorio: true,
      dica: editando ? 'Troque para transferir o produto a outro fornecedor.' : '',
    })}
    ${campoDeSelecao({ nome: 'unidade', rotulo: 'Unidade', opcoes: OPCOES_DE_UNIDADE, valor: produto.unidade, obrigatorio: true })}
    ${campo({
      nome: 'quantidadeEstoque',
      rotulo: 'Quantidade em estoque',
      tipo: 'number',
      valor: produto.quantidadeEstoque,
      obrigatorio: true,
      dica: editando
        ? 'Use para corrigir o estoque depois de uma contagem. Vendas e recebimentos se registram na tela do produto, porque alimentam a previsão.'
        : 'Quanto há hoje na prateleira e no depósito.',
      atributos: 'min="0" step="1" inputmode="numeric"',
    })}
    ${campo({
      nome: 'estoqueMinimo',
      rotulo: 'Estoque mínimo',
      tipo: 'number',
      valor: produto.estoqueMinimo,
      obrigatorio: true,
      dica: 'Ao chegar neste número, o sistema pede cotação ao fornecedor por e-mail. Use 0 para não pedir.',
      atributos: 'min="0" step="1" inputmode="numeric"',
    })}
    ${campo({ nome: 'precoCusto', rotulo: 'Preço de custo (R$)', tipo: 'number', valor: produto.precoCusto, atributos: 'min="0.01" step="0.01" inputmode="decimal"' })}`;
}

export async function paginaFormularioDeProduto(destino, { id, fornecedorId }) {
  const editando = Boolean(id);
  const [produto, fornecedores] = await Promise.all([editando ? buscarProduto(id) : null, listarFornecedores()]);
  const valores = produto ?? { fornecedorId };
  const fornecedor = fornecedores.find((item) => item.id === valores.fornecedorId);
  if (!fornecedor) throw new ErroDaApi('Fornecedor não encontrado. Ele pode ter sido excluído.', 404);

  const titulo = editando ? 'Editar produto' : 'Cadastrar produto';
  destino.dataset.titulo = titulo;
  destino.innerHTML = html`
    <nav class="trilha" aria-label="Você está em">
      <ol>
        <li><a href="#/fornecedores">Fornecedores</a></li>
        <li><a href="#/fornecedores/${fornecedor.id}/produtos">${fornecedor.razaoSocial}</a></li>
        ${editando && html`<li><a href="#/produtos/${id}">${produto.nome}</a></li>`}
        <li aria-current="page">${editando ? 'Editar' : 'Novo produto'}</li>
      </ol>
    </nav>
    <header class="cabecalho-da-pagina">
      <div class="cabecalho-da-pagina__texto">
        <h1 tabindex="-1">${titulo}</h1>
        <p class="subtitulo">${editando ? produto.nome : `Novo produto de ${fornecedor.razaoSocial}`}. Campos com * são obrigatórios.</p>
      </div>
    </header>
    <form class="formulario folha" novalidate>
      <div class="formulario__grade">${camposDoProduto(valores, fornecedores, editando)}</div>
      <div class="formulario__acoes">
        <button class="botao botao--primario" type="submit">${editando ? 'Salvar alterações' : 'Cadastrar produto'}</button>
        <a class="botao botao--secundario" href="#/fornecedores/${fornecedor.id}/produtos">Cancelar</a>
      </div>
    </form>`;

  prepararFormulario(destino.querySelector('form'), {
    regras: REGRAS_DO_PRODUTO,
    enviar: async (dados) => {
      const salvo = editando ? await atualizarProduto(id, dados) : await criarProduto(dados);
      notificar({ tipo: 'sucesso', mensagem: editando ? 'Alterações salvas.' : 'Produto cadastrado.' });
      notificarCotacao(salvo.cotacaoAutomatica, { automatica: true });
      navegarPara(`/fornecedores/${salvo.fornecedorId}/produtos`);
    },
  });
}
