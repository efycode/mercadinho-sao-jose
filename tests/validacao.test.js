import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarFornecedor,
  normalizarMovimentacao,
  normalizarProduto,
  validarFornecedor,
  validarMovimentacao,
  validarProduto,
} from '../shared/validacao.js';

const fornecedorValido = {
  razaoSocial: 'Distribuidora Nordeste Alimentos Ltda',
  cnpj: '12.345.678/0001-00',
  email: 'compras@nordeste.example',
  telefone: '(85) 3333-0101',
  nomeContato: 'Francisco',
  prazoEntregaDias: '3',
};

const produtoValido = {
  fornecedorId: '1',
  nome: 'Arroz branco tipo 1 5 kg',
  unidade: 'pct',
  quantidadeEstoque: '85',
  estoqueMinimo: '30',
  precoCusto: '22,90',
};

const validarF = (alteracoes) => validarFornecedor(normalizarFornecedor({ ...fornecedorValido, ...alteracoes }));
const validarP = (alteracoes) => validarProduto(normalizarProduto({ ...produtoValido, ...alteracoes }));

describe('Fornecedor', () => {
  test('aceita um fornecedor completo, com CNPJ e telefone formatados', () => {
    assert.deepEqual(validarF({}), {});
  });

  test('exige os campos obrigatórios', () => {
    const erros = validarF({ razaoSocial: ' ', cnpj: '', email: '', telefone: '', prazoEntregaDias: '' });
    assert.deepEqual(Object.keys(erros).sort(), ['cnpj', 'email', 'prazoEntregaDias', 'razaoSocial', 'telefone']);
  });

  test('CNPJ precisa ter exatamente 14 dígitos', () => {
    assert.match(validarF({ cnpj: '12.345.678/0001-0' }).cnpj, /14 dígitos/);
    assert.match(validarF({ cnpj: '123456780001000' }).cnpj, /14 dígitos/);
    assert.match(validarF({ cnpj: '12345678OOO100' }).cnpj, /14 dígitos/, 'letras não são dígitos');
    assert.equal(validarF({ cnpj: '12345678000100' }).cnpj, undefined);
  });

  test('normaliza o CNPJ para guardar só os dígitos', () => {
    assert.equal(normalizarFornecedor(fornecedorValido).cnpj, '12345678000100');
  });

  test('rejeita e-mail e telefone em formato inválido', () => {
    assert.ok(validarF({ email: 'compras@' }).email);
    assert.ok(validarF({ telefone: '3333-0101' }).telefone);
    assert.equal(validarF({ telefone: '85999990000' }).telefone, undefined);
  });

  test('objetos e listas não contam como texto, e caracteres de controle são removidos', () => {
    assert.equal(validarF({ razaoSocial: { nome: 'X' } }).razaoSocial, 'Informe a razão social.');
    assert.equal(validarF({ razaoSocial: ['X'] }).razaoSocial, 'Informe a razão social.');
    assert.equal(normalizarFornecedor({ razaoSocial: 'Pão\u0000 Dourado\u0007' }).razaoSocial, 'Pão Dourado');
  });
});

describe('Produto', () => {
  test('aceita um produto completo e converte o preço com vírgula', () => {
    assert.deepEqual(validarP({}), {});
    assert.equal(normalizarProduto(produtoValido).precoCusto, 22.9);
  });

  test('quantidade em estoque não pode ser negativa', () => {
    assert.equal(validarP({ quantidadeEstoque: '-1' }).quantidadeEstoque, 'A quantidade em estoque não pode ser negativa.');
    assert.equal(validarP({ quantidadeEstoque: '0' }).quantidadeEstoque, undefined, 'zero é permitido');
  });

  test('quantidade precisa ser número inteiro', () => {
    assert.match(validarP({ quantidadeEstoque: '2.5' }).quantidadeEstoque, /inteiro/);
    assert.match(validarP({ quantidadeEstoque: 'abc' }).quantidadeEstoque, /inteiro/);
  });

  test('exige nome, unidade válida e fornecedor', () => {
    const erros = validarP({ nome: '', unidade: 'litro', fornecedorId: '' });
    assert.ok(erros.nome);
    assert.ok(erros.unidade);
    assert.ok(erros.fornecedorId);
  });

  test('preço de custo é opcional, mas se informado deve ser maior que zero', () => {
    assert.equal(validarP({ precoCusto: '' }).precoCusto, undefined);
    assert.ok(validarP({ precoCusto: '0' }).precoCusto);
  });

  test('o fornecedor precisa ser um identificador que o banco comporta', () => {
    assert.ok(validarP({ fornecedorId: '0' }).fornecedorId);
    assert.ok(validarP({ fornecedorId: '-3' }).fornecedorId);
    assert.ok(validarP({ fornecedorId: '2147483648' }).fornecedorId, 'acima do maior INTEGER do PostgreSQL');
    assert.equal(validarP({ fornecedorId: '2147483647' }).fornecedorId, undefined);
  });
});

describe('Movimentação de estoque', () => {
  const contexto = { hoje: '2026-11-10', estoqueAtual: 10 };
  const validarM = (dados) => validarMovimentacao(normalizarMovimentacao(dados), contexto);

  test('aceita uma saída dentro do estoque', () => {
    assert.deepEqual(validarM({ tipo: 'saida', quantidade: '10', data: '2026-11-10' }), {});
  });

  test('impede saída maior que o estoque atual', () => {
    assert.match(validarM({ tipo: 'saida', quantidade: '11', data: '2026-11-10' }).quantidade, /maior que o estoque/);
  });

  test('entrada pode ser maior que o estoque atual', () => {
    assert.deepEqual(validarM({ tipo: 'entrada', quantidade: '500', data: '2026-11-10' }), {});
  });

  test('rejeita data futura, data inexistente e quantidade zero', () => {
    assert.ok(validarM({ tipo: 'saida', quantidade: '1', data: '2026-11-11' }).data);
    assert.ok(validarM({ tipo: 'saida', quantidade: '1', data: '2026-02-30' }).data);
    assert.ok(validarM({ tipo: 'saida', quantidade: '0', data: '2026-11-10' }).quantidade);
  });

  test('rejeita data anterior a 2000, que distorceria a sazonalidade', () => {
    assert.equal(validarM({ tipo: 'saida', quantidade: '1', data: '1999-12-31' }).data, 'Informe uma data a partir de 01/01/2000.');
    assert.equal(validarM({ tipo: 'saida', quantidade: '1', data: '2000-01-01' }).data, undefined);
  });
});
