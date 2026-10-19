# Massa de teste

Criada por `npm run seed:massa` (`scripts/seed-teste/`), só em projeto de teste: o script recusa a URL de produção. Rodar de novo não duplica nada. As contas vêm das variáveis `TESTES_<CONTA>_EMAIL/_SENHA/_NOME`; todas ficam com `is_teste`, então chamados delas nascem simulados (sem alerta de SLA nem e-mail à equipe). A fonte é `scripts/seed-teste/massa.mjs`.

## Contas

| Conta | Papel | Variáveis |
|---|---|---|
| INQUILINO | inquilino | `TESTES_INQUILINO_*` |
| INQUILINO2 | inquilino (opcional) | `TESTES_INQUILINO2_*` |
| PROPRIETARIO | proprietário | `TESTES_PROPRIETARIO_*` |
| ADMIN | admin | `TESTES_ADMIN_*` |

## Imóveis (dono: PROPRIETARIO)

| Código | Título | Preço/mês |
|---|---|---|
| `11111111-1111-4111-8111-111111111111` | Studio mobiliado — conta de teste (E2E) | R$ 3.200 |
| `11111111-1111-4111-8111-111111111112` | Apartamento mobiliado — conta de teste (QA) | R$ 4.500 |

## Chamados

| Código | Dono | Assunto | Estado |
|---|---|---|---|
| `22222222-2222-4222-8222-222222222201` | INQUILINO | [Teste] Chamado aberto, sem resposta | aberto |
| `22222222-2222-4222-8222-222222222202` | INQUILINO | [Teste] Chamado em andamento | em_andamento |
| `22222222-2222-4222-8222-222222222203` | PROPRIETARIO | [Teste] Chamado resolvido | resolvido |

## Ainda não coberto

Contratos de teste (a ordem 7436a29a pede contratos no seed): ficam para a próxima parte.
