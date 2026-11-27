/**
 * Pequenos indicadores usados em várias telas: selos de situação, régua de estoque
 * e descrições de prazo. Ficam aqui para que cada tela não repita a mesma marcação.
 */
import { html } from '/shared/html.js';
import { formatarData, formatarQuantidade, plural } from '/shared/formatacao.js';

export const ROTULOS_DE_SITUACAO = Object.freeze({
  sem_estoque: 'Esgotado',
  critico: 'No mínimo',
  atencao: 'Pedir já',
  ok: 'Em dia',
});

export const ROTULOS_DE_STATUS_DA_COTACAO = Object.freeze({
  pendente: 'Enviando',
  enviada: 'Aguardando resposta',
  falha_envio: 'Falha no envio',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
});

export const MODOS_DE_EMAIL = Object.freeze({ simulacao: 'simulação', smtp: 'SMTP', brevo: 'Brevo' });

export function seloDeSituacao(situacao) {
  return html`<span class="selo selo--${situacao}">${ROTULOS_DE_SITUACAO[situacao]}</span>`;
}

export function seloDeCotacao(status) {
  return html`<span class="selo selo--${status}">${ROTULOS_DE_STATUS_DA_COTACAO[status]}</span>`;
}

/** Barra = estoque atual; traço = estoque mínimo. A escala mostra até 2,5× o mínimo. */
export function reguaDeEstoque({ quantidadeEstoque, estoqueMinimo, unidade, situacao }) {
  const referencia = Math.max(quantidadeEstoque, estoqueMinimo * 2.5, 1);
  const preenchimento = ((quantidadeEstoque / referencia) * 100).toFixed(1);
  const marca = ((estoqueMinimo / referencia) * 100).toFixed(1);
  const descricao = `Estoque de ${formatarQuantidade(quantidadeEstoque, unidade)}; mínimo de ${estoqueMinimo}.`;
  return html`<span class="estoque"><span class="regua regua--${situacao}" style="--preenchimento: ${preenchimento}%; --marca: ${marca}%" role="img" aria-label="${descricao}"><span class="regua__barra"></span><span class="regua__minimo"></span></span>${formatarQuantidade(quantidadeEstoque, unidade)}</span>`;
}

/** "acabou", "amanhã", "em 5 dias (15/11)", "sem vendas recentes"... */
export function descreverRuptura({ diasAteRuptura, dataDaRuptura }, consumoDiarioBase = 1) {
  if (diasAteRuptura === 0) return 'acabou';
  if (diasAteRuptura === null) return consumoDiarioBase > 0 ? 'mais de 1 ano' : 'sem vendas recentes';
  if (diasAteRuptura === 1) return `amanhã (${formatarData(dataDaRuptura).slice(0, 5)})`;
  return `em ${plural(diasAteRuptura, 'dia', 'dias')} (${formatarData(dataDaRuptura).slice(0, 5)})`;
}

export function formatarIndice(indice) {
  return `${indice.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×`;
}
