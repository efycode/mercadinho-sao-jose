/**
 * Escolhe como os e-mails de cotação saem, conforme a variável EMAIL_MODO.
 * Todos os provedores têm a mesma forma ({ modo, enviar }), então o serviço de
 * cotações não precisa saber qual está em uso: trocar de provedor não muda o resto do código.
 */
import { ambiente } from '../config/ambiente.js';
import { criarProvedorDeSimulacao } from './provedores/simulacao.js';
import { criarProvedorSmtp } from './provedores/smtp.js';
import { criarProvedorBrevo } from './provedores/brevo.js';

const FABRICAS_DE_PROVEDORES = Object.freeze({
  simulacao: criarProvedorDeSimulacao,
  smtp: criarProvedorSmtp,
  brevo: criarProvedorBrevo,
});

export function criarEnviadorDeEmail(configuracao = ambiente.email) {
  try {
    const fabricar = FABRICAS_DE_PROVEDORES[configuracao.modo];
    if (!fabricar) throw new Error(`EMAIL_MODO="${configuracao.modo}" não existe. Use simulacao, smtp ou brevo.`);
    return fabricar(configuracao);
  } catch (erro) {
    // Uma configuração de e-mail errada não deve derrubar o sistema inteiro.
    console.warn(`${erro.message} Usando o modo de simulação.`);
    return criarProvedorDeSimulacao();
  }
}

export const enviadorPadrao = criarEnviadorDeEmail();
export const enviadorDeSimulacao = criarProvedorDeSimulacao();
