# Massa do grupo A conferida no banco (10/11, 10:01–10:05 UTC): E759, E787, E350, E351, E575–E577 e E414

- **Para:** o trabalhador de QA agendado pelo chat principal, com a chave da porta (`/qa/entrar`).
- **Origem:** Pista QA. Só SELECT de leitura, sem nenhuma escrita. Contas citadas pelo local-part do e-mail, todas `is_teste=true`.
- **Regra de execução:** um login por vez, pela porta, conferindo a conta ativa na tela antes de cada clique. Anúncios reais e o piloto da Márcia ficam intocados. Os 2 pedidos de parceria pendentes de contas **não** teste também ficam intocados.

## Contas conferidas (`profiles`)

| Conta | id (8) | is_teste | Papel | Observação |
|---|---|---|---|---|
| `qa-muse-1` | `2982eee5` | sim | `role=admin`, `qa_admin=true` | Entra pela porta como admin_qa, sem TOTP, até 31/12/2026 |
| `proprietario1` | `7216d0e9` | sim | owner / `papel_ativo=proprietario` | Dono do `a0276a00` (35 anúncios) |
| `inquilino2` | `3555816b` | sim | tenant / morador | Tem 2 rascunhos próprios (`70698374`, `73817620`), que não interferem |
| `cadastro1` | `5a7e6b54` | sim | tenant / morador | 1 rascunho: `804dbc8e` |
| `proprietario-qa` | `309d13dc` | sim | owner, `papel_ativo` nulo | 1 rascunho: `48f16050` |
| `proprietario2` | `5a9a23cd` | sim | owner / proprietario | 4 rascunhos (ver o E787) |
| Reservadas a outros itens | `cadastro2` `dec5f8b6` (E727/E728), `cadastro3` `76050170` (E687), `teste-qa-2026` `22eccf89` (E430-B) | sim | — | **Não usar** no E350 nem no E351 |

## E759: aviso D-7 (instruções de chegada liberadas)

**Massa (SELECT):**
- Anúncio `a0276a00-0000-4000-8000-000000000001`, "[TESTE QA] Resumo semanal 0276 A": `active`, do `proprietario1`, 8 fotos, R$ 3.200/mês.
- Período: `min_period_days=30` e `max_period_days=180`. Disponível desde 01/11.
- Faixa: `faixas_aceitas=[media_estadia]`. Garantia: `garantias_aceitas=[caucao_avista]`.
- 0 contratos. `checkin_after` e `checkout_before` são **nulos**.
- `imovel_instrucoes_chegada`: **0 linhas.** O e-mail do D-7 vai sair na variante "instruções ainda não lidas, veja a página" (a varredura ampliada do `route.ts:308-309`). **Isso não é defeito.** Se a prova quiser as instruções no corpo (E209), o `proprietario1` preenche "Instruções de chegada" do imóvel **antes** do cron.

**Regra que o cron aplica** (na `main`: bloco 7 `route.ts:289-335` e bloco 8 `route.ts:349-375`, `jornada-mensagens.ts:68,99-107`, `instrucoes.ts:121`, `contrato-estado.ts:53`):
- contrato com `status='ativo'`;
- o 1º bloco começando em 17/11;
- `assinado_proprietario_em` e `assinado_inquilino_em` preenchidos;
- um `pagamentos_bloco` com `tipo='aluguel'`, **`confirmado_pelo_inquilino=true`** e `anulado_em` nulo. **O morador confirma**; o dono só registrar não basta;
- dia BRT do cron = 17/11 − 7 = **10/11**.

**Passo logado que falta** (trabalhador de QA agendado, chave da porta), **antes das 13:00 UTC de 10/11:**
1. Entrar como `qa-muse-1` e criar a "Nova jornada de teste" no `a0276a00`: dono `proprietario1`, morador `inquilino2`, **entrada 17/11**, faixa média, caução à vista.
2. Entrar como `proprietario1`, abrir o Fechamento e assinar.
3. Entrar como `inquilino2` e assinar. O código chega em `emails_teste` (E654).
4. Entrar como `proprietario1` e registrar o 1º aluguel.
5. Entrar como `inquilino2` e **confirmar o recebimento** desse aluguel.
6. Opcional: como `proprietario1`, preencher as instruções de chegada.
7. Conferir na tela que o contrato aparece como ativo.

**Leitura depois do cron** (Pista QA, SELECT): os 3 SELECTs da `2026-11-10-0930.md`. O esperado é:
- `jornada_d7` **e** `estadia_instrucoes_liberadas` para o `3555816b…` (dois avisos no D-7, os dois exigem o pagamento confirmado);
- `contrato_eventos` `instrucoes_liberadas` com `inicio=2026-11-17`;
- `emails_teste.evento` `jornada_d7` e `estadia_instrucoes_liberadas`;
- a `jornada_confirmacao` sai pelas assinaturas (janela) **ou** quando a estadia fica paga com a entrada futura.

> Corrigido às 10:30: a primeira versão desta seção foi escrita lendo o código de uma branch atrás da `main`, sem o `jornada_d7`.

**Se perder as 13:00:** usar entrada = dia + 8 e ler no cron do dia seguinte.

## E787 / #3696: "Continue seu anúncio" no Início do dono. **A massa da rodada 06:20 está ERRADA em 2 dos 3 casos**

**Como o Início escolhe:** `getLatestDraft` (`actions.ts:2274-2281`) pega o rascunho **mais recente** por `created_at`. A foto é a 1ª por `sort_order` em `property_photos`, e, sem linha ali, a 1ª do `draft_data` (`dashboard/page.tsx:83-100`).

| Caso da rodada 06:20 | O que o banco mostra | Consequência |
|---|---|---|
| `cadastro1` / `804dbc8e` "com fotos quebradas" → plano B | 8 linhas em `property_photos`, **8/8 com arquivo** em `storage.objects` (webp de 3,9–5,6 KB). Baixei um: **webp válido de 1200×800, decodifica**. É um placeholder verde com moldura e legenda, não uma foto real. "Quebradas" (E644) quer dizer "não são fotos reais", não "não carregam" | A imagem **pinta**: `onLoad` com `naturalWidth>0`. Esse caso **não reproduz** o "em branco" e serve como **controle de foto que carrega** |
| `proprietario-qa` / `48f16050` sem foto → espaço desenhado | 0 em `property_photos` e 0 no `draft_data`; é o único rascunho | **Confere** |
| `proprietario2` controle "foto boa" | O rascunho mais recente é o **`4614f984`** (07/11 23:14), com **0 fotos** na tabela e no `draft_data`. O `31e6ce6d`, com 8 fotos, é só o 3º | O Início mostra o **espaço desenhado**, não uma foto. Esse controle **não serve** |

**Massa corrigida, sem escrever nada no banco:**
- **Foto que carrega:** `cadastro1` (`804dbc8e`). Deve aparecer a imagem placeholder.
- **Sem foto:** `proprietario-qa` (`48f16050`). Deve aparecer o espaço desenhado, com moldura tracejada e câmera.
- **Foto que NÃO pinta (o caso do relato):** **não existe** em dado. Reproduzir no navegador, logado como `cadastro1`, interceptando a imagem do storage:
  - (a) `page.route('**/property-photos/5a7e6b54-*/**', r => r.abort())`: erro imediato;
  - (b) a mesma rota **sem responder** (pendurar): testa o prazo de 8 s (`PRAZO_FOTO_MS`).
  - Esperado depois do merge do #3696: o plano B em coluna única, nos dois casos. **Antes** do merge, (b) deve deixar a área em branco. Esse é o "antes".
- Telas: **390** e 1280.

**Passo logado que falta** (trabalhador de QA agendado, depois do merge do #3696): os 3 casos acima, com print de cada um, e o "antes" do caso (b) se der tempo de fazê-lo antes do merge.

## E350: modelos de recusa de parceiro

- **Massa (SELECT `parceiro_solicitacoes`):** 5 `ativada` (todas de teste), 3 `recusada` (mistas) e **2 `pendente`, ambas de conta NÃO teste. Intocadas.** Não há pedido pendente de conta de teste.
- **Campos do pedido** (colunas): `email`, `nome`, `tipo_pessoa`, `documento`, `telefone`, `categorias`, `cidades`, mais `portfolio_url`, `descricao` e `dados_categoria`.
- **Conta nova:** criada pela porta, com e-mail no padrão `QA_EMAIL_PADRAO` (regex da env, que esta pista não lê). A porta grava `is_teste=true` na mesma operação.

**Passo logado que falta** (trabalhador de QA agendado):
1. Conta nova A → `/parceiros` → pedido completo.
2. `qa-muse-1` → `/admin/parceiros` a 390 e 1280 → modelos de "Motivo da recusa" (`fichas.tsx:283`) → recusar com um modelo.

**Leitura:**
- `parceiro_solicitacoes.status='recusada'` e `motivo_recusa` preenchido;
- `emails_teste.evento='parceria_recusada'` (nome conferido no código e no histórico: 1 em 01/11);
- o envio do pedido gera `parceria_recebida`.

## E351: aprovação de parceiro de ponta a ponta. **Correção do roteiro da rodada 02:25**

- O roteiro da 02:25 esperava `status = ativada` logo depois de **Aprovar**. Pelo código, Aprovar grava **`aprovada`** e manda `parceria_aprovada`.
- Vira **`ativada`** só quando a conta usa o link de ativação (`token_ativacao_hash`, `token_expira_em`).
- O estado intermediário é o do E576 (`situacao-conta.ts:16`, `aprovada_sem_pagina`).

**Passo logado que falta:**
1. Conta nova B (≠ A) → pedido completo.
2. `qa-muse-1` → Aprovar.
3. Ler `status='aprovada'` e `emails_teste.evento='parceria_aprovada'` (E575: o corpo do e-mail, `montar-email.ts`).
4. **Antes** de ativar, como B: o Início mostra o aviso de ativação (`dashboard/page.tsx:162`) e Conta › Papéis mostra "aprovada sem página" (E576).
5. Ativar pelo link do e-mail, ler `status='ativada'` e ver o painel do parceiro.

## E575–E577

- **E575:** o e-mail `parceria_aprovada` do passo 3 do E351.
- **E576:** o passo 4 do E351.
- **E577:** depois do E350, em `/admin/parceiros` → aba Recusadas. O pedido de A aparece como "Recusado", só leitura, sem checklist nem Aprovar/Recusar (`fichas.tsx:119,265`, `fila-pendentes.ts:53-65`), e nunca como "Não aprovável ainda · faltam N itens".
- Mesmo executor e mesma sessão do E350/E351.

## E414: "Medir depois"

- **Massa:** `804dbc8e` do `cadastro1`, passo 5, com **0** linhas em `internet_medicoes` (linha de base 10/11).
- **Passo logado que falta:** o roteiro da rodada 02:25 (§5) sem mudança.
- **Leitura:** continua 0 linhas em `internet_medicoes` para `804dbc8e` depois do "Medir depois".

## Ordem sugerida para o trabalhador (um login por vez)

1. **E759**, antes das 13:00 UTC.
2. E350 → E577 (conta A).
3. E351 → E575 → E576 (conta B).
4. E414 (`cadastro1`).
5. E787, depois do merge do #3696. Os casos `cadastro1` e `proprietario-qa` podem ser fotografados já, como o "antes".
