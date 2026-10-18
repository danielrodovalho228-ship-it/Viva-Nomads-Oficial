# Verificação de telefone por SMS — passo a passo do Daniel

O site já está pronto. Até o provedor de SMS ser configurado, a tela **Conta → Confiança** mostra
"Verificação de telefone em breve" (desativado, sem erro), e ninguém fica travado.

## Como funciona

- O código de 6 dígitos é o **nativo do Supabase Auth**: o site chama `updateUser({ phone })` para enviar e
  `verifyOtp({ phone, token, type: "phone_change" })` para confirmar. Não há código caseiro.
- O número fica **só no Supabase Auth** (`auth.users.phone`). Ele não vai para nenhuma tabela da Viva, log ou URL, e
  não aparece no perfil público nem no cartão. Aparece só o selo **"Telefone verificado"**.
- A migração **0150** guarda apenas o *estado* da verificação, sem o número. Quando a pessoa pede código para
  outro número, o selo some até ela confirmar de novo.
- Limites: **3 envios por hora e 5 por dia**, por usuário e por IP. Também há limite de tentativas de código.
- Número já confirmado em outra conta: recusa neutra ("Não foi possível usar este número…").
- O site descobre sozinho se o provedor está pronto, lendo `GET /auth/v1/settings` do Supabase. Não precisa
  de variável nova no Vercel.

## O que só o Daniel faz (no painel do Supabase, projeto de produção)

1. **Escolher e contratar o provedor.** O Supabase aceita Twilio (Messaging ou Verify), MessageBird, Vonage
   e Textlocal.
   - Recomendação: **Twilio Verify**. Ele cuida da entrega no Brasil e da troca de remetente, e cobra por
     verificação concluída.
2. **Criar a conta no provedor** e anotar as credenciais:
   - Twilio: `Account SID`, `Auth Token` e o `Verify Service SID` (se for Verify) ou o `Messaging Service SID`.
   - Guarde as chaves só no painel do Supabase, nunca em chat, e-mail ou código.
3. **Supabase → Authentication → Sign In / Providers → Phone**:
   - ligar **Enable Phone provider**;
   - escolher o **SMS provider** e colar as credenciais;
   - **ligar "Enable phone confirmations"**. Isso é obrigatório: com a confirmação desligada, o Supabase
     confirmaria o número sem código. Nesse caso o site entende que o SMS **não** está pronto e continua
     mostrando "em breve";
   - deixar **"Allow new users to sign up" do telefone desligado** (o cadastro continua por e-mail);
   - em **SMS Message** (modelo), usar algo como `Viva Nomads: seu código é {{ .Code }}. Não compartilhe.`
4. **Supabase → Authentication → Rate Limits**: conferir o limite de SMS por hora (o site já limita por pessoa e por IP).
   Se possível, ligar **CAPTCHA**, que o Supabase recomenda para conter custo.
5. **Testar com o próprio celular** em Conta → Confiança: enviar, receber, confirmar e ver o selo em
   `/proprietario/<seu id>`.
6. Avisar o coordenador. A Muse roda o teste no site.

Os nomes dos menus podem mudar no painel do Supabase. Se algum não bater, a referência é a documentação
"Phone Login" do Supabase.

## Custo por SMS (a levantar, valores de referência de out/2026)

| Item | Referência | Observação |
|---|---|---|
| Twilio Verify, taxa por verificação concluída | **US$ 0,05** | Não cobra a taxa quando a verificação falha |
| Twilio, SMS para o Brasil | **≈ US$ 0,06 por mensagem** (fonte de terceiros) | Cobrado também em reenvio e falha de entrega |
| **Total estimado por verificação** | **≈ US$ 0,11** (≈ R$ 0,60) | Estimativa: somar as duas linhas acima |

- Exemplo: 1.000 verificações por mês dão ≈ US$ 110. Os limites de 3 por hora e 5 por dia seguram abuso.
- **A levantar pelo Daniel antes de ligar:** o preço atual para o Brasil na página de preços do provedor escolhido
  (Twilio: "Verify pricing" e "SMS pricing – Brazil"), mais o IOF e o câmbio do cartão.

## Laboratório (testes automáticos)

Com `INTEGRACOES_SIMULADAS=on` (só fora de produção), nada sai para a rede e o código é sempre **123456**.
O spec `t178-telefone-sms` cobre:

- verificar o celular;
- código errado;
- selo no cartão;
- número em outra conta;
- troca de número;
- coluna no admin.
