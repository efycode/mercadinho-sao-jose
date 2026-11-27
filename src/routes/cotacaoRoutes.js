import { Router } from 'express';
import * as cotacaoController from '../controllers/cotacaoController.js';

/** /api/cotacoes */
const rotasDeCotacoes = Router();

rotasDeCotacoes.get('/', cotacaoController.listar);
rotasDeCotacoes.get('/:id', cotacaoController.buscar);
rotasDeCotacoes.patch('/:id', cotacaoController.alterarStatus);
rotasDeCotacoes.post('/:id/reenvio', cotacaoController.reenviar);

export default rotasDeCotacoes;
