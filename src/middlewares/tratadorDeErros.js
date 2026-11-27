/**
 * Ponto único de tratamento de erros da API. Toda falha vira uma resposta JSON no formato
 * { mensagem, erros? }, com o status HTTP correto e texto que o usuário entende.
 * Detalhes técnicos (stack trace) ficam apenas no log do servidor.
 */
import { ErroDaAplicacao } from '../errors/errosDaAplicacao.js';
import { ehFalhaDeConexao } from '../database/falhasDeConexao.js';

/** Mensagens amigáveis para as restrições do banco (última linha de defesa). */
const RESTRICOES_DO_BANCO = Object.freeze({
  uq_fornecedores_cnpj: { status: 409, mensagem: 'Já existe um fornecedor com este CNPJ.', campo: 'cnpj' },
  ck_fornecedores_cnpj: { status: 400, mensagem: 'O CNPJ deve ter exatamente 14 dígitos.', campo: 'cnpj' },
  fk_produtos_fornecedor: { status: 409, mensagem: 'Não é possível excluir um fornecedor que ainda tem produtos.' },
  ck_produtos_estoque: {
    status: 409,
    mensagem: 'A quantidade em estoque não pode ficar negativa.',
    campo: 'quantidadeEstoque',
  },
  uq_cotacoes_uma_aberta_por_produto: { status: 409, mensagem: 'Este produto já tem uma cotação em aberto.' },
});

// Os serviços validam tudo antes; estes códigos só aparecem se algum valor escapar dessa validação.
const CODIGOS_DO_POSTGRES = Object.freeze({
  '23505': { status: 409, mensagem: 'Já existe um registro com esses dados.' },
  '23503': { status: 409, mensagem: 'A operação quebraria o vínculo entre fornecedor e produto.' },
  '23514': { status: 400, mensagem: 'Um dos valores informados está fora do permitido.' },
  '22001': { status: 400, mensagem: 'Um dos textos informados é longo demais.' },
  '22003': { status: 400, mensagem: 'Um dos números informados está fora do permitido.' },
  '22007': { status: 400, mensagem: 'Uma das datas informadas é inválida.' },
  '22008': { status: 400, mensagem: 'Uma das datas informadas é inválida.' },
  '22021': { status: 400, mensagem: 'Um dos textos informados tem caracteres inválidos.' },
  '22P02': { status: 400, mensagem: 'Um dos valores informados tem formato inválido.' },
});

function converterErroDoBanco(erro) {
  const restricao = RESTRICOES_DO_BANCO[erro.constraint];
  if (restricao) {
    const erros = restricao.campo ? { [restricao.campo]: restricao.mensagem } : undefined;
    return { status: restricao.status, corpo: { mensagem: restricao.mensagem, erros } };
  }
  const conhecido = CODIGOS_DO_POSTGRES[erro.code];
  return conhecido ? { status: conhecido.status, corpo: { mensagem: conhecido.mensagem } } : null;
}

function converterErro(erro) {
  if (erro instanceof ErroDaAplicacao) {
    return { status: erro.statusHttp, corpo: { mensagem: erro.message, erros: erro.camposInvalidos } };
  }
  if (erro.type === 'entity.parse.failed') {
    return { status: 400, corpo: { mensagem: 'O corpo da requisição não é um JSON válido.' } };
  }
  if (erro.type === 'entity.too.large') {
    return { status: 413, corpo: { mensagem: 'Os dados enviados são grandes demais.' } };
  }
  if (ehFalhaDeConexao(erro)) {
    return { status: 503, corpo: { mensagem: 'O banco de dados está indisponível no momento. Tente de novo em alguns segundos.' } };
  }
  // Outros erros de leitura da requisição (ex.: charset não suportado) já trazem um status 4xx.
  if (Number.isInteger(erro.status) && erro.status >= 400 && erro.status < 500) {
    return { status: erro.status, corpo: { mensagem: 'A requisição não pôde ser lida. Confira o formato dos dados enviados.' } };
  }
  return converterErroDoBanco(erro) ?? { status: 500, corpo: { mensagem: 'Erro interno no servidor. Tente novamente.' } };
}

// O Express reconhece um tratador de erros pelos quatro parâmetros, por isso "proximo" fica na assinatura.
// eslint-disable-next-line no-unused-vars
export function tratarErros(erro, requisicao, resposta, proximo) {
  const { status, corpo } = converterErro(erro);
  if (status >= 500) console.error(`Erro em ${requisicao.method} ${requisicao.originalUrl}:`, erro);
  resposta.status(status).json(corpo);
}

export function responderRotaNaoEncontrada(requisicao, resposta) {
  resposta.status(404).json({ mensagem: `O endereço ${requisicao.method} ${requisicao.originalUrl} não existe nesta API.` });
}
