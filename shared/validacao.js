/**
 * Regras de validação de entrada do cenário "Mercadinho e seus fornecedores".
 *
 * O mesmo arquivo é usado em duas camadas:
 *  - na interface, para mostrar o erro assim que o usuário sai do campo;
 *  - no serviço Web, que nunca confia no navegador e valida tudo de novo.
 *
 * Cada função de validação devolve um objeto { campo: mensagem }. Objeto vazio = dados válidos.
 */
import { ehDataIsoValida } from './datas.js';

export const UNIDADES_DE_MEDIDA = Object.freeze({
  un: 'unidade',
  cx: 'caixa',
  pct: 'pacote',
  fd: 'fardo',
  dz: 'dúzia',
  sc: 'saco',
});

export const TIPOS_DE_MOVIMENTACAO = Object.freeze({
  saida: 'Saída (venda)',
  entrada: 'Entrada (recebimento)',
});

export const LIMITES = Object.freeze({
  razaoSocial: 120,
  nomeContato: 80,
  email: 160,
  nomeDoProduto: 120,
  observacao: 200,
  prazoDeEntregaEmDias: 60,
  quantidade: 1_000_000,
  preco: 100_000,
  usuario: 40,
  senha: 128,
  maiorId: 2_147_483_647, // maior valor de uma coluna INTEGER (SERIAL) do PostgreSQL
  dataMaisAntiga: '2000-01-01',
});

// ---------------------------------------------------------------------------
// Normalização: transforma o que veio do formulário (texto) em valores com tipo certo.
// ---------------------------------------------------------------------------

// Caracteres de controle (como o nulo, \u0000) não existem em texto digitado, e o PostgreSQL recusa o nulo.
const CARACTERES_DE_CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Objetos e listas não são texto: viram vazio e reprovam na regra de campo obrigatório. */
function texto(valor) {
  if (valor === null || valor === undefined || typeof valor === 'object') return '';
  return String(valor).replace(CARACTERES_DE_CONTROLE, '').trim();
}

function textoOpcional(valor) {
  const conteudo = texto(valor);
  return conteudo === '' ? null : conteudo;
}

function numero(valor) {
  if (typeof valor === 'number') return valor;
  const conteudo = texto(valor).replace(',', '.');
  return conteudo === '' ? null : Number(conteudo);
}

/** Remove apenas a pontuação aceita; letras continuam lá e reprovam na validação. */
function removerPontuacao(valor) {
  return texto(valor).replace(/[\s.\-/()]/g, '');
}

export function normalizarFornecedor(dados = {}) {
  return {
    razaoSocial: texto(dados.razaoSocial),
    cnpj: removerPontuacao(dados.cnpj),
    email: texto(dados.email).toLowerCase(),
    telefone: removerPontuacao(dados.telefone),
    nomeContato: textoOpcional(dados.nomeContato),
    prazoEntregaDias: numero(dados.prazoEntregaDias),
  };
}

export function normalizarProduto(dados = {}) {
  return {
    fornecedorId: numero(dados.fornecedorId),
    nome: texto(dados.nome),
    unidade: texto(dados.unidade).toLowerCase(),
    quantidadeEstoque: numero(dados.quantidadeEstoque),
    estoqueMinimo: numero(dados.estoqueMinimo),
    precoCusto: numero(dados.precoCusto),
  };
}

export function normalizarMovimentacao(dados = {}) {
  return {
    tipo: texto(dados.tipo).toLowerCase(),
    quantidade: numero(dados.quantidade),
    data: texto(dados.data),
    observacao: textoOpcional(dados.observacao),
  };
}

/** Login: o usuário ignora maiúsculas e espaços nas pontas; a senha fica exatamente como digitada. */
export function normalizarLogin(dados = {}) {
  return {
    usuario: texto(dados.usuario).toLowerCase(),
    senha: dados.senha === null || dados.senha === undefined ? '' : String(dados.senha),
  };
}

// ---------------------------------------------------------------------------
// Regras: cada regra recebe o valor e devolve uma mensagem de erro ou null.
// ---------------------------------------------------------------------------

const estaVazio = (valor) => valor === null || valor === undefined || valor === '';

const obrigatorio = (mensagem) => (valor) => (estaVazio(valor) ? mensagem : null);

const tamanhoMaximo = (limite) => (valor) =>
  typeof valor === 'string' && valor.length > limite ? `Use no máximo ${limite} caracteres.` : null;

const numeroInteiro = (mensagem) => (valor) =>
  !estaVazio(valor) && !Number.isInteger(valor) ? mensagem : null;

const entre = (minimo, maximo, mensagem) => (valor) =>
  Number.isFinite(valor) && (valor < minimo || valor > maximo) ? mensagem : null;

const naoNegativo = (mensagem) => (valor) => (Number.isFinite(valor) && valor < 0 ? mensagem : null);

const maiorQueZero = (mensagem) => (valor) =>
  !estaVazio(valor) && !(Number.isFinite(valor) && valor > 0) ? mensagem : null;

const umaDasOpcoes = (opcoes, mensagem) => (valor) =>
  !estaVazio(valor) && !Object.hasOwn(opcoes, valor) ? mensagem : null;

const cnpjCom14Digitos = (valor) =>
  !estaVazio(valor) && !/^\d{14}$/.test(valor) ? 'O CNPJ deve ter exatamente 14 dígitos (a pontuação é opcional).' : null;

const emailValido = (valor) =>
  !estaVazio(valor) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)
    ? 'Informe um e-mail válido, como compras@fornecedor.com.br.'
    : null;

const telefoneComDdd = (valor) =>
  !estaVazio(valor) && !/^[1-9]\d{9,10}$/.test(valor) ? 'Informe o telefone com DDD: 10 ou 11 dígitos.' : null;

const dataEntre2000EHoje = (valor, contexto) => {
  if (estaVazio(valor)) return null;
  if (!ehDataIsoValida(valor)) return 'Informe uma data válida.';
  if (valor < LIMITES.dataMaisAntiga) return 'Informe uma data a partir de 01/01/2000.';
  return contexto.hoje && valor > contexto.hoje ? 'A data não pode estar no futuro.' : null;
};

const saidaDentroDoEstoque = (valor, contexto, dados) =>
  dados.tipo === 'saida' && Number.isFinite(contexto.estoqueAtual) && valor > contexto.estoqueAtual
    ? `A saída não pode ser maior que o estoque atual (${contexto.estoqueAtual}).`
    : null;

// ---------------------------------------------------------------------------
// Esquemas: quais regras valem para cada campo de cada entidade.
// ---------------------------------------------------------------------------

const ESQUEMA_DO_FORNECEDOR = {
  razaoSocial: [obrigatorio('Informe a razão social.'), tamanhoMaximo(LIMITES.razaoSocial)],
  cnpj: [obrigatorio('Informe o CNPJ.'), cnpjCom14Digitos],
  email: [obrigatorio('Informe o e-mail que recebe as cotações.'), tamanhoMaximo(LIMITES.email), emailValido],
  telefone: [obrigatorio('Informe o telefone.'), telefoneComDdd],
  nomeContato: [tamanhoMaximo(LIMITES.nomeContato)],
  prazoEntregaDias: [
    obrigatorio('Informe o prazo de entrega em dias.'),
    numeroInteiro('Use um número inteiro de dias.'),
    entre(0, LIMITES.prazoDeEntregaEmDias, `O prazo deve ficar entre 0 e ${LIMITES.prazoDeEntregaEmDias} dias.`),
  ],
};

const ESQUEMA_DO_PRODUTO = {
  fornecedorId: [
    obrigatorio('Selecione o fornecedor.'),
    numeroInteiro('Selecione um fornecedor da lista.'),
    entre(1, LIMITES.maiorId, 'Selecione um fornecedor da lista.'),
  ],
  nome: [obrigatorio('Informe o nome do produto.'), tamanhoMaximo(LIMITES.nomeDoProduto)],
  unidade: [obrigatorio('Selecione a unidade.'), umaDasOpcoes(UNIDADES_DE_MEDIDA, 'Selecione uma unidade da lista.')],
  quantidadeEstoque: [
    obrigatorio('Informe a quantidade em estoque.'),
    numeroInteiro('A quantidade em estoque deve ser um número inteiro.'),
    naoNegativo('A quantidade em estoque não pode ser negativa.'),
    entre(0, LIMITES.quantidade, 'Quantidade acima do limite permitido.'),
  ],
  estoqueMinimo: [
    obrigatorio('Informe o estoque mínimo (use 0 para não gerar cotação automática).'),
    numeroInteiro('O estoque mínimo deve ser um número inteiro.'),
    naoNegativo('O estoque mínimo não pode ser negativo.'),
    entre(0, LIMITES.quantidade, 'Estoque mínimo acima do limite permitido.'),
  ],
  precoCusto: [
    maiorQueZero('O preço de custo deve ser maior que zero.'),
    entre(0, LIMITES.preco, 'Preço acima do limite permitido.'),
  ],
};

const ESQUEMA_DA_MOVIMENTACAO = {
  tipo: [obrigatorio('Escolha entrada ou saída.'), umaDasOpcoes(TIPOS_DE_MOVIMENTACAO, 'Tipo de movimentação inválido.')],
  quantidade: [
    obrigatorio('Informe a quantidade.'),
    numeroInteiro('A quantidade deve ser um número inteiro.'),
    maiorQueZero('A quantidade deve ser maior que zero.'),
    entre(1, LIMITES.quantidade, 'Quantidade acima do limite permitido.'),
    saidaDentroDoEstoque,
  ],
  data: [obrigatorio('Informe a data.'), dataEntre2000EHoje],
  observacao: [tamanhoMaximo(LIMITES.observacao)],
};

const ESQUEMA_DO_LOGIN = {
  usuario: [obrigatorio('Informe o usuário.'), tamanhoMaximo(LIMITES.usuario)],
  senha: [obrigatorio('Informe a senha.'), tamanhoMaximo(LIMITES.senha)],
};

/** Aplica as regras de cada campo e guarda só a primeira mensagem de erro de cada um. */
function validarComEsquema(esquema, dados, contexto = {}) {
  const erros = {};
  for (const [campo, regras] of Object.entries(esquema)) {
    for (const regra of regras) {
      const mensagem = regra(dados[campo], contexto, dados);
      if (mensagem) {
        erros[campo] = mensagem;
        break;
      }
    }
  }
  return erros;
}

export function validarFornecedor(dados) {
  return validarComEsquema(ESQUEMA_DO_FORNECEDOR, dados);
}

export function validarProduto(dados) {
  return validarComEsquema(ESQUEMA_DO_PRODUTO, dados);
}

/** contexto.hoje impede datas futuras; contexto.estoqueAtual impede saída maior que o estoque. */
export function validarMovimentacao(dados, contexto = {}) {
  return validarComEsquema(ESQUEMA_DA_MOVIMENTACAO, dados, contexto);
}

export function validarLogin(dados) {
  return validarComEsquema(ESQUEMA_DO_LOGIN, dados);
}

export function temErros(erros) {
  return Object.keys(erros).length > 0;
}

/** Pares prontos para uso: como limpar os dados e como validá-los. */
export const REGRAS_DO_FORNECEDOR = Object.freeze({ normalizar: normalizarFornecedor, validar: validarFornecedor });
export const REGRAS_DO_PRODUTO = Object.freeze({ normalizar: normalizarProduto, validar: validarProduto });
export const REGRAS_DA_MOVIMENTACAO = Object.freeze({ normalizar: normalizarMovimentacao, validar: validarMovimentacao });
export const REGRAS_DO_LOGIN = Object.freeze({ normalizar: normalizarLogin, validar: validarLogin });
