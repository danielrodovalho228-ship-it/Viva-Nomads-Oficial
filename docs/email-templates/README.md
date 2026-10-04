# Templates de e-mail — Viva Nomads

Templates HTML prontos, com a marca (símbolo "N" + "VivaNomads"). O logo é a
imagem hospedada em `https://vivanomads.com.br/email-mark.png` (vai ao ar com o
deploy) **mais** o texto "VivaNomads" colorido — então a marca aparece mesmo se
o cliente de e-mail bloquear imagens.

## E-mails de autenticação (Supabase)

Em **Supabase → Authentication → Emails → Templates**, cole o HTML de cada
arquivo no template correspondente. Os links usam `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`
— a validação é feita pelo NOSSO servidor (/auth/confirm), então o link funciona
em qualquer navegador/aparelho (inclusive pedido no app e aberto no e-mail do
computador) e não depende da lista de "Redirect URLs" do Supabase.

> **Redefinir senha (02):** até 04/10/2026 usava `{{ .ConfirmationURL }}`. Com ele,
> o link caía na home quando `/auth/reset` não estava em Redirect URLs, e a tela
> de nova senha nunca abria. Cole a versão nova no template **Reset password**.

| Arquivo | Template no Supabase |
|---|---|
| `01-confirmar-cadastro.html` | **Confirm signup** |
| `02-redefinir-senha.html` | **Reset password** |
| `03-link-de-acesso.html` | **Magic Link** |
| `04-convite.html` | **Invite user** |
| `05-trocar-email.html` | **Change Email Address** |
| `07-reautenticacao.html` | **Reauthentication** (mostra o código `{{ .Token }}`) |

Dica: ajuste o **Subject (assunto)** de cada um, por exemplo:
- Confirm signup → "Confirme seu e-mail · Viva Nomads"
- Reset password → "Redefinir sua senha · Viva Nomads"
- Magic Link → "Seu link de acesso · Viva Nomads"
- Invite → "Você foi convidado · Viva Nomads"
- Change Email → "Confirme seu novo e-mail · Viva Nomads"

## E-mails transacionais do app (Resend)

`06-transacional-base.html` é o modelo para os e-mails que o app envia pelo
código (`src/lib/notifications/email.ts`). Troque os marcadores:
`{{TITULO}}`, `{{CORPO}}`, `{{BOTAO_TEXTO}}`, `{{BOTAO_URL}}`,
`{{RODAPE_OPCIONAL}}`.

## Importante
- O logo só aparece depois que o deploy publicar `public/email-mark.png` (já
  incluído neste commit). Antes disso, a imagem fica quebrada, mas o texto
  "VivaNomads" continua aparecendo.
- Para o **envio** funcionar de verdade, configure o SMTP (Resend) em
  Authentication → SMTP — o template é só a aparência; quem entrega é o SMTP.
- Cores da marca: Viva `#1E63D0` · Nomads `#6CBE2A` · primária `#143C8C`.
