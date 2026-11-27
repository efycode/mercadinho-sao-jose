/**
 * Datas no formato ISO "AAAA-MM-DD".
 * As contas são feitas em UTC para que um dia seja sempre um dia do calendário,
 * sem deslocamentos causados pelo fuso horário do servidor ou do navegador.
 */

const MILISSEGUNDOS_POR_DIA = 86_400_000;

export const NOMES_DOS_MESES = Object.freeze([
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]);

export const MESES_ABREVIADOS = Object.freeze([
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
]);

function paraDataUtc(dataIso) {
  return new Date(`${dataIso}T00:00:00Z`);
}

function paraIso(data) {
  return data.toISOString().slice(0, 10);
}

/** Data de hoje no fuso informado. Sem fuso, usa o do ambiente (ex.: o navegador). */
export function hojeIso(fusoHorario) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fusoHorario,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function ehDataIsoValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor ?? ''))) return false;
  const data = paraDataUtc(valor);
  return !Number.isNaN(data.getTime()) && paraIso(data) === valor;
}

export function adicionarDias(dataIso, dias) {
  return paraIso(new Date(paraDataUtc(dataIso).getTime() + dias * MILISSEGUNDOS_POR_DIA));
}

export function diferencaEmDias(dataInicialIso, dataFinalIso) {
  return Math.round((paraDataUtc(dataFinalIso) - paraDataUtc(dataInicialIso)) / MILISSEGUNDOS_POR_DIA);
}

/** Posição do mês no ano: 0 = janeiro, 11 = dezembro. */
export function indiceDoMes(dataIso) {
  return Number(dataIso.slice(5, 7)) - 1;
}

/** "2026-11-10" vira "2026-11". */
export function chaveDoMes(dataIso) {
  return dataIso.slice(0, 7);
}

export function primeiroDiaDoMes(dataIso) {
  return `${chaveDoMes(dataIso)}-01`;
}

function deslocarMes(chaveMes, deslocamento) {
  const [ano, mes] = chaveMes.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1 + deslocamento, 1));
  return paraIso(data).slice(0, 7);
}

export function mesSeguinte(chaveMes) {
  return deslocarMes(chaveMes, 1);
}

export function mesAnterior(chaveMes) {
  return deslocarMes(chaveMes, -1);
}

export function diasNoMes(chaveMes) {
  const [ano, mes] = chaveMes.split('-').map(Number);
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Lista os meses entre duas chaves, inclusive: ("2026-01", "2026-03") → jan, fev, mar. */
export function listarMeses(primeiroMes, ultimoMes) {
  const meses = [];
  for (let mes = primeiroMes; mes <= ultimoMes; mes = mesSeguinte(mes)) meses.push(mes);
  return meses;
}

/** "2026-11-14" vira "sábado, 14 de novembro". */
export function descreverDataPorExtenso(dataIso) {
  return paraDataUtc(dataIso).toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
