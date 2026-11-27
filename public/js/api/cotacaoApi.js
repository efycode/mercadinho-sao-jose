/** Chamadas ao serviço Web de cotações (/api/cotacoes). */
import { api, montarConsulta } from './clienteHttp.js';

export const listarCotacoes = ({ situacao, produtoId } = {}) => api.obter(`/cotacoes${montarConsulta({ situacao, produtoId })}`);
export const buscarCotacao = (id) => api.obter(`/cotacoes/${id}`);
export const alterarStatusDaCotacao = (id, status) => api.alterar(`/cotacoes/${id}`, { status });
export const reenviarCotacao = (id) => api.criar(`/cotacoes/${id}/reenvio`);
