import { Router } from 'express';
import * as produtoController from '../controllers/produtoController.js';

/** /api/produtos */
const rotasDeProdutos = Router();

rotasDeProdutos.get('/', produtoController.listar);
rotasDeProdutos.post('/', produtoController.criar);
rotasDeProdutos.get('/:id', produtoController.buscar);
rotasDeProdutos.put('/:id', produtoController.atualizar);
rotasDeProdutos.delete('/:id', produtoController.excluir);
rotasDeProdutos.get('/:id/previsao', produtoController.buscarPrevisao);
rotasDeProdutos.get('/:id/movimentacoes', produtoController.listarMovimentacoes);
rotasDeProdutos.post('/:id/movimentacoes', produtoController.registrarMovimentacao);
rotasDeProdutos.post('/:id/cotacoes', produtoController.solicitarCotacao);

export default rotasDeProdutos;
