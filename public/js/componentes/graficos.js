/**
 * Gráficos desenhados em SVG, sem bibliotecas externas.
 * Cada gráfico tem título e descrição em texto (title/desc) para leitores de tela.
 * As cores vêm do CSS (classes), então funcionam no modo claro e no escuro.
 */
import { html } from '/shared/html.js';
import { MESES_ABREVIADOS } from '/shared/datas.js';
import { formatarData, formatarNumero } from '/shared/formatacao.js';
import { classificarTemporada } from '/shared/temporada.js';

const LARGURA = 640;

/** Arredonda para cima até um valor "redondo" (1, 2, 2,5, 5 ou 10 vezes uma potência de 10). */
function maximoArredondado(valor) {
  if (valor <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(valor));
  const multiplicador = [1, 2, 2.5, 5, 10].find((passo) => passo * potencia >= valor);
  return multiplicador * potencia;
}

function formatarIndiceCurto(indice) {
  return formatarNumero(indice, 1);
}

export function graficoDeSazonalidade({ indices, mesAtual, identificador }) {
  const altura = 230;
  const margem = { esquerda: 34, direita: 8, topo: 22, base: 30 };
  const alturaUtil = altura - margem.topo - margem.base;
  const passo = (LARGURA - margem.esquerda - margem.direita) / 12;
  const larguraDaBarra = passo * 0.62;
  const maximo = Math.max(2, Math.ceil(Math.max(...indices) * 2) / 2);
  const y = (valor) => margem.topo + alturaUtil * (1 - valor / maximo);
  const descricao = indices.map((indice, mes) => `${MESES_ABREVIADOS[mes]} ${formatarIndiceCurto(indice)}`).join('; ');

  const barras = indices.map((indice, mes) => {
    const x = margem.esquerda + passo * mes + (passo - larguraDaBarra) / 2;
    const classes = `barra barra--${classificarTemporada(indice)}${mes === mesAtual ? ' barra--atual' : ''}`;
    return html`
      <rect class="${classes}" x="${x}" y="${y(indice)}" width="${larguraDaBarra}" height="${y(0) - y(indice)}" rx="2"></rect>
      <text x="${x + larguraDaBarra / 2}" y="${y(indice) - 6}" text-anchor="middle" class="${mes === mesAtual ? 'rotulo-forte' : ''}">${formatarIndiceCurto(indice)}</text>
      <text x="${x + larguraDaBarra / 2}" y="${altura - 10}" text-anchor="middle" class="${mes === mesAtual ? 'rotulo-forte' : ''}">${MESES_ABREVIADOS[mes]}</text>`;
  });

  return html`
    <svg viewBox="0 0 ${LARGURA} ${altura}" role="img" aria-labelledby="${identificador}-titulo ${identificador}-desc">
      <title id="${identificador}-titulo">Índice de vendas de cada mês em relação à média</title>
      <desc id="${identificador}-desc">${descricao}</desc>
      <line class="eixo" x1="${margem.esquerda}" x2="${LARGURA - margem.direita}" y1="${y(0)}" y2="${y(0)}"></line>
      <line class="linha-de-referencia" x1="${margem.esquerda}" x2="${LARGURA - margem.direita}" y1="${y(1)}" y2="${y(1)}"></line>
      <text x="${margem.esquerda - 6}" y="${y(1) + 4}" text-anchor="end">1,0</text>
      <text x="${margem.esquerda - 6}" y="${y(maximo) + 4}" text-anchor="end">${formatarIndiceCurto(maximo)}</text>
      ${barras}
    </svg>`;
}

export function graficoDeProjecao({ curva, estoqueMinimo, unidade, diasAteRuptura, identificador }) {
  const altura = 240;
  const margem = { esquerda: 46, direita: 18, topo: 18, base: 30 };
  const ultimoDia = curva.length - 1;
  const maximo = maximoArredondado(Math.max(curva[0].estoque, estoqueMinimo) * 1.1);
  const x = (dia) => margem.esquerda + ((LARGURA - margem.esquerda - margem.direita) * dia) / ultimoDia;
  const y = (valor) => margem.topo + (altura - margem.topo - margem.base) * (1 - valor / maximo);

  const pontos = curva.map((ponto, dia) => `${x(dia).toFixed(1)},${y(ponto.estoque).toFixed(1)}`);
  const linha = `M${pontos.join(' L')}`;
  const area = `${linha} L${x(ultimoDia)},${y(0)} L${x(0)},${y(0)} Z`;
  const marcasDoEixoX = [0, 15, 30, 45, 60].filter((dia) => dia <= ultimoDia);
  const rupturaVisivel = diasAteRuptura !== null && diasAteRuptura > 0 && diasAteRuptura <= ultimoDia;
  const descricao = rupturaVisivel
    ? `O estoque cai de ${formatarNumero(curva[0].estoque)} ${unidade} hoje até zerar em ${formatarData(curva[diasAteRuptura].data)}.`
    : `Estoque projetado para os próximos ${ultimoDia} dias, começando em ${formatarNumero(curva[0].estoque)} ${unidade}.`;

  return html`
    <svg viewBox="0 0 ${LARGURA} ${altura}" role="img" aria-labelledby="${identificador}-titulo ${identificador}-desc">
      <title id="${identificador}-titulo">Projeção do estoque para os próximos ${ultimoDia} dias</title>
      <desc id="${identificador}-desc">${descricao}</desc>
      ${[0, maximo / 2, maximo].map(
        (valor) => html`
          <line class="grade" x1="${margem.esquerda}" x2="${LARGURA - margem.direita}" y1="${y(valor)}" y2="${y(valor)}"></line>
          <text x="${margem.esquerda - 8}" y="${y(valor) + 4}" text-anchor="end">${formatarNumero(valor)}</text>`,
      )}
      <path class="area" d="${area}"></path>
      <path class="curva" d="${linha}"></path>
      ${estoqueMinimo > 0 &&
      html`
        <line class="linha-do-minimo" x1="${margem.esquerda}" x2="${LARGURA - margem.direita}" y1="${y(estoqueMinimo)}" y2="${y(estoqueMinimo)}"></line>
        <text class="texto-do-minimo" x="${LARGURA - margem.direita}" y="${y(estoqueMinimo) - 6}" text-anchor="end">mínimo: ${formatarNumero(estoqueMinimo)}</text>`}
      ${rupturaVisivel &&
      html`
        <line class="marca-de-ruptura" x1="${x(diasAteRuptura)}" x2="${x(diasAteRuptura)}" y1="${margem.topo}" y2="${y(0)}"></line>
        <text class="rotulo-forte" x="${x(diasAteRuptura) + 6}" y="${margem.topo + 12}">acaba em ${formatarData(curva[diasAteRuptura].data).slice(0, 5)}</text>`}
      <line class="eixo" x1="${margem.esquerda}" x2="${LARGURA - margem.direita}" y1="${y(0)}" y2="${y(0)}"></line>
      ${marcasDoEixoX.map(
        (dia) => html`<text x="${x(dia)}" y="${altura - 8}" text-anchor="${dia === 0 ? 'start' : 'middle'}">${dia === 0 ? 'hoje' : formatarData(curva[dia].data).slice(0, 5)}</text>`,
      )}
    </svg>`;
}
