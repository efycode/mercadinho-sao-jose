import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatarCnpj, formatarData, formatarTelefone, plural } from '../shared/formatacao.js';
import { html } from '../shared/html.js';

test('aplica a máscara de CNPJ enquanto o usuário digita', () => {
  assert.equal(formatarCnpj('12'), '12');
  assert.equal(formatarCnpj('123'), '12.3');
  assert.equal(formatarCnpj('12345678000100'), '12.345.678/0001-00');
  assert.equal(formatarCnpj('12345678000100999'), '12.345.678/0001-00', 'ignora dígitos além do 14º');
});

test('aplica a máscara de telefone fixo e celular', () => {
  assert.equal(formatarTelefone('8533330101'), '(85) 3333-0101');
  assert.equal(formatarTelefone('85999990000'), '(85) 99999-0000');
});

test('formata datas ISO sem depender do fuso horário', () => {
  assert.equal(formatarData('2026-11-27'), '27/11/2026');
});

test('escolhe singular ou plural', () => {
  assert.equal(plural(1, 'produto', 'produtos'), '1 produto');
  assert.equal(plural(3, 'produto', 'produtos'), '3 produtos');
});

test('o template html escapa dados do usuário (proteção contra XSS)', () => {
  const nomeMalicioso = '<img src=x onerror="alert(1)">';
  assert.equal(String(html`<p>${nomeMalicioso}</p>`), '<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>');
  assert.equal(String(html`<ul>${['a', 'b'].map((item) => html`<li>${item}</li>`)}</ul>`), '<ul><li>a</li><li>b</li></ul>');
});
