# E699 (a)/(c) — massa de identidade PENDENTE (migração 0330)

**O que a prova precisa:** uma conta de teste DONA, com um anúncio ainda não publicado, com CPF e SEM laudo de identidade válido. Estado da API `/api/caf/status`: `identidade.estado = "simulavel"` e `temCpf = true`, que a trava de publicação lê como **pendente** (o link "Resolver" leva a `/dashboard/verificacao`).

**O que existia (produção, só leitura, 08/11):**
| Conta de teste | Papel | Laudo válido | CPF | Rascunhos | Estado da trava |
|---|---|---|---|---|---|
| proprietario1 | dona | sim | n/d | 14 | ok |
| proprietario2 | dona | sim (1 de 2) | sim (0297) | 4 | ok |
| proprietario3cnpj | dona (CNPJ) | não | não | 3 | sem_cpf (link para Conta › Dados) |
| proprietario-qa@mail-teste.com.br | dona | não | **não** | 1 | sem_cpf |

Nenhuma estava no ramo "pendente" (com CPF e sem laudo): daí o E699 seguir parcial.

**Massa (0330):** grava o CPF de teste `000.000.002-72` na conta `proprietario-qa@mail-teste.com.br` (`is_teste`, 1 rascunho, sem laudo). Não cria laudo, não confirma identidade, não toca anúncio, chave nem outra conta. Rollback: volta ao "sem CPF".

**Depois da aplicação:** entrar com `proprietario-qa@mail-teste.com.br`.
- (a) `/dashboard/imoveis`: o rascunho mostra "Falta para publicar" com a linha **Confirmação de identidade** (`data-testid="pendencia-identidade"`).
- (c) etapa de publicação do anúncio: a trava de identidade com o link **Resolver** para `/dashboard/verificacao`.
- Para voltar ao estado "sem CPF" (ramo `sem_cpf`): rollback da 0330, ou usar `proprietario3cnpj`.

A prova ao vivo é do chat principal/QA; esta mudança só prepara a massa.
