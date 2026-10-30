# Roteiro de disparo ao vivo — e-mails E204, E205 e E206 (massa de TESTE em produção)

Levantado em 30/10/2026 lendo o código da `main` e o banco de produção (só leitura). **Nada foi disparado.** O Muse dispara
cada gatilho com a Pista B no circuito. Todo e-mail das contas abaixo cai na **caixa de teste** (`emails_teste`, Conta →
Caixa de e-mails de teste), porque todas são `is_teste`. Quem entra é a **porta de QA** (`/qa/entrar`).

Regras da rodada:
- Não tocar na seed do D-5: o contrato `d5d50247…` no Premium `330ebf37`, o parceiro "[TESTE QA] Limpeza D-5" (proprietario3cnpj) e o pedido aberto dele.
- Não mexer na chave `AUTOMACOES_ATIVO` (fica `1`), no 2FA, em `is_admin()` nem em `ADMIN_2FA_OBRIGATORIA`.
- Sem migração nova para os gatilhos de 1 a 9. Para o 10 e o 13, veja "Lacunas" no fim.

## Massa que já existe (produção, 30/10)

| Papel | Conta | Para quê |
|---|---|---|
| Proprietário | proprietario1@ | dono dos anúncios de teste: `ddf86c66` "[TESTE QA] Apto mobiliado 2 quartos" (ativo), `a0259000…0001` "[TESTE QA] Prova de publicação" (ativo) e Premium/Conforto/Essencial |
| Morador | inquilino1@ (Lucas) | candidatura **aceita** `61729f0b` (Premium, 05/01→05/02/2027); contrato **ativo** `11281a61` no `ddf86c66` (18/10/2026→15/02/2027); bloco 2 `pendente_aceite` (17/12→14/02) |
| Morador | inquilino2@ (Ana) | candidatura **aceita** `f2c00f6a` (Premium, entrada 15/11/2026, sem saída gravada) |
| Parceiro | proprietario2@ → "Paulo Fotos — TESTE QA" (`paulo-fotos-teste-qa`) | **publicado**, fotografia, sem agenda (qualquer horário futuro vale) |
| Primeira entrada | teste-qa-2026@mail-teste.com.br (morador), proprietario-qa@mail-teste.com.br (proprietário), cadastro-teste-2310@ | sem intenção e sem papel ativo, ou seja, ainda não receberam as boas-vindas |

## E204 — orçamento de parceiro

**1. `parceiro_pedido_novo`** (vai para o parceiro: serviço, imóvel, data/janela, pedido; o botão abre o pedido)
- Quem age: **proprietario1**, em `/parceiros/paulo-fotos-teste-qa`.
- Passos:
  - "Solicitar orçamento" → Fotografia.
  - Imóvel: **[TESTE QA] Prova de publicação**.
  - Descrição com 10 caracteres ou mais.
  - 1 horário no futuro.
- Quem recebe: **proprietario2**.
- Teto: até 3 orçamentos manuais abertos por categoria do cliente. O proprietario1 não tem nenhum aberto com fotografia.

**2. `parceiro_orcamento_recebido`** (vai para o dono, com o VALOR)
- Quem age: **proprietario2**, em `/dashboard/servicos/pedidos/<id>`: "Enviar orçamento" com um valor (ex.: R$ 350).
- Quem recebe: **proprietario1**.

**3. `parceiro_orcamento_aceito`** (vai para o parceiro, com o valor e o líquido dele)
- Quem age: **proprietario1** aceita o orçamento no mesmo pedido.
- Quem recebe: **proprietario2**.
- Se seguir: confirmar o horário dispara `parceiro_horario_confirmado` para os dois.

## E205-B — boas-vindas, proposta, visitas

**4. `boas_vindas`** (uma vez por conta; chave `boas_vindas:<id>` em `automacoes_envios`)
- Quem age:
  - **teste-qa-2026@** (versão morador);
  - **proprietario-qa@** (versão proprietário).
- Passos: entrar pela porta de QA → a tela de intenção aparece no 1º acesso → escolher → enviar.
- Quem recebe: a própria conta.
- Só sai se `intencao` e `papel_ativo` estiverem vazios. Já confirmei isso para as duas.

**5. `proposta_aceita`** (dois e-mails: o dono recebe "Proposta aceita: {nome} quer morar…" com a taxa congelada; o morador recebe "Você garantiu o seu próximo lar" com a linha do tempo)
- Quem age:
  - **proprietario1** envia uma proposta pela candidatura aceita do **Lucas** (`61729f0b`): Interessados → "Enviar proposta".
  - **inquilino1** aceita em `/dashboard/propostas/<id>`.
- Quem recebe: os dois. Antes disso, sai também o `proposta_recebida` (E202, já provado).
- Seed do D-5: a proposta é de janeiro de 2027 e não toca no contrato `d5d50247`. **Não seguir para o Fechamento** desse lead (geraria um segundo contrato no Premium).

**6. `proposta_recusada`** ("{Primeiro nome} recusou a proposta", com o motivo; o dono recebe "Ajustar e enviar nova versão" e o morador "Ver outros imóveis parecidos")
- Quem age:
  - **proprietario1** envia uma proposta pela candidatura da **Ana** (`f2c00f6a`).
  - **inquilino2** recusa com um motivo.
- Quem recebe: os dois.

**7. `visita_cancelada`** (quem cancelou, motivo, horário; o morador recebe "Pedir outro horário")
- Quem age:
  - **inquilino1** pede visita (vídeo ou presencial) em `/imoveis/a0259000-0000-4000-8000-000000000001`.
  - **proprietario1** confirma em Visitas.
  - Um dos dois cancela.
- Quem recebe: os dois.
- Hoje já há 2 visitas abertas nos anúncios de teste. Use uma nova, para o horário ficar claro.

**8. `visita_vespera`** (cerca de 24 h antes; ou **na hora**, se a confirmação for com menos de 24 h)
- Quem age:
  - **inquilino1** pede visita com um horário **daqui a menos de 24 h**.
  - **proprietario1** confirma.
- Quem recebe: os dois, logo depois da confirmação. Uma vez por (visita, pessoa, horário).

**9. `visita_expirada`** (todos os horários passaram sem confirmação → o pedido fica "cancelado", motivo "expirou")
- Quem age:
  - **inquilino1** pede visita com horários **próximos** (ex.: +1 h e +2 h).
  - **Ninguém confirma.**
- Quando sai: depois do último horário, quando alguém abre a lista de Visitas ou quando roda o cron de automações (ligado).
- Quem recebe: os dois.

**10. `bloco_inicio_lembrete`** ("O bloco N da sua estadia começa em dd/mm"; só o morador)
- Condições do código:
  - bloco **2 ou mais**;
  - aceito pelas **duas partes**;
  - começa em até **3 dias**;
  - **sem pagamento** registrado.
- Massa que existe: o bloco 2 do `11281a61` (`ddf86c66`, Lucas) começa em **17/12/2026**. A janela vai de **14/12 a 17/12**.
- Nessa janela:
  - **proprietario1** propõe a renovação e **inquilino1** aceita e assina o aditivo;
  - ou, se o bloco já tiver os dois aceites, o cron dispara sozinho.
- **Antes de 14/12, não dá para provar ao vivo com a massa atual.** Veja "Lacunas".

## E206 — códigos padronizados ("vale por N minutos e só funciona uma vez" + linha antifraude)

**11. Código de assinatura** (`Seu código para assinar o contrato`), pelo aditivo, o mesmo caminho do item 10
- Quem age:
  - **proprietario1** propõe um aditivo no contrato `11281a61`, em `/dashboard/estadia/11281a61…/alteracao`.
  - **inquilino1** aceita.
  - Cada um pede "Assinar" e recebe o código "(aditivo N)".
- Quem recebe: quem pediu o código.
- Pode ser feito já. Se o aditivo for a renovação do bloco 2 dentro da janela de 14/12 a 17/12, prova também o item 10.

**12. Código de vínculo profissional**
- Quem age: qualquer conta de teste (ex.: inquilino1), em Conta → Vínculo profissional, informando um **e-mail corporativo da equipe** (`…@vivanomads.com.br`).
- Quem recebe:
  - a caixa de teste da conta (o registro é pelo usuário);
  - **o envio real também vai para o endereço digitado**, então use um endereço da equipe.
- Domínios gratuitos (gmail, hotmail…) são recusados de propósito.

**13. Código de 2FA ("refazer")** e **Reautenticação**
- Ao vivo: **não recomendado**.
- O "refazer" só existe para **admin**, com senha digitada há pouco. A única conta admin de teste é a **qa-muse-1** (observadora, sem escrita, com 2FA). E confirmar o código **apaga o fator**, o que mexe na regra do 2FA.
- A Reautenticação é o modelo do Supabase, já coberto pelo teste de guarda dos modelos de código.
- Proposta: fica no laboratório. Se o Muse quiser ver o e-mail ao vivo, basta **pedir** o código e **não confirmar**, desde que a observadora consiga chegar à tela.

## Lacunas (pedem decisão antes de virar massa)
- **Item 10 antes de 14/12:** precisaria de uma fixture nova, um contrato de teste cujo bloco 1 termine em até 3 dias, num anúncio de teste que não seja o Premium. Seria uma migração `0260` idempotente, com ids fixos e rollback, no molde da 0256/0259. Não fiz ainda: só se for pedido.
- **Item 13:** só com uma conta admin de teste que não seja a observadora, ou no laboratório.
