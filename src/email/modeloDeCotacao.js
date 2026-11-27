/**
 * Monta o e-mail de solicitação de cotação em duas versões: texto simples e HTML.
 * Os dados vêm do cadastro, por isso o HTML usa o template seguro (escapa tudo).
 */
import { html } from '../../shared/html.js';
import { formatarData, formatarNumero } from '../../shared/formatacao.js';
import { UNIDADES_DE_MEDIDA } from '../../shared/validacao.js';

function descreverPrazoDesejado(previsao) {
  if (previsao.diasAteRuptura === 0) return 'Nosso estoque deste item acabou; precisamos de reposição com urgência.';
  if (previsao.dataDaRuptura) return `Prazo desejado para entrega: até ${formatarData(previsao.dataDaRuptura)}.`;
  return 'Prazo de entrega: o mais breve possível dentro da sua rotina.';
}

export function montarEmailDeCotacao({ nomeDoNegocio, fornecedor, produto, quantidadeSugerida, previsao }) {
  const saudacao = fornecedor.nomeContato ? `Olá, ${fornecedor.nomeContato}!` : `Olá, equipe ${fornecedor.razaoSocial}!`;
  const unidadePorExtenso = UNIDADES_DE_MEDIDA[produto.unidade] ?? produto.unidade;
  const quantidade = `${formatarNumero(quantidadeSugerida)} ${produto.unidade} (${unidadePorExtenso})`;
  const prazo = descreverPrazoDesejado(previsao);
  const assunto = `Pedido de cotação: ${produto.nome} (${nomeDoNegocio})`;

  const texto = [
    saudacao,
    '',
    `O ${nomeDoNegocio} gostaria de receber uma cotação para o item abaixo:`,
    '',
    `Produto: ${produto.nome}`,
    `Quantidade: ${quantidade}`,
    prazo,
    '',
    'Por favor, responda este e-mail informando o preço unitário, o prazo de entrega e as condições de pagamento.',
    '',
    'Obrigado!',
    `Setor de compras, ${nomeDoNegocio}`,
  ].join('\n');

  const corpoHtml = html`
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #1C2A4A; line-height: 1.5; max-width: 560px;">
      <p>${saudacao}</p>
      <p>O ${nomeDoNegocio} gostaria de receber uma cotação para o item abaixo:</p>
      <table style="border-collapse: collapse; margin: 12px 0;">
        <tr><td style="padding: 4px 16px 4px 0; color: #4F5B73;">Produto</td><td><strong>${produto.nome}</strong></td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color: #4F5B73;">Quantidade</td><td><strong>${quantidade}</strong></td></tr>
      </table>
      <p>${prazo}</p>
      <p>Por favor, responda este e-mail informando o <strong>preço unitário</strong>, o <strong>prazo de entrega</strong>
        e as <strong>condições de pagamento</strong>.</p>
      <p>Obrigado!<br>Setor de compras, ${nomeDoNegocio}</p>
    </div>`;

  return { assunto, texto, html: String(corpoHtml) };
}
