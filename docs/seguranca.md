# Segurança do banco — o que é público de propósito

Revisão de 07/10/2026 (Moacir + pacote do Otávio). Vale para o schema `public` do Supabase.

## Papéis

- **anon** — a chave pública do site (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Qualquer pessoa tem.
- **authenticated** — quem fez login. O RLS decide o que cada um vê pelo `auth.uid()`.
- **service_role** — só o servidor (rotas e server actions). Nunca vai para o navegador.

## O que anon pode

| O quê | Por quê |
|---|---|
| Ler imóveis ativos, fotos, amenidades e avaliações | Vitrine pública. Políticas próprias ("imóveis ativos são públicos", "fotos públicas"…), sem `is_admin()`. |
| `conferir_documento(código)` | Página pública `/conferir/<código>`. Devolve só número, tipo, datas, valor, iniciais das partes e se foi anulado. Código de 128 bits; a rota limita 20 consultas por IP por hora. **Intencional.** |
| Nada de escrita | 0083 tirou INSERT/UPDATE/DELETE de anon em todas as tabelas, e tabela nova não nasce mais com escrita para anon. |

## O que é público só para quem está logado

| O quê | Por quê |
|---|---|
| `pedidos_publicos_lista()` / view `pedidos_publicos` | Mural de pedidos de moradia para proprietários. Só colunas sem dado pessoal (cidade, datas, orçamento, perfil). **Intencional**; a 0083 tirou o anon. |

## Funções internas (não executam como anon) — 0084

`is_admin`, `pode_ver_contrato`, `pedido_ativo`, `pedido_inquilino`.

Regra para políticas novas: **política que chama uma dessas funções vai com `to authenticated`**.
Se for para todos os papéis (`to public`, o padrão), o Postgres avalia a política também para
anon e a leitura pública inteira da tabela quebra com `permission denied for function is_admin`.
O T23 pega isso.

## Documentos fiscais — 0083

Não se apagam, nem com service_role (gatilhos BEFORE DELETE/TRUNCATE). Para invalidar um
documento: `anulado_em` + `anulado_motivo` (uma vez, sem volta). A `/conferir` mostra "ANULADO".

## Login — CAPTCHA (Cloudflare Turnstile)

Cadastro, login e "esqueci a senha" mandam o token do Turnstile para o Supabase Auth.
Liga com duas chaves (ver `docs/INTEGRACOES.md` → Turnstile); sem a chave pública o widget não
aparece (laboratório e desenvolvimento seguem funcionando).
