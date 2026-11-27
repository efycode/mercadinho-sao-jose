/** Chamadas ao serviço Web de acesso (/api/sessao): consultar, entrar e sair. */
import { api } from './clienteHttp.js';

export const consultarSessao = () => api.obter('/sessao');
export const entrar = (dados) => api.criar('/sessao', dados);
export const sair = () => api.excluir('/sessao');
