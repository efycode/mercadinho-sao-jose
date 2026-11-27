/**
 * Detalhe do produto: onde as funcionalidades adicionais aparecem juntas.
 * Mostra quando o estoque deve acabar, a sazonalidade, a compra sugerida, o registro
 * de entradas e saídas (que alimenta a previsão) e o histórico.
 */
import { html, htmlConfiavel } from '/shared/html.js';
import { descreverDataPorExtenso, hojeIso, indiceDoMes, NOMES_DOS_MESES } from '/shared/datas.js';
import { formatarData, formatarDiaLocal, formatarNumero, formatarQuantidade, plural } from '/shared/formatacao.js';
import { LIMITES, REGRAS_DA_MOVIMENTACAO, TIPOS_DE_MOVIMENTACAO } from '/shared/validacao.js';
import { classificarTemporada } from '/shared/temporada.js';
import { buscarPrevisao, buscarProduto, listarMovimentacoes, registrarMovimentacao } from '../api/produtoApi.js';
import { listarCotacoes } from '../api/cotacaoApi.js';
import { campo, campoDeOpcoes, prepararFormulario } from '../componentes/formulario.js';
import { graficoDeProjecao, graficoDeSazonalidade } from '../componentes/graficos.js';
import { formatarIndice, ROTULOS_DE_STATUS_DA_COTACAO, seloDeSituacao } from '../componentes/indicadores.js';
import { excluirProdutoComConfirmacao } from '../componentes/exclusao.js';
import { pedirCotacao } from '../componentes/pedidoDeCotacao.js';
import { notificar, notificarCotacao } from '../componentes/notificacoes.js';
import { navegarPara, recarregarRotaAtual } from '../roteador.js';

const OPCOES_DE_MOVIMENTACAO = Object.entries(TIPOS_DE_MOVIMENTACAO).map(([valor, texto]) => ({ valor, texto }));
const TEXTO_DO_BOTAO = Object.freeze({ saida: 'Registrar saída', entrada: 'Registrar entrada' });
const ROTULOS_DA_TEMPORADA = Object.freeze({ alta: 'alta temporada', normal: 'mês dentro da média', baixa: 'baixa temporada' });

function etiquetaDaPrevisao(produto, previsao) {
  const { diasAteRuptura, dataDaRuptura, consumoDiarioBase, situacao } = previsao;
  if (diasAteRuptura === null) {
    const vende = consumoDiarioBase > 0;
    return html`
      <div class="etiqueta etiqueta--tranquila">
        <p class="etiqueta__titulo">${vende ? 'Estoque para mais de um ano' : 'Sem vendas recentes'}</p>
        <p class="etiqueta__detalhe">${vende ? 'No ritmo atual, o estoque dura mais de 365 dias.' : 'Não houve saídas nos últimos 30 dias, então não há como prever quando acaba.'}</p>
      </div>`;
  }
  const prazo = plural(produto.prazoEntregaDias, 'dia', 'dias');
  const titulo = diasAteRuptura === 0 ? 'Esgotado' : diasAteRuptura === 1 ? 'Acaba amanhã' : `Acaba em ${diasAteRuptura} dias`;
  const quando = diasAteRuptura === 0 ? 'O estoque deste produto acabou.' : `Previsão: ${descreverDataPorExtenso(dataDaRuptura)}.`;
  const conselho = {
    sem_estoque: 'Peça reposição com urgência.',
    critico: 'Já está no estoque mínimo.',
    atencao: `O fornecedor leva ${prazo} para entregar: peça agora.`,
    ok: `Dá tempo: o fornecedor entrega em ${prazo}.`,
  }[situacao];
  return html`
    <div class="etiqueta">
      <p class="etiqueta__titulo">${titulo}</p>
      <p class="etiqueta__detalhe">${quando} ${conselho}</p>
    </div>`;
}

function numerosDoProduto(produto, previsao, hoje) {
  const { sazonalidade } = previsao;
  const mesAtual = indiceDoMes(hoje);
  const indiceAtual = sazonalidade.indices[mesAtual];
  return html`
    <dl class="numeros">
      <div>
        <dt>Estoque agora</dt>
        <dd>${formatarQuantidade(produto.quantidadeEstoque, produto.unidade)}</dd>
        <dd class="texto-secundario">mínimo ${produto.estoqueMinimo}</dd>
      </div>
      <div>
        <dt>Vendas previstas por dia</dt>
        <dd>${formatarNumero(previsao.consumoPrevistoHoje, 1)}</dd>
        <dd class="texto-secundario">últimos 30 dias, ajustado para ${NOMES_DOS_MESES[mesAtual]}</dd>
      </div>
      <div>
        <dt>Compra sugerida</dt>
        <dd>${formatarQuantidade(previsao.quantidadeSugerida, produto.unidade)}</dd>
        <dd class="texto-secundario">cobre a entrega e mais 30 dias</dd>
      </div>
      <div>
        <dt>Sazonalidade em ${NOMES_DOS_MESES[mesAtual]}</dt>
        <dd>${sazonalidade.confiavel ? formatarIndice(indiceAtual) : 'sem dados'}</dd>
        <dd class="texto-secundario">${sazonalidade.confiavel ? ROTULOS_DA_TEMPORADA[classificarTemporada(indiceAtual)] : `${sazonalidade.mesesAnalisados} de 12 meses de histórico`}</dd>
      </div>
    </dl>`;
}

function explicacaoDaPrevisao(produto, previsao, hoje) {
  const { sazonalidade } = previsao;
  const mesAtual = indiceDoMes(hoje);
  const proximoMes = (mesAtual + 1) % 12;
  const ajuste = sazonalidade.confiavel
    ? `Depois multiplica esse ritmo pelo índice de cada mês (${NOMES_DOS_MESES[mesAtual]}: ${formatarIndice(sazonalidade.indices[mesAtual])}; ${NOMES_DOS_MESES[proximoMes]}: ${formatarIndice(sazonalidade.indices[proximoMes])}) e desconta do estoque, dia a dia, até zerar.`
    : `Ainda não há 12 meses completos de histórico (há ${sazonalidade.mesesAnalisados}), então a sazonalidade não entra na conta: o ritmo é descontado do estoque, dia a dia, até zerar.`;
  return html`
    <details class="explicacao">
      <summary>Como esta previsão é calculada</summary>
      <p>O sistema soma as vendas dos últimos 30 dias e retira o efeito da estação, chegando a ${formatarNumero(previsao.consumoDiarioBase, 1)} ${produto.unidade} por dia num mês comum. ${ajuste}</p>
      <p>A compra sugerida cobre o prazo de entrega do fornecedor (${plural(produto.prazoEntregaDias, 'dia', 'dias')}) mais 30 dias de vendas previstas e ainda repõe o estoque mínimo.</p>
    </details>`;
}

function formularioDeMovimentacao(hoje) {
  return html`
    <form class="formulario folha" novalidate data-movimentacao>
      <h2>Registrar entrada ou saída</h2>
      ${campoDeOpcoes({ nome: 'tipo', rotulo: 'O que aconteceu?', opcoes: OPCOES_DE_MOVIMENTACAO, valor: 'saida' })}
      ${campo({ nome: 'quantidade', rotulo: 'Quantidade', tipo: 'number', obrigatorio: true, atributos: 'min="1" step="1" inputmode="numeric"' })}
      ${campo({ nome: 'data', rotulo: 'Data', tipo: 'date', valor: hoje, obrigatorio: true, atributos: `min="${LIMITES.dataMaisAntiga}" max="${hoje}"` })}
      ${campo({ nome: 'observacao', rotulo: 'Observação', atributos: `maxlength="${LIMITES.observacao}" placeholder="Ex.: nota fiscal 1234"` })}
      <div class="formulario__acoes">
        <button class="botao botao--primario" type="submit">${TEXTO_DO_BOTAO.saida}</button>
      </div>
    </form>`;
}

function figuraDaProjecao(produto, previsao) {
  if (previsao.consumoDiarioBase <= 0) {
    return html`<figure class="grafico folha"><h3>Estoque previsto</h3><figcaption>Sem vendas nos últimos 30 dias: não há projeção de estoque.</figcaption></figure>`;
  }
  return html`
    <figure class="grafico folha">
      <h3>Estoque previsto nos próximos 60 dias</h3>
      ${graficoDeProjecao({
        curva: previsao.curvaDeEstoque,
        estoqueMinimo: produto.estoqueMinimo,
        unidade: produto.unidade,
        diasAteRuptura: previsao.diasAteRuptura,
        identificador: 'grafico-projecao',
      })}
      <figcaption>A curva desconta, a cada dia, as vendas previstas para aquele mês. A linha tracejada vermelha é o estoque mínimo.</figcaption>
    </figure>`;
}

function figuraDaSazonalidade(previsao, hoje) {
  const { sazonalidade } = previsao;
  if (!sazonalidade.confiavel) {
    return html`<figure class="grafico folha"><h3>Sazonalidade</h3><figcaption>Histórico insuficiente: ${sazonalidade.mesesAnalisados} de 12 meses completos. O gráfico aparece quando houver um ano de vendas registradas.</figcaption></figure>`;
  }
  return html`
    <figure class="grafico folha">
      <h3>Vendas de cada mês comparadas à média</h3>
      ${graficoDeSazonalidade({ indices: sazonalidade.indices, mesAtual: indiceDoMes(hoje), identificador: 'grafico-sazonalidade' })}
      <figcaption>1,0 é a média do ano. Laranja: meses de alta; azul: meses de baixa. O contorno marca o mês atual.</figcaption>
    </figure>`;
}

function avisoDeCotacao(cotacao) {
  if (!cotacao) return '';
  const quem = cotacao.origem === 'automatica' ? 'Pedido automático' : 'Pedido';
  return html`
    <p class="aviso">${quem} de cotação de ${cotacao.quantidadeSugerida} ${cotacao.produtoUnidade} feito em ${formatarDiaLocal(cotacao.criadaEm)}
      para ${cotacao.emailDestino}: ${ROTULOS_DE_STATUS_DA_COTACAO[cotacao.status].toLowerCase()}. <a href="#/cotacoes">Ver cotações</a></p>`;
}

function historicoDeMovimentacoes(movimentacoes) {
  if (movimentacoes.length === 0) return html`<p class="subtitulo">Nenhuma entrada ou saída registrada ainda.</p>`;
  return html`
    <section class="tabela-rolavel" tabindex="0" aria-label="Histórico de movimentações (no celular, role para os lados)">
      <table class="tabela">
        <caption>Últimas ${movimentacoes.length} movimentações</caption>
        <thead><tr><th scope="col">Data</th><th scope="col">Tipo</th><th scope="col" class="numero">Quantidade</th><th scope="col">Observação</th></tr></thead>
        <tbody>
          ${movimentacoes.map(
            (movimentacao) => html`
              <tr>
                <td>${formatarData(movimentacao.data)}</td>
                <td>${movimentacao.tipo === 'saida' ? 'Saída' : 'Entrada'}</td>
                <td class="numero">${movimentacao.tipo === 'saida' ? '−' : '+'}${formatarNumero(movimentacao.quantidade)}</td>
                <td>${movimentacao.observacao ?? ''}</td>
              </tr>`,
          )}
        </tbody>
      </table>
    </section>`;
}

function ligarFormularioDeMovimentacao(formulario, produto, hoje) {
  const botao = formulario.querySelector('[type="submit"]');
  formulario.addEventListener('change', (evento) => {
    if (evento.target.name === 'tipo') botao.textContent = TEXTO_DO_BOTAO[evento.target.value];
  });
  prepararFormulario(formulario, {
    regras: REGRAS_DA_MOVIMENTACAO,
    contexto: () => ({ hoje, estoqueAtual: produto.quantidadeEstoque }),
    enviar: async (dados) => {
      const resultado = await registrarMovimentacao(produto.id, dados);
      const tipo = dados.tipo === 'saida' ? 'Saída' : 'Entrada';
      notificar({
        tipo: 'sucesso',
        mensagem: `${tipo} de ${formatarQuantidade(dados.quantidade, produto.unidade)} registrada. Estoque agora: ${formatarQuantidade(resultado.produto.quantidadeEstoque, produto.unidade)}.`,
      });
      notificarCotacao(resultado.cotacaoAutomatica, { automatica: true });
      await recarregarRotaAtual();
    },
  });
}

export async function paginaDetalheDoProduto(destino, { id }) {
  const [produto, previsao, movimentacoes, cotacoesAbertas] = await Promise.all([
    buscarProduto(id),
    buscarPrevisao(id),
    listarMovimentacoes(id),
    listarCotacoes({ situacao: 'abertas', produtoId: id }),
  ]);
  const hoje = previsao.hoje ?? hojeIso(); // a data do servidor manda: é ela que valida a movimentação
  const [cotacaoAberta] = cotacoesAbertas;
  destino.dataset.titulo = produto.nome;

  destino.innerHTML = html`
    <nav class="trilha" aria-label="Você está em">
      <ol>
        <li><a href="#/fornecedores">Fornecedores</a></li>
        <li><a href="#/fornecedores/${produto.fornecedorId}/produtos">${produto.fornecedorNome}</a></li>
        <li aria-current="page">${produto.nome}</li>
      </ol>
    </nav>
    <header class="cabecalho-da-pagina">
      <div class="cabecalho-da-pagina__texto">
        <h1 tabindex="-1">${produto.nome}</h1>
        <p class="subtitulo">${seloDeSituacao(previsao.situacao)} Fornecido por
          <a href="#/fornecedores/${produto.fornecedorId}/produtos">${produto.fornecedorNome}</a>, que entrega em ${plural(produto.prazoEntregaDias, 'dia', 'dias')}.</p>
      </div>
      <div class="acoes">
        <button class="botao botao--secundario" type="button" data-pedir-cotacao ${cotacaoAberta && htmlConfiavel('disabled')}>
          ${cotacaoAberta ? 'Cotação já pedida' : 'Pedir cotação agora'}</button>
        <a class="botao botao--secundario" href="#/produtos/${produto.id}/editar">Editar produto</a>
        <button class="botao botao--perigo" type="button" data-excluir-produto>Excluir</button>
      </div>
    </header>
    ${avisoDeCotacao(cotacaoAberta)}
    <div class="detalhe">
      <section class="detalhe__previsao" aria-labelledby="titulo-previsao">
        <h2 id="titulo-previsao" class="visualmente-oculto">Previsão de estoque</h2>
        ${etiquetaDaPrevisao(produto, previsao)}
        ${numerosDoProduto(produto, previsao, hoje)}
        ${explicacaoDaPrevisao(produto, previsao, hoje)}
      </section>
      ${formularioDeMovimentacao(hoje)}
    </div>
    <div class="graficos">
      ${figuraDaProjecao(produto, previsao)}
      ${figuraDaSazonalidade(previsao, hoje)}
    </div>
    <section class="secao" aria-labelledby="titulo-historico">
      <h2 id="titulo-historico">Histórico de entradas e saídas</h2>
      ${historicoDeMovimentacoes(movimentacoes)}
    </section>`;

  destino.querySelector('[data-pedir-cotacao]').addEventListener('click', (evento) => pedirCotacao(evento.currentTarget, produto.id));
  destino.querySelector('[data-excluir-produto]').addEventListener('click', async () => {
    if (await excluirProdutoComConfirmacao(produto)) navegarPara(`/fornecedores/${produto.fornecedorId}/produtos`);
  });
  ligarFormularioDeMovimentacao(destino.querySelector('[data-movimentacao]'), produto, hoje);
}
