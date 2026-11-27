/** Chamadas ao painel, à sazonalidade e à verificação de saúde do serviço. */
import { api } from './clienteHttp.js';

export const obterPainel = () => api.obter('/painel');
export const listarSazonalidade = () => api.obter('/sazonalidade');
export const verificarSaude = () => api.obter('/saude');
