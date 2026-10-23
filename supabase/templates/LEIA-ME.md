# Como colar os e-mails de conta no Supabase

Estes arquivos são gerados do código (`npm run templates:supabase`). **Não edite o HTML à mão** —
mude `src/lib/notifications/templates-supabase.ts` e gere de novo.

## Caminho automático (recomendado)

No GitHub, aba **Actions** → **"Aplicar e-mails de conta no Supabase"** → **Run workflow**. Ela envia o assunto e o
corpo dos 6 modelos, o remetente (**Viva Nomads Brasil** · suporte@vivanomads.com.br) e a validade do código (10 minutos) pela API de gestão do
Supabase e lê de volta para conferir. Precisa do segredo **`SUPABASE_ACCESS_TOKEN`** no repositório (criado pelo
Daniel em Settings → Secrets and variables → Actions; o token vem de supabase.com → Account → Access Tokens).
Sem o segredo, a Action para com "Cole os 6 modelos pelo LEIA-ME" — aí vale o passo a passo abaixo.

## Passo a passo manual (Daniel, no painel do Supabase)

1. Abra o projeto no Supabase → **Authentication** → **Emails** → **Templates**.
2. Para cada modelo da tabela abaixo: clique no nome do modelo, troque o **Subject** pelo assunto indicado
   e cole o conteúdo do arquivo no campo **Message body** (modo código-fonte / HTML). Salve.
3. Em **Authentication → Emails → SMTP Settings**: Sender name **Viva Nomads Brasil**, Sender email **suporte@vivanomads.com.br** (o mesmo remetente dos outros e-mails).
4. Em **Authentication → Providers → Email**, confirme: "Confirm email" ligado, o tamanho do código OTP em 6 e
   **Email OTP Expiration = 600** segundos (o código vale 10 minutos; os links dos outros e-mails também).
5. Teste: peça um código de acesso na tela de login e veja o e-mail no Gmail e no celular (claro e escuro).

| Modelo no Supabase | Assunto | Arquivo |
| --- | --- | --- |
| Confirm signup | Seu código de acesso · Viva Nomads | `confirmar-cadastro.html` |
| Reset password | Redefinir sua senha · Viva Nomads | `redefinir-senha.html` |
| Change email address | Confirme seu novo e-mail · Viva Nomads | `trocar-email.html` |
| Invite user | Você foi convidado · Viva Nomads | `convite.html` |
| Magic link | Seu código de acesso · Viva Nomads | `codigo-de-acesso.html` |
| Reauthentication | Seu código de verificação · Viva Nomads | `reautenticacao.html` |

## Observações

- O link de cada e-mail usa `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…` (rota `src/app/auth/confirm/route.ts`); **nunca** `{{ .ConfirmationURL }}`, que quebra confirmar cadastro, redefinir senha, trocar e-mail e convite (correção #182); o código de acesso usa `{{ .Token }}` (6 dígitos).
- **`codigo-de-acesso.html` (Magic link) e `confirmar-cadastro.html` (Confirm signup): rode a Action (ou cole) SÓ depois que a entrada única por código (Prompt 49) estiver no ar em vivanomads.com.br** — a conta nova nasce no 1º código e o Supabase manda o "Confirm signup" nesse envio, agora com o código em destaque e sem link. Os outros quatro podem ser colados a qualquer hora.
- Se o Supabase tiver "Secure email change" ligado, o aviso do endereço antigo usa o modelo de troca de e-mail.
- Nada aqui altera a configuração do Supabase sozinho: só vale depois que você colar e salvar.
