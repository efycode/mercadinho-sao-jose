/**
 * Classificação de um índice sazonal. Usada pelo serviço (painel, previsão) e pela
 * interface (cores dos gráficos e do mapa de calor), por isso fica em /shared.
 */
export const LIMIARES_DE_TEMPORADA = Object.freeze({ alta: 1.15, baixa: 0.85 });

export function classificarTemporada(indice) {
  if (indice >= LIMIARES_DE_TEMPORADA.alta) return 'alta';
  if (indice <= LIMIARES_DE_TEMPORADA.baixa) return 'baixa';
  return 'normal';
}
