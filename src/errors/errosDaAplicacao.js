/**
 * Erros previstos pela aplicação. Cada um já carrega o status HTTP adequado,
 * e o tratador central (middlewares/tratadorDeErros.js) transforma tudo em JSON.
 */

export class ErroDaAplicacao extends Error {
  constructor(mensagem, statusHttp, camposInvalidos) {
    super(mensagem);
    this.name = this.constructor.name;
    this.statusHttp = statusHttp;
    this.camposInvalidos = camposInvalidos;
  }
}

/** 400: dados de entrada inválidos. camposInvalidos = { campo: mensagem }. */
export class ErroDeValidacao extends ErroDaAplicacao {
  constructor(mensagem = 'Há campos inválidos. Revise os campos destacados.', camposInvalidos) {
    super(mensagem, 400, camposInvalidos);
  }
}

/** 401: é preciso entrar no sistema, ou o usuário e a senha não conferem. */
export class ErroDeAutenticacao extends ErroDaAplicacao {
  constructor(mensagem = 'Entre no sistema para continuar.') {
    super(mensagem, 401);
  }
}

/** 404: o registro pedido não existe. */
export class ErroNaoEncontrado extends ErroDaAplicacao {
  constructor(mensagem) {
    super(mensagem, 404);
  }
}

/** 409: a operação conflita com o estado atual dos dados (ex.: fornecedor com produtos). */
export class ErroDeConflito extends ErroDaAplicacao {
  constructor(mensagem, camposInvalidos) {
    super(mensagem, 409, camposInvalidos);
  }
}
