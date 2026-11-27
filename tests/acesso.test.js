import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { conferirSenha, gerarHashDeSenha } from '../src/seguranca/senha.js';
import { lerCookie } from '../src/seguranca/cookies.js';
import { normalizarLogin, validarLogin } from '../shared/validacao.js';

describe('Senhas (scrypt com sal aleatório)', () => {
  test('o hash guardado não contém a senha e informa o algoritmo', async () => {
    const hash = await gerarHashDeSenha('mercadinho2026');
    assert.ok(hash.startsWith('scrypt$'));
    assert.ok(!hash.includes('mercadinho2026'));
  });

  test('a senha certa confere e a errada não', async () => {
    const hash = await gerarHashDeSenha('mercadinho2026');
    assert.equal(await conferirSenha('mercadinho2026', hash), true);
    assert.equal(await conferirSenha('mercadinho2025', hash), false);
    assert.equal(await conferirSenha('', hash), false);
  });

  test('a mesma senha gera hashes diferentes, por causa do sal', async () => {
    assert.notEqual(await gerarHashDeSenha('igual'), await gerarHashDeSenha('igual'));
  });

  test('um hash malformado nunca confere', async () => {
    for (const hashInvalido of [null, '', 'texto-qualquer', 'scrypt$16384$8$1$sal', 'md5$1$2$3$4$5']) {
      assert.equal(await conferirSenha('qualquer', hashInvalido), false);
    }
  });
});

describe('Cookie da sessão', () => {
  const requisicao = (cookie) => ({ headers: { cookie } });

  test('lê o cookie certo entre vários', () => {
    assert.equal(lerCookie(requisicao('tema=escuro; mercadinho_sessao=abc123; outro=1'), 'mercadinho_sessao'), 'abc123');
  });

  test('sem o cookie, ou com valor malformado, devolve null', () => {
    assert.equal(lerCookie({ headers: {} }, 'mercadinho_sessao'), null);
    assert.equal(lerCookie(requisicao('tema=escuro'), 'mercadinho_sessao'), null);
    assert.equal(lerCookie(requisicao('mercadinho_sessao=%E0%A4%A'), 'mercadinho_sessao'), null);
    assert.equal(lerCookie(requisicao('mercadinho_sessao='), 'mercadinho_sessao'), null);
  });
});

describe('Regras do login', () => {
  test('o usuário ignora maiúsculas e espaços nas pontas; a senha fica como foi digitada', () => {
    assert.deepEqual(normalizarLogin({ usuario: '  Avaliacao ', senha: ' com espaço ' }), {
      usuario: 'avaliacao',
      senha: ' com espaço ',
    });
  });

  test('usuário e senha são obrigatórios', () => {
    assert.deepEqual(validarLogin(normalizarLogin({})), {
      usuario: 'Informe o usuário.',
      senha: 'Informe a senha.',
    });
    assert.deepEqual(validarLogin(normalizarLogin({ usuario: 'avaliacao', senha: 'mercadinho2026' })), {});
  });
});
