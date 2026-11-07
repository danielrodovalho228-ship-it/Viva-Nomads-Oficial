# E287 — envio às pioneiras: etapa de prova (NÃO enviado)

**Estado:** caminho de envio e arquivos de prova prontos no repo. **Nenhum e-mail foi enviado** (nem prova, nem real).

## O que está pronto
- `src/lib/notifications/pioneiras-e287.ts` (puro): assunto manual **exato** `Você foi uma das primeiras 💚 — novidades da Viva Nomads`, HTML no
  `layoutEmail` (logo `email-mark.png` no topo) e texto puro, para Maria de Fátima (proprietária) e Lya Raquel (inquilina).
- `src/lib/notifications/pioneiras-e287-envio.ts`: envia **só a cópia de prova**, e **só** para `proprietario1@vivanomads.com.br` (conta de teste),
  pela pilha oficial (`sendEmail` → Resend). `interno: true` evita o `comMarca` (que acrescentaria " · Viva Nomads"); `from` = "Viva Nomads Brasil
  <suporte@vivanomads.com.br>" e `replyTo` = suporte@vivanomads.com.br, passados explicitamente. **Não existe função de envio às destinatárias reais.**
- `docs/e287/prova-maria-de-fatima.{html,txt}` e `prova-lya-raquel.{html,txt}`: o HTML e o texto EXATOS gerados (um teste garante que não derivam do código).

## Diferenças entre a montagem e os arquivos aprovados (o texto aprovado prevalece)
- Parágrafos, saudação e assinatura: **idênticos** (o texto puro é idêntico byte a byte).
- HTML: idêntico ao aprovado, exceto que o arquivo aprovado traz o atributo `style` **duplicado** no parágrafo da assinatura (HTML inválido; o navegador
  usa só o primeiro). Na montagem sai um só `style`, com o mesmo efeito visual.

## Bloqueio exato para disparar as provas
Não há, para mim, caminho executável em produção para este envio:
1. O `RESEND_API_KEY` é variável do projeto na Vercel (fora do que posso ler ou tocar).
2. `/api/test-email` responde 404 em produção por desenho (`VERCEL_ENV=production`).
3. As rotas `/api/cron/*` exigem `CRON_SECRET`, que não tenho; e nenhuma delas envia um e-mail avulso.
4. Não existe ação de admin que envie um e-mail preparado a um destino escolhido.

Para destravar, o chat principal escolhe: (A) autorizar um PR meu com uma rota de admin (sessão com 2FA) de disparo único, que só aceita o destino de prova
até a liberação por escrito; ou (B) alguém com a chave roda o envio de prova (`enviarProvasPioneiras`) no ambiente de produção.
Depois da prova, a leitura de volta é feita na caixa de e-mails de teste (assunto, remetente, logo e saudação de cada uma).
