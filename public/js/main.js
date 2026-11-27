/**
 * Ponto de entrada da interface: registra as telas, descobre se a pessoa já entrou no
 * sistema e inicia a navegação. Sem login, só a tela de login abre.
 */
import { iniciarRoteador, navegarPara, registrarRota } from './roteador.js';
import { sair } from './api/sessaoApi.js';
import { notificar } from './componentes/notificacoes.js';
import { carregarSessao, esquecerUsuario, guardarCaminhoPretendido, usuarioLogado } from './sessao.js';
import { paginaDeLogin } from './paginas/login.js';
import { paginaDoPainel } from './paginas/painel.js';
import { paginaListaDeFornecedores } from './paginas/listaDeFornecedores.js';
import { paginaFormularioDeFornecedor } from './paginas/formularioDeFornecedor.js';
import { paginaProdutosDoFornecedor } from './paginas/produtosDoFornecedor.js';
import { paginaFormularioDeProduto } from './paginas/formularioDeProduto.js';
import { paginaDetalheDoProduto } from './paginas/detalheDoProduto.js';
import { paginaDeSazonalidade } from './paginas/sazonalidade.js';
import { paginaDeCotacoes } from './paginas/cotacoes.js';

registrarRota('/login', paginaDeLogin, { publica: true });
registrarRota('/', paginaDoPainel);
registrarRota('/fornecedores', paginaListaDeFornecedores); // tela mínima 1
registrarRota('/fornecedores/novo', paginaFormularioDeFornecedor); // tela mínima 2 (cadastro)
registrarRota('/fornecedores/:id/editar', paginaFormularioDeFornecedor); // tela mínima 2 (edição)
registrarRota('/fornecedores/:id/produtos', paginaProdutosDoFornecedor); // tela mínima 3 (lista)
registrarRota('/fornecedores/:fornecedorId/produtos/novo', paginaFormularioDeProduto); // tela mínima 3 (cadastro)
registrarRota('/produtos/:id/editar', paginaFormularioDeProduto); // tela mínima 3 (edição)
registrarRota('/produtos/:id', paginaDetalheDoProduto);
registrarRota('/sazonalidade', paginaDeSazonalidade);
registrarRota('/cotacoes', paginaDeCotacoes);

// O link "Pular para o conteúdo" move o foco sem alterar o endereço (que guarda a tela atual).
document.querySelector('[data-pular-para-conteudo]').addEventListener('click', (evento) => {
  evento.preventDefault();
  document.getElementById('conteudo').focus();
});

/** Sem login, qualquer tela leva ao login; já logado, a tela de login leva ao painel. */
function verificarAcesso({ caminho, publica }) {
  if (!publica && !usuarioLogado()) {
    guardarCaminhoPretendido(caminho);
    return '/login';
  }
  if (caminho === '/login' && usuarioLogado()) return '/';
  return null;
}

// A sessão venceu enquanto a pessoa usava o sistema (o serviço respondeu 401).
window.addEventListener('sessao-encerrada', () => {
  if (!usuarioLogado()) return;
  guardarCaminhoPretendido(location.hash.replace(/^#/, '') || '/');
  esquecerUsuario();
  notificar({ tipo: 'erro', mensagem: 'Sua sessão terminou. Entre de novo para continuar.' });
  navegarPara('/login');
});

document.querySelector('[data-sair]').addEventListener('click', async () => {
  try {
    await sair();
  } catch {
    // Mesmo sem resposta do serviço, a pessoa sai da tela; a sessão vence sozinha no servidor.
  }
  esquecerUsuario();
  notificar({ tipo: 'sucesso', mensagem: 'Você saiu do sistema.' });
  navegarPara('/login');
});

await carregarSessao();
iniciarRoteador(document.getElementById('conteudo'), { verificarAcesso });
