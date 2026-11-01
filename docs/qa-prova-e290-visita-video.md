# Prova ao vivo — E290: visita por vídeo e o "Entrar na chamada" (Pista B, 31/10)

A prova é do QA do Muse. Este roteiro só deixa o caminho pronto. Não usa massa nova nem migração: a visita nasce
pela tela, com contas de teste já existentes. **Não usar o anúncio 330ebf37 ("[TESTE QA NÍVEL] Premium"), que tem o
contrato-semente VN-CT-D5D50247.**

## Contas e anúncio
- Morador: `inquilino1@vivanomads.com.br` (is_teste). Em 31/10 não tinha visita por vídeo em aberto.
- Proprietário: `proprietario1@vivanomads.com.br` (is_teste, sem 2FA).
- Anúncio: **[TESTE QA] Prova de publicação**, `/imoveis/a0259000-0000-4000-8000-000000000001` (ativo, Uberlândia).
  As visitas anteriores do inquilino1 nele são presenciais e estão canceladas, então não travam o pedido por vídeo,
  que permite um pedido aberto por morador, imóvel e tipo.
- Entrada: `/qa/entrar` com a chave da QA. Em 31/10, às 07:47 e 07:52 UTC, a porta recusou por `chave` (diagnóstico
  já entregue). Conferir a chave antes.
- Link da chamada: uma sala **real** do Google Meet criada pelo QA (`https://meet.google.com/xxx-xxxx-xxx`). A
  plataforma só aceita https de Meet, Zoom, Teams ou chamada do WhatsApp e recusa wa.me. Ela não confere se a sala
  existe.

## Janela certa
- O morador propõe de 1 a 3 horários nos **próximos 7 dias**. O proprietário confirma um horário futuro nos
  **próximos 14 dias**.
- "Entrar na chamada" aparece nos **dois lados** (`/dashboard/visitas` e o detalhe `/dashboard/visitas/<id>`) só com
  a visita **confirmada**, desde a confirmação **até 3 h depois do horário** (`visitaJaPassou`, folga de 3 h). Depois
  disso a etiqueta vira "Horário passou" e o botão some.
- E-mail de véspera (cron das 10:00 de Brasília, ou na hora se a confirmação for com menos de 24 h): botão "Entrar
  na chamada" com o link, nos dois lados. O e-mail de confirmação **não** leva o link.
- Sugestão de horário: escolher um horário **algumas horas à frente, no mesmo dia** (menos de 24 h). Assim a
  véspera sai na hora da confirmação e tudo é conferido numa sessão só.

## Passos
1. **Morador** (inquilino1): abrir o anúncio → **"Visita por vídeo"** → escolher o horário H (futuro, até 7 dias) →
   enviar. Esperado: "Visita por vídeo pedida". Em `/dashboard/visitas`, o status é "Pedida".
2. **Proprietário** (proprietario1): `/dashboard/visitas` → no pedido, **Confirmar** o horário H e colar o link do
   Meet. Esperado: status "Confirmada" e **"Entrar na chamada"** no cartão e no detalhe.
3. **Morador**: `/dashboard/visitas` → o cartão mostra "Confirmada", H em horário de Brasília e **"Entrar na
   chamada"**. Tocar no botão: abre a sala do Meet. Repetir no detalhe da visita.
4. **Proprietário**: tocar em "Entrar na chamada": a mesma sala.
5. Caixa de QA (`/dashboard/qa/emails`): "visita_confirmada" (sem link) e, se H for em menos de 24 h, a véspera
   "visita_vespera" para os dois, com o botão "Entrar na chamada".
6. **Fim da visita (E290)**: o proprietário marca **"Marcar como feita"**, ou um dos dois cancela. Esperado: o
   botão some, e em produção o `link_chamada` da linha fica **nulo** (conferência pela Pista B, somente leitura:
   `select status, link_chamada is null from visitas_video where id = '<id>'`).
7. Se não marcar como feita: passadas 3 h de H, o cartão mostra "Horário passou" e o botão some. O link continua
   gravado até alguém marcar como feita ou cancelar (ver o ponto em aberto no relatório).
