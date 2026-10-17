# Como colar os e-mails de conta no Supabase

Estes arquivos são gerados do código (`npm run templates:supabase`). **Não edite o HTML à mão** —
mude `src/lib/notifications/templates-supabase.ts` e gere de novo.

## Passo a passo (Daniel, no painel do Supabase)

1. Abra o projeto no Supabase → **Authentication** → **Emails** → **Templates**.
2. Para cada modelo da tabela abaixo: clique no nome do modelo, troque o **Subject** pelo assunto indicado
   e cole o conteúdo do arquivo no campo **Message body** (modo código-fonte / HTML). Salve.
3. Em **Authentication → Providers → Email**, confirme: "Confirm email" ligado e o tamanho do código OTP em 6.
4. Teste: peça um código de acesso na tela de login e veja o e-mail no Gmail e no celular (claro e escuro).

| Modelo no Supabase | Assunto | Arquivo |
| --- | --- | --- |
| Confirm signup | Confirme seu e-mail · Viva Nomads | `confirmar-cadastro.html` |
| Reset password | Redefinir sua senha · Viva Nomads | `redefinir-senha.html` |
| Change email address | Confirme seu novo e-mail · Viva Nomads | `trocar-email.html` |
| Invite user | Você foi convidado · Viva Nomads | `convite.html` |
| Magic link | Seu código de acesso Viva Nomads | `codigo-de-acesso.html` |
| Reauthentication | Seu código de verificação Viva Nomads | `reautenticacao.html` |

## Observações

- O link de cada e-mail usa `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…` (rota `src/app/auth/confirm/route.ts`, igual a `docs/email-templates`); **nunca** `{{ .ConfirmationURL }}`, que quebra confirmar cadastro, redefinir senha, trocar e-mail e convite (correção #182); o código de acesso usa `{{ .Token }}` (6 dígitos).
- **`codigo-de-acesso.html` (modelo Magic link): cole SÓ depois que a tela "Entrar com código por e-mail" (ordem d250ea2f, item 4) estiver no ar em vivanomads.com.br** — ele troca o link por código; com a tela publicada, quem pedir código entra por ela. Os outros cinco podem ser colados a qualquer hora.
- Se o Supabase tiver "Secure email change" ligado, o aviso do endereço antigo usa o modelo de troca de e-mail.
- Nada aqui altera a configuração do Supabase sozinho: só vale depois que você colar e salvar.
