# E651 — CNPJ do parceiro no formulário público

**E651 (recusa do CPF no formulário público):** o botão "Continuar: criar conta ou entrar" mandava para o login *antes* de validar o documento, então CPF/CNPJ incompleto avançava sem mensagem. Agora `erroDocumentoParceiro` (`src/lib/parceiros/regras.ts`) valida no passo: vazio, CPF (frase da regra E648), menos de 14 números, dígito verificador errado. A mensagem aparece junto do campo (`sp-doc-erro`). O visitante que ainda não digitou documento segue para criar a conta (o documento nunca é guardado na ida; é pedido na volta); com algo digitado, valida no ato. O servidor segue recusando (`validarSolicitacao` usa a mesma função).

A pendência de CNPJ no painel do parceiro PF já publicado (E650) é do PR #3013 (já aberto); este PR não toca em `painel-actions.ts` nem em `faltaParaPublicar`.
