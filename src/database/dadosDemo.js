/**
 * Dados de demonstração do Mercadinho São José.
 *
 * - 15 fornecedores fictícios (o cenário fala em "cerca de 15").
 * - Os CNPJs têm dígitos verificadores errados de propósito: não pertencem a nenhuma empresa real.
 * - Os e-mails usam o domínio reservado ".example", que nunca entrega mensagens.
 * - 18 meses de vendas diárias com sazonalidade típica de Fortaleza: verão e férias,
 *   quadra chuvosa, Páscoa, festas juninas, caju no segundo semestre e Natal.
 * O gerador de números aleatórios usa semente fixa: os dados saem iguais a cada execução.
 */
import { consultar } from './conexao.js';
import * as fornecedorRepository from '../repositories/fornecedorRepository.js';
import * as produtoRepository from '../repositories/produtoRepository.js';
import * as movimentacaoRepository from '../repositories/movimentacaoRepository.js';
import { verificarReposicao } from '../services/cotacaoService.js';
import { dataDeHoje } from '../services/previsaoService.js';
import { normalizarEValidar } from '../services/validacaoDeEntrada.js';
import { enviadorDeSimulacao } from '../email/enviadorDeEmail.js';
import { REGRAS_DO_FORNECEDOR, REGRAS_DO_PRODUTO } from '../../shared/validacao.js';
import { adicionarDias, chaveDoMes, indiceDoMes } from '../../shared/datas.js';

const MESES_DE_HISTORICO = 18;
const TAMANHO_DO_LOTE = 5000;

/** Multiplicador de vendas de cada mês (janeiro a dezembro). */
const PERFIS_SAZONAIS = Object.freeze({
  estavel: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  verao: [1.35, 1.3, 1.05, 0.85, 0.75, 0.75, 0.9, 0.9, 1.0, 1.1, 1.2, 1.45],
  sorvete: [1.6, 1.5, 1.1, 0.8, 0.6, 0.6, 0.8, 0.8, 1.0, 1.2, 1.4, 1.7],
  chuvoso: [1.0, 1.05, 1.2, 1.25, 1.2, 1.1, 0.95, 0.9, 0.85, 0.85, 0.85, 0.9],
  natal: [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.1, 0.45, 2.6, 6.2],
  pascoa: [0.15, 0.9, 3.8, 4.4, 0.1, 0, 0, 0, 0, 0, 0, 0.05],
  chocolate: [0.9, 1.0, 1.4, 1.6, 0.9, 1.25, 0.9, 0.8, 0.8, 0.9, 1.0, 1.35],
  junino: [0.6, 0.6, 0.7, 0.9, 1.7, 3.4, 1.3, 0.7, 0.6, 0.6, 0.6, 0.7],
  caju: [0.75, 0.7, 0.6, 0.6, 0.7, 0.8, 0.9, 1.1, 1.4, 1.5, 1.5, 1.25],
  festas: [1.1, 1.35, 0.9, 0.9, 1.0, 1.55, 1.1, 0.9, 0.9, 0.9, 1.0, 1.65],
});

/** Peso das vendas por dia da semana (domingo a sábado): sábado é o dia mais forte. */
const PESO_DO_DIA_DA_SEMANA = Object.freeze([0.8, 0.9, 0.95, 0.95, 1.0, 1.15, 1.25]);

const produto = (nome, unidade, vendaDiaria, perfil, estoqueMinimo, estoqueAtual, precoCusto) => ({
  nome,
  unidade,
  vendaDiaria,
  perfil,
  estoqueMinimo,
  estoqueAtual,
  precoCusto,
});

const FORNECEDORES = [
  {
    razaoSocial: 'Distribuidora Nordeste Alimentos Ltda',
    cnpj: '11107919000140',
    email: 'compras@nordeste-alimentos.example',
    telefone: '8533330101',
    nomeContato: 'Francisco Holanda',
    prazoEntregaDias: 3,
    produtos: [
      produto('Arroz branco tipo 1 5 kg', 'pct', 6, 'estavel', 30, 85, 22.9),
      produto('Feijão carioca 1 kg', 'pct', 9, 'estavel', 40, 38, 7.4),
      produto('Açúcar cristal 1 kg', 'pct', 7, 'estavel', 30, 120, 4.1),
      produto('Farinha de mandioca 1 kg', 'pct', 4, 'estavel', 20, 40, 5.6),
    ],
  },
  {
    razaoSocial: 'Laticínios Serra Verde Ltda',
    cnpj: '12115838000137',
    email: 'pedidos@serraverde-laticinios.example',
    telefone: '8533330202',
    nomeContato: 'Maria do Socorro',
    prazoEntregaDias: 2,
    produtos: [
      produto('Leite integral UHT 1 L', 'un', 18, 'estavel', 60, 0, 4.79),
      produto('Queijo coalho 500 g', 'pct', 5, 'festas', 15, 55, 18.5),
      produto('Manteiga da terra 500 ml', 'un', 2, 'estavel', 8, 30, 21),
      produto('Iogurte natural 170 g', 'un', 8, 'verao', 24, 70, 2.3),
    ],
  },
  {
    razaoSocial: 'Torrefação Serra de Baturité Ltda',
    cnpj: '13123757000151',
    email: 'vendas@cafe-baturite.example',
    telefone: '8533330303',
    nomeContato: 'João Batista',
    prazoEntregaDias: 5,
    produtos: [
      produto('Café torrado e moído 250 g', 'pct', 10, 'chuvoso', 40, 55, 9.8),
      produto('Café torrado e moído 500 g', 'pct', 4, 'chuvoso', 15, 52, 17.8),
    ],
  },
  {
    razaoSocial: 'Panificadora Pão Dourado Ltda',
    cnpj: '14131676000166',
    email: 'encomendas@paodourado.example',
    telefone: '8533330404',
    nomeContato: 'Rita Moreira',
    prazoEntregaDias: 1,
    produtos: [
      produto('Pão de forma tradicional 500 g', 'pct', 12, 'estavel', 20, 34, 6.9),
      produto('Bolo de milho', 'un', 3, 'junino', 6, 14, 9.5),
      produto('Panetone de frutas 400 g', 'un', 3, 'natal', 20, 48, 13.9),
    ],
  },
  {
    razaoSocial: 'Bebidas Litoral Distribuidora Ltda',
    cnpj: '15139595000175',
    email: 'comercial@bebidas-litoral.example',
    telefone: '8533330505',
    nomeContato: 'Carlos Eduardo',
    prazoEntregaDias: 2,
    produtos: [
      produto('Refrigerante de cola 2 L', 'un', 14, 'verao', 48, 130, 7.2),
      produto('Cerveja pilsen lata 350 ml (fardo com 12)', 'fd', 3, 'verao', 15, 40, 38),
      produto('Água mineral 500 ml (fardo com 12)', 'fd', 5, 'verao', 20, 18, 9.9),
      produto('Suco de caju concentrado 500 ml', 'un', 6, 'caju', 18, 80, 5.2),
    ],
  },
  {
    razaoSocial: 'Doces & Cia Atacadista Ltda',
    cnpj: '16147514000141',
    email: 'atendimento@docesecia.example',
    telefone: '8533330606',
    nomeContato: 'Ana Cláudia',
    prazoEntregaDias: 4,
    produtos: [
      produto('Chocolate ao leite 90 g', 'un', 8, 'chocolate', 30, 75, 5.9),
      produto('Ovo de Páscoa ao leite 200 g', 'un', 2, 'pascoa', 0, 6, 24.9),
      produto('Paçoca de rolha (pote com 50)', 'pct', 2, 'junino', 6, 9, 12),
    ],
  },
  {
    razaoSocial: 'Cerealista Grãos do Sertão Ltda',
    cnpj: '17155433000156',
    email: 'pedidos@graosdosertao.example',
    telefone: '8533330707',
    nomeContato: 'Raimundo Nonato',
    prazoEntregaDias: 3,
    produtos: [
      produto('Milho de pipoca 500 g', 'pct', 4, 'junino', 12, 30, 4.3),
      produto('Milho branco para mungunzá 500 g', 'pct', 3, 'junino', 10, 22, 5.1),
      produto('Amendoim cru 500 g', 'pct', 2, 'junino', 8, 25, 8.9),
    ],
  },
  {
    razaoSocial: 'Hortifruti Maranguape Ltda',
    cnpj: '18163352000160',
    email: 'vendas@hortifruti-maranguape.example',
    telefone: '85999990808',
    nomeContato: 'Pedro Lucas',
    prazoEntregaDias: 1,
    produtos: [
      produto('Banana prata', 'dz', 10, 'estavel', 15, 16, 6),
      produto('Milho verde (espiga)', 'un', 15, 'junino', 30, 110, 0.9),
      produto('Cheiro-verde (maço)', 'un', 8, 'estavel', 15, 22, 1.5),
    ],
  },
  {
    razaoSocial: 'Brilho Limpeza Atacado Ltda',
    cnpj: '19171271000175',
    email: 'compras@brilholimpeza.example',
    telefone: '8533330909',
    nomeContato: 'Luciana Freitas',
    prazoEntregaDias: 5,
    produtos: [
      produto('Detergente líquido 500 ml', 'un', 9, 'estavel', 36, 90, 2.2),
      produto('Água sanitária 2 L', 'un', 5, 'chuvoso', 20, 44, 5.4),
      produto('Sabão em pó 1 kg', 'pct', 4, 'estavel', 16, 15, 11.9),
    ],
  },
  {
    razaoSocial: 'Higiene Total Distribuidora Ltda',
    cnpj: '20179190000100',
    email: 'pedidos@higienetotal.example',
    telefone: '8533331010',
    nomeContato: 'Marcos Vinícius',
    prazoEntregaDias: 5,
    produtos: [
      produto('Papel higiênico (12 rolos)', 'pct', 5, 'estavel', 20, 58, 17.5),
      produto('Creme dental 90 g', 'un', 6, 'estavel', 24, 70, 3.9),
      produto('Sabonete 85 g', 'un', 10, 'verao', 40, 130, 1.99),
    ],
  },
  {
    razaoSocial: 'Sorvetes Brisa do Mar Ltda',
    cnpj: '21187109000187',
    email: 'vendas@brisadomar-sorvetes.example',
    telefone: '85999991111',
    nomeContato: 'Fernanda Lima',
    prazoEntregaDias: 2,
    produtos: [
      produto('Sorvete napolitano 2 L', 'un', 3, 'sorvete', 10, 14, 19.9),
      produto('Picolé de frutas', 'un', 25, 'sorvete', 80, 260, 1.5),
    ],
  },
  {
    razaoSocial: 'Frigorífico Ceará Carnes Ltda',
    cnpj: '22195028000101',
    email: 'comercial@cearacarnes.example',
    telefone: '8533331212',
    nomeContato: 'Antônio Carlos',
    prazoEntregaDias: 2,
    produtos: [
      produto('Frango congelado inteiro', 'un', 6, 'estavel', 20, 45, 19.9),
      produto('Linguiça calabresa 1 kg', 'pct', 3, 'festas', 10, 33, 24.9),
    ],
  },
  {
    razaoSocial: 'Granja Pacatuba Ovos Ltda',
    cnpj: '23202947000117',
    email: 'pedidos@granjapacatuba.example',
    telefone: '8533331313',
    nomeContato: 'Josefa Albuquerque',
    prazoEntregaDias: 1,
    produtos: [produto('Ovos brancos (dúzia)', 'dz', 12, 'estavel', 40, 52, 9.5)],
  },
  {
    razaoSocial: 'Temperos & Condimentos Messejana Ltda',
    cnpj: '24210866000132',
    email: 'vendas@temperosmessejana.example',
    telefone: '8533331414',
    nomeContato: 'Paulo Roberto',
    prazoEntregaDias: 4,
    produtos: [
      produto('Colorau 100 g', 'pct', 3, 'estavel', 12, 40, 2.1),
      produto('Cominho em pó 50 g', 'pct', 2, 'estavel', 8, 30, 2.4),
    ],
  },
  {
    razaoSocial: 'Descartáveis Iracema Ltda',
    cnpj: '25218785000139',
    email: 'comercial@descartaveis-iracema.example',
    telefone: '8533331515',
    nomeContato: 'Cláudia Menezes',
    prazoEntregaDias: 3,
    produtos: [
      produto('Copo descartável 200 ml (100 un)', 'pct', 4, 'festas', 15, 40, 6.5),
      produto('Prato descartável (10 un)', 'pct', 3, 'festas', 12, 13, 4.2),
    ],
  },
];

/** Gerador de números pseudoaleatórios com semente (algoritmo mulberry32). */
function criarSorteador(semente) {
  let estado = semente;
  return function sortear() {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Arredonda para cima com probabilidade igual à parte decimal: mantém a média correta. */
function arredondarComSorteio(valor, sortear) {
  const inteiro = Math.floor(valor);
  return inteiro + (sortear() < valor - inteiro ? 1 : 0);
}

function diaDaSemana(dataIso) {
  return new Date(`${dataIso}T00:00:00Z`).getUTCDay();
}

/** Vendas diárias + reposição semanal (toda segunda-feira) de um produto. */
function gerarMovimentacoes(produtoId, { vendaDiaria, perfil }, inicio, fim, sortear) {
  const movimentacoes = [
    { produtoId, tipo: 'entrada', quantidade: Math.ceil(vendaDiaria * 14), data: inicio, observacao: 'Estoque inicial' },
  ];
  let vendidoNaSemana = 0;
  for (let data = inicio; data <= fim; data = adicionarDias(data, 1)) {
    if (diaDaSemana(data) === 1 && vendidoNaSemana > 0) {
      const reposicao = Math.ceil(vendidoNaSemana / 6) * 6;
      movimentacoes.push({ produtoId, tipo: 'entrada', quantidade: reposicao, data, observacao: 'Reposição semanal' });
      vendidoNaSemana = 0;
    }
    const ruido = 0.75 + sortear() * 0.5;
    const esperado = vendaDiaria * PERFIS_SAZONAIS[perfil][indiceDoMes(data)] * PESO_DO_DIA_DA_SEMANA[diaDaSemana(data)] * ruido;
    const vendido = arredondarComSorteio(esperado, sortear);
    if (vendido > 0) {
      movimentacoes.push({ produtoId, tipo: 'saida', quantidade: vendido, data, observacao: 'Vendas do dia' });
      vendidoNaSemana += vendido;
    }
  }
  return movimentacoes;
}

async function inserirEmLotes(movimentacoes) {
  for (let inicio = 0; inicio < movimentacoes.length; inicio += TAMANHO_DO_LOTE) {
    await movimentacaoRepository.inserirEmLote(movimentacoes.slice(inicio, inicio + TAMANHO_DO_LOTE));
  }
}

function calcularInicioDoHistorico(hoje) {
  const [ano, mes] = chaveDoMes(hoje).split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1 - MESES_DE_HISTORICO, 1));
  return inicio.toISOString().slice(0, 10);
}

async function inserirDadosDemo() {
  const hoje = dataDeHoje();
  const inicio = calcularInicioDoHistorico(hoje);
  const ontem = adicionarDias(hoje, -1);
  const sortear = criarSorteador(2026);
  const movimentacoes = [];
  const produtosCriados = [];

  for (const { produtos, ...dadosDoFornecedor } of FORNECEDORES) {
    const fornecedor = await fornecedorRepository.inserir(normalizarEValidar(dadosDoFornecedor, REGRAS_DO_FORNECEDOR));
    for (const modelo of produtos) {
      const dadosDoProduto = normalizarEValidar(
        { ...modelo, fornecedorId: fornecedor.id, quantidadeEstoque: modelo.estoqueAtual },
        REGRAS_DO_PRODUTO,
      );
      const criado = await produtoRepository.inserir(dadosDoProduto);
      produtosCriados.push(criado);
      movimentacoes.push(...gerarMovimentacoes(criado.id, modelo, inicio, ontem, sortear));
    }
  }

  await inserirEmLotes(movimentacoes);
  for (const { id } of produtosCriados) await verificarReposicao(id, { enviador: enviadorDeSimulacao });
  return { fornecedores: FORNECEDORES.length, produtos: produtosCriados.length, movimentacoes: movimentacoes.length };
}

export async function apagarTodosOsDados() {
  await consultar('TRUNCATE cotacoes, movimentacoes_estoque, produtos, fornecedores RESTART IDENTITY CASCADE');
}

/** Insere os dados de demonstração. Se algo falhar no meio, limpa tudo para não deixar dados pela metade. */
export async function popularDadosDemo() {
  try {
    return await inserirDadosDemo();
  } catch (erro) {
    await apagarTodosOsDados();
    throw erro;
  }
}

export async function popularDadosDemoSeVazio() {
  if ((await fornecedorRepository.contar()) > 0) return null;
  const resumo = await popularDadosDemo();
  console.log(
    `Dados de demonstração criados: ${resumo.fornecedores} fornecedores, ${resumo.produtos} produtos, ${resumo.movimentacoes} movimentações.`,
  );
  return resumo;
}
