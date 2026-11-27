import { Router } from 'express';
import rotasDeFornecedores from './fornecedorRoutes.js';
import rotasDeProdutos from './produtoRoutes.js';
import rotasDeCotacoes from './cotacaoRoutes.js';
import rotasDeSessao from './sessaoRoutes.js';
import { exigirLogin } from '../middlewares/exigirLogin.js';
import { obterPainel, verificarSaude } from '../controllers/painelController.js';
import { listarSazonalidades } from '../controllers/produtoController.js';

/** Todas as rotas do serviço Web, montadas em /api (veja src/app.js). */
const rotasDaApi = Router();

// Rotas públicas: a verificação de funcionamento (usada pelo Render e pelo monitor) e o login.
rotasDaApi.get('/saude', verificarSaude);
rotasDaApi.use('/sessao', rotasDeSessao);

// Daqui para baixo, só com login.
rotasDaApi.use(exigirLogin);
rotasDaApi.get('/painel', obterPainel);
rotasDaApi.get('/sazonalidade', listarSazonalidades);
rotasDaApi.use('/fornecedores', rotasDeFornecedores);
rotasDaApi.use('/produtos', rotasDeProdutos);
rotasDaApi.use('/cotacoes', rotasDeCotacoes);

export default rotasDaApi;
