/** Chamadas ao serviço Web de produtos (/api/produtos). */
import { api } from './clienteHttp.js';

export const buscarProduto = (id) => api.obter(`/produtos/${id}`);
export const criarProduto = (dados) => api.criar('/produtos', dados);
export const atualizarProduto = (id, dados) => api.substituir(`/produtos/${id}`, dados);
export const excluirProduto = (id) => api.excluir(`/produtos/${id}`);
export const buscarPrevisao = (id) => api.obter(`/produtos/${id}/previsao`);
export const listarMovimentacoes = (id) => api.obter(`/produtos/${id}/movimentacoes`);
export const registrarMovimentacao = (id, dados) => api.criar(`/produtos/${id}/movimentacoes`, dados);
export const solicitarCotacao = (id) => api.criar(`/produtos/${id}/cotacoes`);
