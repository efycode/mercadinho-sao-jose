/**
 * Cotações por e-mail.
 *
 * Regra principal: sempre que o estoque de um produto muda, "verificarReposicao" é chamada.
 *  - Se o estoque chegou ao mínimo e não há cotação em aberto, cria uma e envia ao fornecedor.
 *  - Se o estoque voltou acima do mínimo, as cotações em aberto do produto são concluídas.
 * A quantidade pedida vem da previsão (prazo de entrega + 30 dias de consumo, com sazonalidade).
 */
import * as cotacaoRepository from '../repositories/cotacaoRepository.js';
import * as fornecedorRepository from '../repositories/fornecedorRepository.js';
import * as produtoRepository from '../repositories/produtoRepository.js';
import { STATUS_EM_ABERTO } from '../repositories/cotacaoRepository.js';
import { precisaDeReposicao } from '../domain/previsao.js';
import { montarEmailDeCotacao } from '../email/modeloDeCotacao.js';
import { enviadorPadrao } from '../email/enviadorDeEmail.js';
import { ambiente } from '../config/ambiente.js';
import { comTransacao } from '../database/conexao.js';
import { ErroDeConflito, ErroDeValidacao, ErroNaoEncontrado } from '../errors/errosDaAplicacao.js';
import * as previsaoService from './previsaoService.js';

const FILTROS_DE_SITUACAO = Object.freeze({ abertas: STATUS_EM_ABERTO, todas: null });
const STATUS_DE_FECHAMENTO = Object.freeze(['concluida', 'cancelada']);

export function listarCotacoes({ situacao = 'todas', produtoId = null } = {}) {
  if (!Object.hasOwn(FILTROS_DE_SITUACAO, situacao)) {
    throw new ErroDeValidacao('Filtro de situação inválido. Use "abertas" ou "todas".');
  }
  return cotacaoRepository.listar({ status: FILTROS_DE_SITUACAO[situacao], produtoId });
}

export async function buscarCotacao(id) {
  const cotacao = await cotacaoRepository.buscarPorId(id);
  if (!cotacao) throw new ErroNaoEncontrado('Cotação não encontrada.');
  return cotacao;
}

/**
 * Chamada após qualquer mudança de estoque. Devolve a cotação criada, ou null.
 * O pedido (previsão e e-mail) é montado antes; depois, numa transação curta, a linha do produto
 * fica travada enquanto se decide com o estoque daquele instante. Assim, duas mudanças de estoque
 * simultâneas decidem uma depois da outra: sem cotação duplicada nem concluída por engano.
 */
export async function verificarReposicao(produtoId, { enviador = enviadorPadrao } = {}) {
  const produto = await produtoRepository.buscarPorId(produtoId);
  if (!produto) return null;
  const pedido = precisaDeReposicao(produto) ? await montarPedido(produto, 'automatica', enviador.modo) : null;

  const idDaCotacao = await comTransacao(async (transacao) => {
    const atual = await produtoRepository.buscarParaAtualizar(produtoId, transacao);
    if (!atual) return null;
    if (!precisaDeReposicao(atual)) {
      await cotacaoRepository.encerrarAbertasDoProduto(produtoId, 'concluida', transacao);
      return null;
    }
    // Sem pedido, o estoque caiu ao mínimo por outra mudança simultânea, que cria a cotação.
    return pedido && cotacaoRepository.inserirSeNaoHouverAberta(pedido, transacao);
  });
  return idDaCotacao ? enviarCotacaoRegistrada(idDaCotacao, enviador) : null;
}

/**
 * Chamada depois que uma mudança no produto ou no estoque JÁ foi gravada. Se o produto mudou
 * de fornecedor, cancela a cotação feita ao fornecedor antigo; depois, verifica a reposição.
 * Nunca lança erro: uma falha aqui (ex.: o banco caiu nesse instante) não pode fazer a pessoa
 * achar que a mudança não foi gravada e repeti-la. A próxima mudança de estoque verifica de novo.
 */
export async function revisarReposicao(produtoId, { trocouDeFornecedor = false } = {}) {
  try {
    if (trocouDeFornecedor) await cotacaoRepository.encerrarAbertasDoProduto(produtoId, 'cancelada');
    return await verificarReposicao(produtoId);
  } catch (erro) {
    console.error(`Não foi possível verificar a reposição do produto #${produtoId}:`, erro.message);
    return null;
  }
}

export async function solicitarCotacaoManual(produtoId) {
  const produto = await produtoRepository.buscarPorId(produtoId);
  if (!produto) throw new ErroNaoEncontrado('Produto não encontrado.');
  const idDaCotacao = await cotacaoRepository.inserirSeNaoHouverAberta(await montarPedido(produto, 'manual', enviadorPadrao.modo));
  if (!idDaCotacao) {
    throw new ErroDeConflito('Este produto já tem uma cotação em aberto. Conclua ou cancele a atual antes de pedir outra.');
  }
  return enviarCotacaoRegistrada(idDaCotacao, enviadorPadrao);
}

export async function reenviarCotacao(id) {
  const cotacao = await buscarCotacao(id);
  if (!STATUS_EM_ABERTO.includes(cotacao.status)) {
    throw new ErroDeConflito('Só é possível reenviar cotações em aberto.');
  }
  return enviar(cotacao, enviadorPadrao);
}

export async function alterarStatus(id, novoStatus) {
  if (!STATUS_DE_FECHAMENTO.includes(novoStatus)) {
    throw new ErroDeValidacao('Status inválido. Use "concluida" ou "cancelada".', { status: 'Use "concluida" ou "cancelada".' });
  }
  const cotacao = await buscarCotacao(id);
  if (!STATUS_EM_ABERTO.includes(cotacao.status)) {
    throw new ErroDeConflito('Esta cotação já foi encerrada.');
  }
  return cotacaoRepository.alterarStatus(id, novoStatus);
}

/** Calcula a quantidade a pedir e monta o e-mail ao fornecedor do produto (ainda sem gravar). */
async function montarPedido(produto, origem, modoDeEnvio) {
  const fornecedor = await fornecedorRepository.buscarPorId(produto.fornecedorId);
  const previsao = await previsaoService.calcularPrevisao(produto);
  const email = montarEmailDeCotacao({
    nomeDoNegocio: ambiente.nomeDoNegocio,
    fornecedor,
    produto,
    quantidadeSugerida: previsao.quantidadeSugerida,
    previsao,
  });
  return {
    produtoId: produto.id,
    fornecedorId: fornecedor.id,
    quantidadeSugerida: previsao.quantidadeSugerida,
    origem,
    emailDestino: fornecedor.email,
    assunto: email.assunto,
    corpoTexto: email.texto,
    corpoHtml: email.html,
    modoDeEnvio,
  };
}

async function enviarCotacaoRegistrada(idDaCotacao, enviador) {
  return enviar(await cotacaoRepository.buscarPorId(idDaCotacao), enviador);
}

/** Tenta enviar; o resultado (enviada ou falha) fica gravado na cotação, sem desfazer o resto. */
async function enviar(cotacao, enviador) {
  try {
    await garantirLimiteDiario(enviador);
    await enviador.enviar({
      para: cotacao.emailDestino,
      assunto: cotacao.assunto,
      html: cotacao.corpoHtml,
      texto: cotacao.corpoTexto,
    });
    return cotacaoRepository.registrarResultadoDoEnvio(cotacao.id, { status: 'enviada', modoDeEnvio: enviador.modo });
  } catch (erro) {
    console.error(`Falha ao enviar a cotação #${cotacao.id}:`, erro.message);
    return cotacaoRepository.registrarResultadoDoEnvio(cotacao.id, {
      status: 'falha_envio',
      modoDeEnvio: enviador.modo,
      erroDeEnvio: erro.message,
    });
  }
}

/** Proteção contra abuso: como o sistema é público, limita os e-mails reais por dia. */
async function garantirLimiteDiario(enviador) {
  if (enviador.modo === 'simulacao') return;
  const enviados = await cotacaoRepository.contarEnviosReaisRecentes();
  if (enviados >= ambiente.email.limiteDiario) {
    throw new Error(`Limite de ${ambiente.email.limiteDiario} e-mails em 24 horas atingido (EMAIL_LIMITE_DIARIO).`);
  }
}
