import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { lerId, lerIdOpcional } from '../src/controllers/parametros.js';
import { ErroDeValidacao } from '../src/errors/errosDaAplicacao.js';
import { ehFalhaDeConexao } from '../src/database/falhasDeConexao.js';

const requisicaoCom = (id) => ({ params: { id } });

describe('Identificadores na URL', () => {
  test('aceita números inteiros positivos', () => {
    assert.equal(lerId(requisicaoCom('7')), 7);
    assert.equal(lerId(requisicaoCom('2147483647')), 2147483647);
    assert.equal(lerIdOpcional('3'), 3);
    assert.equal(lerIdOpcional(undefined), null);
  });

  test('recusa texto, zero, negativos, notação científica e números maiores que o banco comporta', () => {
    for (const invalido of ['abc', '0', '-1', '1e3', '007', ' 7', '2.5', '2147483648', '99999999999']) {
      assert.throws(() => lerId(requisicaoCom(invalido)), ErroDeValidacao, `"${invalido}" deveria ser recusado`);
    }
    assert.throws(() => lerIdOpcional(['1', '2']), ErroDeValidacao, 'parâmetro repetido na URL');
  });
});

describe('Falhas de conexão com o banco', () => {
  test('reconhece banco fora do ar, conexão que caiu e demora para conectar', () => {
    assert.equal(ehFalhaDeConexao({ code: 'ECONNREFUSED' }), true);
    assert.equal(ehFalhaDeConexao({ code: '57P01' }), true);
    assert.equal(ehFalhaDeConexao(new Error('Connection terminated unexpectedly')), true);
    assert.equal(ehFalhaDeConexao(new Error('timeout exceeded when trying to connect')), true);
  });

  test('não confunde erros dos dados com falha de conexão', () => {
    assert.equal(ehFalhaDeConexao({ code: '23505', message: 'duplicate key' }), false);
    assert.equal(ehFalhaDeConexao(new Error('qualquer outro erro')), false);
    assert.equal(ehFalhaDeConexao(undefined), false);
  });
});
