/**
 * Painel inicial e verificação de saúde do serviço.
 */
import * as painelService from '../services/painelService.js';
import { enviadorPadrao } from '../email/enviadorDeEmail.js';
import { ambiente } from '../config/ambiente.js';

export async function obterPainel(requisicao, resposta) {
  resposta.json(await painelService.montarPainel());
}

/**
 * Verificação rápida de que o serviço está no ar, usada pelo Render (Health Check Path), pelo
 * monitor que evita que o serviço "durma" e pelos testes. De propósito, não consulta o banco:
 * assim o Neon pode dormir quando ninguém usa o sistema, e dá para saber se um problema está no
 * serviço Web ou no PostgreSQL.
 */
export function verificarSaude(requisicao, resposta) {
  resposta.json({
    situacao: 'ok',
    nomeDoNegocio: ambiente.nomeDoNegocio,
    modoDeEmail: enviadorPadrao.modo,
    instante: new Date().toISOString(),
  });
}
