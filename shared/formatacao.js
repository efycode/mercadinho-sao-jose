/**
 * Formatação de valores para exibição.
 * Este arquivo é usado tanto pela interface (navegador) quanto pelo serviço (Node.js),
 * para que a mesma regra não seja escrita duas vezes.
 */

export function somenteDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/** Preenche uma máscara como "00.000.000/0000-00", onde cada 0 recebe um dígito. */
function aplicarMascara(digitos, mascara) {
  let resultado = '';
  let posicao = 0;
  for (const simbolo of mascara) {
    if (posicao >= digitos.length) break;
    resultado += simbolo === '0' ? digitos[posicao++] : simbolo;
  }
  return resultado;
}

export function formatarCnpj(valor) {
  return aplicarMascara(somenteDigitos(valor).slice(0, 14), '00.000.000/0000-00');
}

export function formatarTelefone(valor) {
  const digitos = somenteDigitos(valor).slice(0, 11);
  const mascara = digitos.length > 10 ? '(00) 00000-0000' : '(00) 0000-0000';
  return aplicarMascara(digitos, mascara);
}

/** "2026-11-10" vira "10/11/2026", sem conversão de fuso horário. */
export function formatarData(dataIso) {
  if (!dataIso) return '';
  const [ano, mes, dia] = String(dataIso).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Dia de um instante (ex.: criado_em) no fuso de quem está vendo. */
export function formatarDiaLocal(instanteIso) {
  return instanteIso ? new Date(instanteIso).toLocaleDateString('pt-BR') : '';
}

export function formatarDataHora(instanteIso) {
  if (!instanteIso) return '';
  return new Date(instanteIso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const formatadorDeMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarMoeda(valor) {
  return valor === null || valor === undefined ? '' : formatadorDeMoeda.format(valor);
}

export function formatarNumero(valor, casasDecimais = 0) {
  return Number(valor ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais,
  });
}

export function formatarQuantidade(quantidade, unidade) {
  return `${formatarNumero(quantidade)} ${unidade}`;
}

/** Escolhe singular ou plural: plural(1, 'produto', 'produtos') → "1 produto". */
export function plural(quantidade, singular, pluralDaPalavra) {
  return `${formatarNumero(quantidade)} ${quantidade === 1 ? singular : pluralDaPalavra}`;
}
