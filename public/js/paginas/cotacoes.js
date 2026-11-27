/**
 * Cotações: pedidos de preço enviados aos fornecedores, automáticos ou manuais.
 */
import { html } from '/shared/html.js';
import { formatarDiaLocal } from '/shared/formatacao.js';
import { alterarStatusDaCotacao, buscarCotacao, listarCotacoes, reenviarCotacao } from '../api/cotacaoApi.js';
import { verificarSaude } from '../api/painelApi.js';
import { MODOS_DE_EMAIL, seloDeCotacao } from '../componentes/indicadores.js';
import { confirmar, mostrarEmail } from '../componentes/dialogo.js';
import { estadoVazio } from '../componentes/estados.js';
import { notificar, notificarCotacao } from '../componentes/notificacoes.js';

const STATUS_EM_ABERTO = Object.freeze(['pendente', 'enviada', 'falha_envio']);

function avisoDoModoDeEnvio(modo) {
  if (modo === 'simulacao') {
    return html`<p class="aviso aviso--atencao">Envio em modo simulação: os e-mails ficam registrados aqui, mas não saem do sistema.
      Para enviar de verdade, configure a variável EMAIL_MODO no servidor (passo a passo no README).</p>`;
  }
  return html`<p class="aviso">Os pedidos saem por ${MODOS_DE_EMAIL[modo]}. As respostas dos fornecedores chegam no e-mail de compras configurado no servidor.</p>`;
}

function acoesDaCotacao(cotacao) {
  const aberta = STATUS_EM_ABERTO.includes(cotacao.status);
  return html`
    <button class="botao botao--discreto" type="button" data-acao="ver" data-id="${cotacao.id}">Ver e-mail</button>
    ${aberta &&
    html`
      <button class="botao botao--discreto" type="button" data-acao="reenviar" data-id="${cotacao.id}">Reenviar</button>
      <button class="botao botao--discreto" type="button" data-acao="concluir" data-id="${cotacao.id}">Concluir</button>
      <button class="botao botao--discreto botao--perigo" type="button" data-acao="cancelar" data-id="${cotacao.id}">Cancelar</button>`}`;
}

function linhaDaCotacao(cotacao) {
  const automatica = cotacao.origem === 'automatica';
  return html`
    <tr>
      <td>Nº ${cotacao.id}<span class="texto-secundario">${formatarDiaLocal(cotacao.criadaEm)}</span></td>
      <th scope="row"><a href="#/produtos/${cotacao.produtoId}">${cotacao.produtoNome}</a></th>
      <td>${cotacao.fornecedorNome}<span class="texto-secundario">${cotacao.emailDestino}</span></td>
      <td class="numero">${cotacao.quantidadeSugerida} ${cotacao.produtoUnidade}</td>
      <td>${automatica ? 'Automática' : 'Manual'}<span class="texto-secundario">${automatica ? 'estoque mínimo' : 'pedida na tela'}</span></td>
      <td>${seloDeCotacao(cotacao.status)}${cotacao.status === 'falha_envio' && html`<span class="texto-secundario">${cotacao.erroDeEnvio}</span>`}</td>
      <td class="tabela__acoes">${acoesDaCotacao(cotacao)}</td>
    </tr>`;
}

function tabelaDeCotacoes(cotacoes, situacao) {
  if (cotacoes.length === 0) {
    return situacao === 'abertas'
      ? estadoVazio({ titulo: 'Nenhuma cotação em aberto', texto: 'Quando um produto chegar ao estoque mínimo, o pedido enviado ao fornecedor aparece aqui.' })
      : estadoVazio({ titulo: 'Nenhuma cotação registrada', texto: 'Os pedidos de cotação, automáticos ou manuais, aparecem aqui.' });
  }
  return html`
    <div class="tabela-rolavel">
      <table class="tabela tabela--responsiva">
        <thead><tr>
          <th scope="col">Pedido</th><th scope="col">Produto</th><th scope="col">Fornecedor</th><th scope="col" class="numero">Quantidade</th>
          <th scope="col">Origem</th><th scope="col">Situação</th><th scope="col"><span class="visualmente-oculto">Ações</span></th>
        </tr></thead>
        <tbody>${cotacoes.map(linhaDaCotacao)}</tbody>
      </table>
    </div>`;
}

/** Cada ação devolve true quando a lista precisa ser recarregada. */
const ACOES = Object.freeze({
  async ver(id) {
    const cotacao = await buscarCotacao(id);
    await mostrarEmail({ titulo: `Cotação nº ${cotacao.id}`, destinatario: cotacao.emailDestino, assunto: cotacao.assunto, texto: cotacao.corpoTexto });
    return false;
  },
  async reenviar(id) {
    notificarCotacao(await reenviarCotacao(id));
    return true;
  },
  async concluir(id) {
    await alterarStatusDaCotacao(id, 'concluida');
    notificar({ tipo: 'sucesso', mensagem: `Cotação nº ${id} concluída.` });
    return true;
  },
  async cancelar(id) {
    const confirmado = await confirmar({
      titulo: 'Cancelar cotação?',
      mensagem: 'O fornecedor não é avisado. Se o estoque continuar no mínimo, a próxima movimentação gera um novo pedido automático.',
      textoDoBotao: 'Cancelar cotação',
      perigoso: true,
    });
    if (!confirmado) return false;
    await alterarStatusDaCotacao(id, 'cancelada');
    notificar({ tipo: 'sucesso', mensagem: `Cotação nº ${id} cancelada.` });
    return true;
  },
});

export async function paginaDeCotacoes(destino) {
  destino.dataset.titulo = 'Cotações';
  let situacao = 'abertas';
  const [saude, cotacoes] = await Promise.all([verificarSaude(), listarCotacoes({ situacao })]);

  destino.innerHTML = html`
    <header class="cabecalho-da-pagina">
      <div class="cabecalho-da-pagina__texto">
        <h1 tabindex="-1">Cotações</h1>
        <p class="subtitulo">Pedidos de preço enviados aos fornecedores. O sistema pede sozinho quando um produto chega ao estoque mínimo.</p>
      </div>
    </header>
    ${avisoDoModoDeEnvio(saude.modoDeEmail)}
    <div class="alternador" role="group" aria-label="Quais cotações mostrar">
      <button type="button" data-situacao="abertas" aria-pressed="true">Em aberto</button>
      <button type="button" data-situacao="todas" aria-pressed="false">Todas</button>
    </div>
    <div data-lista>${tabelaDeCotacoes(cotacoes, situacao)}</div>`;

  const areaDaLista = destino.querySelector('[data-lista]');
  const recarregarLista = async () => {
    areaDaLista.innerHTML = tabelaDeCotacoes(await listarCotacoes({ situacao }), situacao);
  };

  destino.querySelector('.alternador').addEventListener('click', async (evento) => {
    const botao = evento.target.closest('[data-situacao]');
    if (!botao) return;
    situacao = botao.dataset.situacao;
    for (const opcao of destino.querySelectorAll('[data-situacao]')) opcao.setAttribute('aria-pressed', String(opcao === botao));
    await recarregarLista();
  });

  areaDaLista.addEventListener('click', async (evento) => {
    const botao = evento.target.closest('[data-acao]');
    if (!botao) return;
    botao.disabled = true;
    try {
      if (await ACOES[botao.dataset.acao](botao.dataset.id)) await recarregarLista();
    } catch (erro) {
      notificar({ tipo: 'erro', mensagem: erro.message });
    } finally {
      botao.disabled = false;
    }
  });
}
