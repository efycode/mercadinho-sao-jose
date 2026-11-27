/**
 * Único ponto da interface que conversa com o serviço Web (/api).
 * Centraliza o tratamento de erros: falha de rede, erros de validação (com a mensagem
 * de cada campo) e erros do servidor viram um ErroDaApi com texto claro para o usuário.
 * Se a sessão de login vencer (HTTP 401), avisa o resto da interface pelo evento "sessao-encerrada".
 */

export class ErroDaApi extends Error {
  constructor(mensagem, status, camposInvalidos) {
    super(mensagem);
    this.name = 'ErroDaApi';
    this.status = status;
    this.camposInvalidos = camposInvalidos;
  }
}

async function lerCorpo(resposta) {
  try {
    return await resposta.json();
  } catch {
    return null;
  }
}

async function requisitar(metodo, caminho, corpo) {
  let resposta;
  try {
    resposta = await fetch(`/api${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? {} : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroDaApi('Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.', 0);
  }

  if (resposta.status === 204) return null;
  if (resposta.status === 401 && caminho !== '/sessao') window.dispatchEvent(new CustomEvent('sessao-encerrada'));
  const dados = await lerCorpo(resposta);
  if (!resposta.ok) {
    throw new ErroDaApi(dados?.mensagem ?? `O servidor respondeu com erro ${resposta.status}.`, resposta.status, dados?.erros);
  }
  return dados;
}

export const api = Object.freeze({
  obter: (caminho) => requisitar('GET', caminho),
  criar: (caminho, corpo = {}) => requisitar('POST', caminho, corpo),
  substituir: (caminho, corpo) => requisitar('PUT', caminho, corpo),
  alterar: (caminho, corpo) => requisitar('PATCH', caminho, corpo),
  excluir: (caminho) => requisitar('DELETE', caminho),
});

/** Monta "?a=1&b=2" ignorando valores vazios. */
export function montarConsulta(parametros) {
  const consulta = new URLSearchParams();
  for (const [nome, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') consulta.set(nome, valor);
  }
  const texto = consulta.toString();
  return texto ? `?${texto}` : '';
}
