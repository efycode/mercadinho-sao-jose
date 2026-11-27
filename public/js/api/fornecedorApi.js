/** Chamadas ao serviço Web de fornecedores (/api/fornecedores). */
import { api, montarConsulta } from './clienteHttp.js';

export const listarFornecedores = (busca = '') => api.obter(`/fornecedores${montarConsulta({ busca })}`);
export const buscarFornecedor = (id) => api.obter(`/fornecedores/${id}`);
export const criarFornecedor = (dados) => api.criar('/fornecedores', dados);
export const atualizarFornecedor = (id, dados) => api.substituir(`/fornecedores/${id}`, dados);
export const excluirFornecedor = (id) => api.excluir(`/fornecedores/${id}`);
export const listarProdutosDoFornecedor = (id) => api.obter(`/fornecedores/${id}/produtos`);
