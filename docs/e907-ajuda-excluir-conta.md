# E907 — artigo da Ajuda: como excluir a conta

**Defeito:** a Central de Ajuda não tinha artigo sobre excluir a conta.

**Correção:** um artigo curto, "Como excluo a minha conta?" (id `excluir-conta` em `src/lib/atendimento/faq.ts`), no tema "Segurança e conta". O resumo do tema passa a citar a exclusão. O link "Excluir a conta" leva a /excluir-conta.

O texto usa só os fatos da página /excluir-conta:
- Os dois caminhos: na Conta (Conta › Privacidade › "Excluir minha conta", sem confirmação por e-mail) e sem entrar (/excluir-conta, com link de confirmação por e-mail).
- O bloqueio: com locação ou contrato em vigor, a exclusão fica bloqueada até o encerramento.
- Quem já teve contratos: a identidade é removida e os contratos ficam sem identificação pelo prazo exigido por lei.
- Os prazos: a exclusão é feita na hora da confirmação, e as cópias em backups somem em até 30 dias.

A busca da Ajuda acha o artigo por "excluir", "apagar", "deletar", "encerrar conta" e "sair da viva".

**Teste:** `src/lib/ajuda/e907-excluir-conta.test.ts` (4 casos), vermelho na main e verde na branch.
