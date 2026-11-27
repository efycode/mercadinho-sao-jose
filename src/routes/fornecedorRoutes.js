import { Router } from 'express';
import * as fornecedorController from '../controllers/fornecedorController.js';

/** /api/fornecedores */
const rotasDeFornecedores = Router();

rotasDeFornecedores.get('/', fornecedorController.listar);
rotasDeFornecedores.post('/', fornecedorController.criar);
rotasDeFornecedores.get('/:id', fornecedorController.buscar);
rotasDeFornecedores.put('/:id', fornecedorController.atualizar);
rotasDeFornecedores.delete('/:id', fornecedorController.excluir);
rotasDeFornecedores.get('/:id/produtos', fornecedorController.listarProdutos);

export default rotasDeFornecedores;
