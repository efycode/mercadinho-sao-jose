-- Mercadinho São José: estrutura do banco de dados (PostgreSQL).
-- Executado automaticamente quando o servidor inicia. Todos os comandos são idempotentes
-- (podem rodar várias vezes sem erro e sem apagar dados).
--
-- As restrições (CHECK, UNIQUE, FOREIGN KEY) repetem as regras do cenário no próprio banco:
-- é a última linha de defesa, caso algum dado inválido passe pelas camadas de cima.

CREATE TABLE IF NOT EXISTS fornecedores (
  id                  SERIAL       PRIMARY KEY,
  razao_social        VARCHAR(120) NOT NULL,
  cnpj                CHAR(14)     NOT NULL,
  email               VARCHAR(160) NOT NULL,
  telefone            VARCHAR(11)  NOT NULL,
  nome_contato        VARCHAR(80),
  prazo_entrega_dias  SMALLINT     NOT NULL DEFAULT 3,
  criado_em           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fornecedores_cnpj        UNIQUE (cnpj),
  CONSTRAINT ck_fornecedores_cnpj        CHECK (cnpj ~ '^[0-9]{14}$'),
  CONSTRAINT ck_fornecedores_telefone    CHECK (telefone ~ '^[0-9]{10,11}$'),
  CONSTRAINT ck_fornecedores_prazo       CHECK (prazo_entrega_dias BETWEEN 0 AND 60)
);

CREATE TABLE IF NOT EXISTS produtos (
  id                  SERIAL        PRIMARY KEY,
  fornecedor_id       INTEGER       NOT NULL,
  nome                VARCHAR(120)  NOT NULL,
  unidade             VARCHAR(3)    NOT NULL,
  quantidade_estoque  INTEGER       NOT NULL,
  estoque_minimo      INTEGER       NOT NULL DEFAULT 0,
  preco_custo         NUMERIC(10,2),
  criado_em           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- ON DELETE RESTRICT: o banco também impede excluir fornecedor que ainda tem produtos.
  CONSTRAINT fk_produtos_fornecedor     FOREIGN KEY (fornecedor_id) REFERENCES fornecedores (id) ON DELETE RESTRICT,
  CONSTRAINT ck_produtos_estoque        CHECK (quantidade_estoque >= 0),
  CONSTRAINT ck_produtos_estoque_minimo CHECK (estoque_minimo >= 0),
  CONSTRAINT ck_produtos_preco          CHECK (preco_custo IS NULL OR preco_custo > 0),
  CONSTRAINT ck_produtos_unidade        CHECK (unidade IN ('un', 'cx', 'pct', 'fd', 'dz', 'sc'))
);

CREATE INDEX IF NOT EXISTS ix_produtos_fornecedor ON produtos (fornecedor_id);

-- Histórico de entradas (recebimentos) e saídas (vendas): base da previsão e da sazonalidade.
CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id           SERIAL       PRIMARY KEY,
  produto_id   INTEGER      NOT NULL,
  tipo         VARCHAR(7)   NOT NULL,
  quantidade   INTEGER      NOT NULL,
  data         DATE         NOT NULL,
  observacao   VARCHAR(200),
  criado_em    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_movimentacoes_produto   FOREIGN KEY (produto_id) REFERENCES produtos (id) ON DELETE CASCADE,
  CONSTRAINT ck_movimentacoes_tipo      CHECK (tipo IN ('entrada', 'saida')),
  CONSTRAINT ck_movimentacoes_quantidade CHECK (quantidade > 0)
);

CREATE INDEX IF NOT EXISTS ix_movimentacoes_produto_data ON movimentacoes_estoque (produto_id, data);

-- Pedidos de cotação enviados por e-mail aos fornecedores.
CREATE TABLE IF NOT EXISTS cotacoes (
  id                   SERIAL       PRIMARY KEY,
  produto_id           INTEGER      NOT NULL,
  fornecedor_id        INTEGER      NOT NULL,
  quantidade_sugerida  INTEGER      NOT NULL,
  status               VARCHAR(12)  NOT NULL DEFAULT 'pendente',
  origem               VARCHAR(10)  NOT NULL,
  email_destino        VARCHAR(160) NOT NULL,
  assunto              VARCHAR(200) NOT NULL,
  corpo_texto          TEXT         NOT NULL,
  corpo_html           TEXT         NOT NULL,
  modo_envio           VARCHAR(10)  NOT NULL,
  erro_envio           VARCHAR(500),
  criada_em            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  enviada_em           TIMESTAMPTZ,
  atualizada_em        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_cotacoes_produto        FOREIGN KEY (produto_id) REFERENCES produtos (id) ON DELETE CASCADE,
  CONSTRAINT fk_cotacoes_fornecedor     FOREIGN KEY (fornecedor_id) REFERENCES fornecedores (id) ON DELETE CASCADE,
  CONSTRAINT ck_cotacoes_quantidade     CHECK (quantidade_sugerida > 0),
  CONSTRAINT ck_cotacoes_status         CHECK (status IN ('pendente', 'enviada', 'falha_envio', 'concluida', 'cancelada')),
  CONSTRAINT ck_cotacoes_origem         CHECK (origem IN ('automatica', 'manual'))
);

-- No máximo uma cotação em aberto por produto: evita mandar o mesmo e-mail repetidas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cotacoes_uma_aberta_por_produto
  ON cotacoes (produto_id)
  WHERE status IN ('pendente', 'enviada', 'falha_envio');

CREATE INDEX IF NOT EXISTS ix_cotacoes_criada_em ON cotacoes (criada_em DESC);

-- Acesso ao sistema (tela de login). A senha nunca é guardada: só o hash scrypt dela,
-- com um sal aleatório por usuário (veja src/seguranca/senha.js).
CREATE TABLE IF NOT EXISTS usuarios (
  id          SERIAL       PRIMARY KEY,
  usuario     VARCHAR(40)  NOT NULL,
  nome        VARCHAR(80)  NOT NULL,
  senha_hash  TEXT         NOT NULL,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_usuarios_usuario UNIQUE (usuario),
  CONSTRAINT ck_usuarios_usuario CHECK (usuario ~ '^[a-z0-9._-]{3,40}$')
);

-- Cada login cria uma sessão. O navegador guarda um código aleatório num cookie que o
-- JavaScript não lê (HttpOnly); o banco guarda só o hash SHA-256 desse código. Assim, quem
-- lesse o banco não conseguiria usar as sessões. Sair do sistema apaga a sessão.
CREATE TABLE IF NOT EXISTS sessoes (
  token_hash  CHAR(64)     PRIMARY KEY,
  usuario_id  INTEGER      NOT NULL,
  criada_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expira_em   TIMESTAMPTZ  NOT NULL,
  CONSTRAINT fk_sessoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_sessoes_expira_em ON sessoes (expira_em);
