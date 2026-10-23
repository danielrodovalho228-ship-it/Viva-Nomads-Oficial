/*
  E-mails de CONTA (hoje saem do Supabase Auth) no modelo único do Viva Nomads —
  ordem d250ea2f, item 3. PURO. Os arquivos de supabase/templates/ são gerados
  daqui (npm run templates:supabase) e o teste confere que não ficaram para trás.
  O Daniel COLA no painel do Supabase (Authentication → Emails); o código
  não altera configuração do Supabase. Variáveis {{ … }} são do Supabase.
*/
import { blocoDados, botaoEmail, layoutEmail } from "./modelo-email.ts";
import { REMETENTE_EMAIL, REMETENTE_NOME } from "./remetente.ts";

const SITE = "https://vivanomads.com.br";
const IMG = (k: string) => `${SITE}/media/email/${k}.jpg`;

export interface TemplateSupabase {
  arquivo: string;
  /** Nome do modelo no painel do Supabase. */
  modelo: string;
  assunto: string;
  html: string;
}

const titulo = (t: string) => `<h1 class="vn-t" style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#123b26;">${t}</h1>`;
const texto = (t: string) => `<p class="vn-p" style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#374151;">${t}</p>`;
const nota = (t: string) => `<p class="vn-mut" style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${t}</p>`;
/** Link por token_hash (correção #182): {{ .ConfirmationURL }} quebra confirmar/redefinir/trocar/convite. */
const urlConfirma = (tipo: string, next: string) => `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${tipo}&next=${next}`;
/** Sem URL crua (ela traz o token_hash): o link existe só no botão (rota rápida dos e-mails, item 4). */
const semBotao = `<p class="vn-mut" style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">O botão não abre? Peça um novo link na tela de entrada.</p>`;

function comBotao(arq: string, modelo: string, url: string, assunto: string, img: string, alt: string, t: string, intro: string, rotulo: string, aviso: string, extra = ""): TemplateSupabase {
  return {
    arquivo: arq,
    modelo,
    assunto,
    html: layoutEmail(`${titulo(t)}${texto(intro)}${extra}${botaoEmail(url, rotulo)}${semBotao}${nota(aviso)}`, {
      siteUrl: SITE,
      image: { src: IMG(img), alt },
      preheader: intro,
    }),
  };
}

/** Código de 6 dígitos grande e espaçado; sem botão (o Gmail oferece "Copiar código") e sem link de login no topo (Prompt 49). */
function comCodigo(arq: string, modelo: string, assunto: string, img: string, alt: string, t: string, intro: string, aviso: string): TemplateSupabase {
  const codigo = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center" class="vn-box" style="padding:20px;background:#f2fbe9;border:1px dashed #8FD63A;border-radius:12px;">
    <span class="vn-t" style="font-size:38px;font-weight:800;letter-spacing:10px;color:#123b26;font-family:'Courier New',Courier,monospace;">{{ .Token }}</span>
  </td></tr></table>`;
  return {
    arquivo: arq,
    modelo,
    assunto,
    html: layoutEmail(`${titulo(t)}${texto(intro)}${codigo}${nota(aviso)}`, {
      siteUrl: SITE,
      image: { src: IMG(img), alt },
      preheader: `Seu código: {{ .Token }}`,
      semLinkEntrar: true,
    }),
  };
}

export function templatesSupabase(): TemplateSupabase[] {
  return [
    // Prompt 49: a conta nova nasce no 1º código (shouldCreateUser) e o Supabase manda este modelo nesse 1º envio.
    // Mesmo assunto e mesmo código em destaque do "Magic link": para a pessoa, é sempre "o código de acesso".
    comCodigo("confirmar-cadastro.html", "Confirm signup", "Seu código de acesso · Viva Nomads", "confirmar-cadastro", "Boas-vindas ao Viva Nomads", "Seu código de acesso",
      "Use o código abaixo para entrar no Viva Nomads. Ele vale por 10 minutos e só funciona uma vez.",
      "Se não foi você, ignore este e-mail: nenhuma conta será ativada. Nunca passe este código a ninguém — a Viva Nomads não pede código por WhatsApp ou SMS."),
    comBotao("redefinir-senha.html", "Reset password", urlConfirma("recovery", "/auth/reset"), "Redefinir sua senha · Viva Nomads", "redefinir-senha", "Sua conta segura no Viva Nomads", "Redefinir sua senha",
      "Recebemos um pedido para criar uma nova senha na sua conta. Toque no botão para escolher a nova senha.", "Criar nova senha",
      "O link vale por 10 minutos. Se não foi você, ignore este e-mail: sua senha continua a mesma."),
    comBotao("trocar-email.html", "Change email address", urlConfirma("email_change", "/dashboard"), "Confirme seu novo e-mail · Viva Nomads", "trocar-email", "Atualização da sua conta", "Confirme seu novo e-mail",
      "Para concluir a troca do e-mail da sua conta, confirme o novo endereço.", "Confirmar novo e-mail",
      "O link vale por 10 minutos. Se não foi você, ignore este e-mail: o endereço atual continua valendo.",
      blocoDados([{ rotulo: "Novo e-mail", valor: "{{ .NewEmail }}" }])),
    comBotao("convite.html", "Invite user", urlConfirma("invite", "/dashboard"), "Você foi convidado · Viva Nomads", "convite", "Bem-vindo ao Viva Nomads", "Você foi convidado para o Viva Nomads",
      "Você recebeu um convite para entrar no Viva Nomads. Toque no botão para criar sua conta.", "Aceitar convite",
      "Se você não esperava este convite, ignore este e-mail."),
    comCodigo("codigo-de-acesso.html", "Magic link", "Seu código de acesso · Viva Nomads", "link-de-acesso", "Entrada no Viva Nomads", "Seu código de acesso",
      "Use o código abaixo para entrar no Viva Nomads. Ele vale por 10 minutos e só funciona uma vez.",
      "Se não foi você, ignore este e-mail. Nunca passe este código a ninguém — a Viva Nomads não pede código por WhatsApp ou SMS."),
    comCodigo("reautenticacao.html", "Reauthentication", "Seu código de verificação · Viva Nomads", "reautenticacao", "Verificação de segurança", "Confirme sua identidade",
      "Para concluir uma ação sensível na sua conta, use o código de verificação abaixo. Ele vale por 10 minutos.",
      "Se não foi você, ignore este e-mail e considere trocar sua senha. Nunca compartilhe este código."),
  ];
}

export const INSTRUCOES_SUPABASE = `# Como colar os e-mails de conta no Supabase

Estes arquivos são gerados do código (\`npm run templates:supabase\`). **Não edite o HTML à mão** —
mude \`src/lib/notifications/templates-supabase.ts\` e gere de novo.

## Caminho automático (recomendado)

No GitHub, aba **Actions** → **"Aplicar e-mails de conta no Supabase"** → **Run workflow**. Ela envia o assunto e o
corpo dos 6 modelos, o remetente (**${REMETENTE_NOME}** · ${REMETENTE_EMAIL}) e a validade do código (10 minutos) pela API de gestão do
Supabase e lê de volta para conferir. Precisa do segredo **\`SUPABASE_ACCESS_TOKEN\`** no repositório (criado pelo
Daniel em Settings → Secrets and variables → Actions; o token vem de supabase.com → Account → Access Tokens).
Sem o segredo, a Action para com "Cole os 6 modelos pelo LEIA-ME" — aí vale o passo a passo abaixo.

## Passo a passo manual (Daniel, no painel do Supabase)

1. Abra o projeto no Supabase → **Authentication** → **Emails** → **Templates**.
2. Para cada modelo da tabela abaixo: clique no nome do modelo, troque o **Subject** pelo assunto indicado
   e cole o conteúdo do arquivo no campo **Message body** (modo código-fonte / HTML). Salve.
3. Em **Authentication → Emails → SMTP Settings**: Sender name **${REMETENTE_NOME}**, Sender email **${REMETENTE_EMAIL}** (o mesmo remetente dos outros e-mails).
4. Em **Authentication → Providers → Email**, confirme: "Confirm email" ligado, o tamanho do código OTP em 6 e
   **Email OTP Expiration = 600** segundos (o código vale 10 minutos; os links dos outros e-mails também).
5. Teste: peça um código de acesso na tela de login e veja o e-mail no Gmail e no celular (claro e escuro).

| Modelo no Supabase | Assunto | Arquivo |
| --- | --- | --- |
{{TABELA}}

## Observações

- O link de cada e-mail usa \`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…\` (rota \`src/app/auth/confirm/route.ts\`); **nunca** \`{{ .ConfirmationURL }}\`, que quebra confirmar cadastro, redefinir senha, trocar e-mail e convite (correção #182); o código de acesso usa \`{{ .Token }}\` (6 dígitos).
- **\`codigo-de-acesso.html\` (Magic link) e \`confirmar-cadastro.html\` (Confirm signup): rode a Action (ou cole) SÓ depois que a entrada única por código (Prompt 49) estiver no ar em vivanomads.com.br** — a conta nova nasce no 1º código e o Supabase manda o "Confirm signup" nesse envio, agora com o código em destaque e sem link. Os outros quatro podem ser colados a qualquer hora.
- Se o Supabase tiver "Secure email change" ligado, o aviso do endereço antigo usa o modelo de troca de e-mail.
- Nada aqui altera a configuração do Supabase sozinho: só vale depois que você colar e salvar.
`;

export function instrucoesSupabase(): string {
  const tabela = templatesSupabase().map((t) => `| ${t.modelo} | ${t.assunto} | \`${t.arquivo}\` |`).join("\n");
  return INSTRUCOES_SUPABASE.replace("{{TABELA}}", tabela);
}
