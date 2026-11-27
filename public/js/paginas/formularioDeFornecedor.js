/**
 * Tela mínima 2 do cenário: cadastro e edição de fornecedor.
 * A mesma tela atende às duas rotas: #/fornecedores/novo e #/fornecedores/:id/editar.
 */
import { html } from '/shared/html.js';
import { formatarCnpj, formatarTelefone } from '/shared/formatacao.js';
import { LIMITES, REGRAS_DO_FORNECEDOR } from '/shared/validacao.js';
import { atualizarFornecedor, buscarFornecedor, criarFornecedor } from '../api/fornecedorApi.js';
import { aplicarMascara, campo, prepararFormulario } from '../componentes/formulario.js';
import { notificar } from '../componentes/notificacoes.js';
import { navegarPara } from '../roteador.js';

const VALORES_INICIAIS = Object.freeze({ prazoEntregaDias: 3 });

function camposDoFornecedor(fornecedor) {
  return html`
    ${campo({
      nome: 'razaoSocial',
      rotulo: 'Razão social',
      valor: fornecedor.razaoSocial,
      obrigatorio: true,
      atributos: `maxlength="${LIMITES.razaoSocial}" autocomplete="organization"`,
    })}
    ${campo({
      nome: 'cnpj',
      rotulo: 'CNPJ',
      valor: formatarCnpj(fornecedor.cnpj),
      obrigatorio: true,
      dica: '14 dígitos. A pontuação entra sozinha enquanto você digita.',
      atributos: 'inputmode="numeric" maxlength="18" placeholder="00.000.000/0000-00"',
    })}
    ${campo({
      nome: 'email',
      rotulo: 'E-mail para cotações',
      tipo: 'email',
      valor: fornecedor.email,
      obrigatorio: true,
      dica: 'Os pedidos de cotação automáticos vão para este endereço.',
      atributos: `maxlength="${LIMITES.email}" autocomplete="email"`,
    })}
    ${campo({
      nome: 'telefone',
      rotulo: 'Telefone',
      tipo: 'tel',
      valor: formatarTelefone(fornecedor.telefone),
      obrigatorio: true,
      atributos: 'inputmode="numeric" maxlength="15" placeholder="(85) 99999-0000" autocomplete="tel"',
    })}
    ${campo({
      nome: 'nomeContato',
      rotulo: 'Pessoa de contato',
      valor: fornecedor.nomeContato,
      atributos: `maxlength="${LIMITES.nomeContato}"`,
    })}
    ${campo({
      nome: 'prazoEntregaDias',
      rotulo: 'Prazo de entrega, em dias',
      tipo: 'number',
      valor: fornecedor.prazoEntregaDias,
      obrigatorio: true,
      dica: 'Serve para avisar quando um produto pode acabar antes de a reposição chegar.',
      atributos: `min="0" max="${LIMITES.prazoDeEntregaEmDias}" step="1" inputmode="numeric"`,
    })}`;
}

export async function paginaFormularioDeFornecedor(destino, { id }) {
  const editando = Boolean(id);
  const fornecedor = editando ? await buscarFornecedor(id) : VALORES_INICIAIS;
  const titulo = editando ? 'Editar fornecedor' : 'Cadastrar fornecedor';
  destino.dataset.titulo = titulo;

  destino.innerHTML = html`
    <nav class="trilha" aria-label="Você está em">
      <ol>
        <li><a href="#/fornecedores">Fornecedores</a></li>
        ${editando && html`<li><a href="#/fornecedores/${id}/produtos">${fornecedor.razaoSocial}</a></li>`}
        <li aria-current="page">${editando ? 'Editar' : 'Novo fornecedor'}</li>
      </ol>
    </nav>
    <header class="cabecalho-da-pagina">
      <div class="cabecalho-da-pagina__texto">
        <h1 tabindex="-1">${titulo}</h1>
        <p class="subtitulo">Campos com * são obrigatórios.</p>
      </div>
    </header>
    <form class="formulario folha" novalidate>
      <div class="formulario__grade">${camposDoFornecedor(fornecedor)}</div>
      <div class="formulario__acoes">
        <button class="botao botao--primario" type="submit">${editando ? 'Salvar alterações' : 'Cadastrar fornecedor'}</button>
        <a class="botao botao--secundario" href="${editando ? `#/fornecedores/${id}/produtos` : '#/fornecedores'}">Cancelar</a>
      </div>
    </form>`;

  const formulario = destino.querySelector('form');
  aplicarMascara(formulario.elements.cnpj, formatarCnpj);
  aplicarMascara(formulario.elements.telefone, formatarTelefone);

  prepararFormulario(formulario, {
    regras: REGRAS_DO_FORNECEDOR,
    enviar: async (dados) => {
      const salvo = editando ? await atualizarFornecedor(id, dados) : await criarFornecedor(dados);
      notificar({
        tipo: 'sucesso',
        mensagem: editando ? 'Alterações salvas.' : 'Fornecedor cadastrado. Agora cadastre os produtos que ele entrega.',
      });
      navegarPara(`/fornecedores/${salvo.id}/produtos`);
    },
  });
}
