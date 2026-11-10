# Massa do grupo A conferida no banco, parte 2 (10/11, 10:08–10:20 UTC): E719, E721, E727/E728, E699, E672/E675 e E687

- **Continua:** [parte 1](2026-11-10-massa-grupo-a-conferida.md) (E759, E787, E350, E351, E575–E577 e E414).
- **Executor de todos os passos logados:** o trabalhador de QA agendado pelo chat principal, com a chave da porta.
- **Esta pista:** só SELECT de leitura, sem nenhuma escrita.
- **Roteiros completos:** `2026-11-09-massa-e759-e719-e721.md` e `2026-11-09-massa-e699-e672-e675-e687.md`. Aqui ficam só a conferência e as correções.

## Correção que vale para todos os roteiros de 09/11

- Os roteiros pedem "**`qa-muse-1` com TOTP**" para aprovar ou recusar parceiro. **Não é preciso TOTP:** pela porta, o `qa-muse-1` (`qa_admin=true`) entra como admin_qa sem 2FA até 31/12/2026.
- **A porta aceita `?destino=`** (`src/app/qa/entrar/page.tsx:26`), por exemplo `/qa/entrar?email=…&destino=/parceiros`.

## E719: o cartão do contrato acompanha a avaliação

| Massa | Banco às 10:10 | Confere? |
|---|---|---|
| `a0268a00-…-000000000011`: `cadastro1` → `proprietario1` | `encerrado_sem_renovacao` em **04/11**; avaliações `inquilino:publicada` e `proprietario:publicada`; anúncio `paused` | ✔ ("Publicada" nos dois lados). Janela até 18/11 |
| `d5d50247-…-00000000c001`: `inquilino2` → `proprietario1` | `encerrado_sem_renovacao` em **01/11**; **0 avaliações**; anúncio `active` | ✔ ("Falta a sua avaliação"). **A janela fecha em 15/11** (`DIAS_PRAZO_AVALIACAO=14`, `avaliacoes.ts:60`) |
| Contratos de teste encerrados nos últimos 14 dias | **2**, exatamente esses dois | Não há reserva. O passo 4 (enviar) consome a perna "Falta" |

**Passo logado que falta:** os passos 1 a 5 do roteiro, sem mudança.
- Logins: `cadastro1`, `proprietario1` e `inquilino2`; não precisa de admin.
- **Fazer até 15/11**, com os passos 1 a 3 antes do 4.

## E721: o push adiado no silêncio agrupa a conversa sem o erro 42P10

| Pré-condição | Banco às 10:10 | Confere? |
|---|---|---|
| Índice único completo `push_adiados_user_grupo (user_id, grupo)` | existe; o parcial antigo não existe | ✔ |
| `push_adiados` | **0 linhas** (linha de base) | ✔ |
| Conversa `a92bb7fc…` (`inquilino1` ↔ `proprietario1`) | 2 mensagens, a última em 06/11; anúncio "[TESTE QA] Resumo semanal 0276 B" `active` | ✔ |
| Reserva `218ce0d1…` | 5 mensagens, a última em 02/11; mesmo anúncio | ✔ |

- **Horário:** a janela de hoje (01:00–10:00 UTC) **já passou** quando esta sequência começou, às 10:08.
- **Próxima janela:** 11/11, das 01:00 às 10:00 UTC, de preferência antes das 09:30.
- **Passo logado que falta:** como `inquilino1`, 2 mensagens com 1 min de intervalo, sem abrir a conversa como `proprietario1`.
- **Leitura depois** (esta pista): o SELECT de `push_adiados` do roteiro. As colunas `user_id`, `evento`, `titulo`, `corpo`, `url`, `grupo` e `sair_em` foram conferidas.

## E727/E728: "Quero ser parceiro" com sessão, e o CNPJ preservado

| Massa | Banco às 10:10 | Confere? |
|---|---|---|
| `cadastro2` (escolhida) | 0 pedidos, 0 parceiro, 0 mensagens | ✔ |
| Reservas `cadastro3` e `qa-muse-2` | 0, 0, 0 | ✔. Mas a `cadastro3` está reservada ao E687 (abaixo), então a reserva do E727 é só a `qa-muse-2` |
| CNPJ `11.222.333/0001-81` | 1 pedido já o usa; o código não trava documento repetido | ✔ |

**Ajuste do passo 2 à regra "login só pela porta":** o rascunho do E728 vive no `sessionStorage` **da aba**.
1. Na mesma aba anônima, tocar "Continuar: criar conta ou entrar" e **conferir que a URL vira `/auth`**. Essa é a prova do E727 sem sessão.
2. **Na mesma aba**, abrir `/qa/entrar?email=<cadastro2>&destino=/parceiros` e entrar pela porta.
3. Seguir no passo 3: CNPJ, nome, telefone e categoria **preenchidos**, e o aceite **desmarcado**.

Não usar o login por código de e-mail do `/auth`.

**Limpeza:** `qa-muse-1` pela porta (sem TOTP) recusa o pedido da `cadastro2`.

## E699: identidade pendente revelada desde o passo 1

| Massa | Banco às 10:12 | Confere? |
|---|---|---|
| `proprietario-qa` | CPF de teste com final `0272`, `is_verified=false`, `person_type=pf`, `verification_progress=0`; 1 rascunho `48f16050` | ✔ |

**Passo logado que falta:** os passos 1 a 4 do roteiro, só leitura, a 390 e a 1280.
- **Ordem:** junto do E761/E748, **antes** do E746, que mexe no CEP do mesmo rascunho.
- O `48f16050` também é o caso "sem foto" do E787: **não** subir foto nele.

## E672/E675: 2ª remarcação (Aditivo 2) e o pedido do código

| Massa | Banco às 10:12 | Confere? |
|---|---|---|
| Contrato `67329884-0978-4c82-aa1d-4fa4f66ae6c5` | `ativo`, `inquilino1` → `proprietario2`, assinado pelos dois; anúncio `active` | ✔ |
| Bloco | 1: **17/01/2027 → 17/03/2027**, `ativo` | ✔ |
| Aditivos (`contrato_aditivos`) | 1 só: nº 1, `assinado` em 07/11, de 10/01 para 17/01, proposto pelo `inquilino` | ✔. O próximo será o nº 2 |

**Passo logado que falta:** os passos 1 a 5 do roteiro.
- Logins: `inquilino1` e `proprietario2`.
- Os códigos chegam em `emails_teste`.
- **Leitura depois:** `contrato_aditivos` com `numero=2` e `status='assinado'`, mais `contrato_aditivo_assinaturas` e `contrato_aditivo_codigos` (tabelas conferidas).

## E687: parceiro de Mudança aprovado vê a empresa e o veículo

| Massa | Banco às 10:12 | Confere? |
|---|---|---|
| `cadastro3` | 0 pedidos, 0 parceiro | ✔ |
| CNPJ `11.444.777/0001-61` | 0 usos | ✔ |
| O54 (a 0329 não criou o parceiro no `inquilino2`) | o `inquilino2` tem 1 pedido `recusada` e nenhum parceiro | **segue aberto**. A massa vai pela tela, conforme o roteiro |

**Passo logado que falta:**
1. `cadastro3` faz o pedido de Mudança.
2. `qa-muse-1` (pela porta, sem TOTP) aprova.
3. `cadastro3` abre `/dashboard/parceiro` a 390 e 1280.

**Leitura:** `parceiro_solicitacoes.status='aprovada'` (não `ativada`, ver a parte 1) e `parceiros.dados_categoria` com a empresa e o veículo.

## Ordem sugerida (soma com a parte 1)

1. E759, antes das 13:00 de hoje.
2. E699 + E761/E748, depois o E746.
3. E719, até 15/11.
4. E672/E675.
5. E350 → E577; E351 → E575 → E576; E727/E728; E687.
6. E414.
7. E721, na janela de 11/11, das 01:00 às 10:00 UTC.
8. E787, depois do merge do #3696.

**Próxima parte desta pista:** a conferência de `massa-e761-e749-e746-e430-e458`, `massa-e782-e784-e783-e764` e `massa-e500-e509-e547`.
