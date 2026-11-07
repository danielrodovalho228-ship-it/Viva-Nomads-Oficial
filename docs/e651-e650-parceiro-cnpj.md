# E651 e E650 — CNPJ do parceiro

**E651 (recusa do CPF no formulário público):** o botão "Continuar: criar conta ou entrar" mandava para o login *antes* de validar o documento, então CPF/CNPJ incompleto avançava sem mensagem. Agora `erroDocumentoParceiro` (`src/lib/parceiros/regras.ts`) valida no passo: vazio, CPF (frase da regra E648), menos de 14 números, dígito verificador errado. A mensagem aparece junto do campo (`sp-doc-erro`). O visitante que ainda não digitou documento segue para criar a conta (o documento nunca é guardado na ida; é pedido na volta); com algo digitado, valida no ato. O servidor segue recusando (`validarSolicitacao` usa a mesma função).

**E650 (painel do parceiro PF já publicado):** `faltaParaPublicar` ganhou `tipoPessoaCnpj`, que o painel passa SEMPRE; a pendência de CNPJ aparece para todo parceiro com `tipo_pessoa ≠ pj`, publicado ou não. A pendência da nota continua só na primeira publicação (quem esteve no ar não é cobrado por ela).

Testes: `src/lib/parceiros/e651-e650-cnpj.test.ts`; specs de lab t236 e t441 ajustados ao novo elemento da mensagem. Módulos rodados inteiros: `src/lib/parceiros`, `src/components`, `src/lib/estilo`, `src/lib/lab`; `tsc` limpo. Sem migração, sem prova ao vivo.
