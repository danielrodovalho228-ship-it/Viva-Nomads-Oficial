# 🔐 PROMPT — ACESSO REAL (FASE 7 / PASSO 5) — VIVA NOMADS

> Aplicar no Claude Code **somente quando o reteste do Manus der 🟢 GO** e o
> Supabase de produção estiver provisionado. Este prompt desliga o modo
> demonstração e liga o acesso real: login de verdade, papéis (admin /
> proprietário / inquilino), permissões por papel e proteção de rotas no
> servidor. NÃO mexe em credenciais — chaves e segredos são do Daniel, no painel.

---

## 0. PRINCÍPIO QUE GUIA TUDO

A plataforma **conecta, verifica, documenta e registra** — não é locador, fiador,
garantidor nem executora. O acesso real reforça isso: cada pessoa vê e faz
apenas o que seu papel permite; nada de cravar valores de terceiros, prometer
resultado ou expor dado que não deveria. Status honesto, permissões honestas.

---

## 1. PRÉ-REQUISITOS (Daniel, fora do código)

Confirmar antes de aplicar — sem isso o app continua (corretamente) em modo demo:

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` na Vercel (produção).
- `SUPABASE_SERVICE_ROLE_KEY` **somente** em variável de servidor (nunca `NEXT_PUBLIC_*`).
- Migrações aplicadas no banco de produção (`supabase/migrations/*`), incluindo RLS.
- Provedor de e-mail/SMTP do Supabase configurado (confirmação de cadastro e
  recuperação de senha funcionando).
- Pelo menos 1 usuário com `role = admin` criado (via painel Supabase) para o
  primeiro acesso administrativo.

> ⚠️ Credenciais = mãos do Daniel. O Claude Code só escreve código que **lê** essas
> variáveis; nunca as imprime, commita ou loga.

---

## 2. DESLIGAR O MODO DEMONSTRAÇÃO

Hoje, sem Supabase, o app cai num usuário fictício (`DEMO_USER`) e as server
actions retornam `{ ok: true, demo: true }`. Em produção real isso precisa sair
do caminho — sem quebrar o ambiente de desenvolvimento.

1. **Gate único de demo.** Criar um helper `isDemoMode()` (ex.: em `src/lib/env.ts`)
   que retorna `true` apenas quando o Supabase NÃO está configurado
   (`!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY`). Usar esse
   helper como fonte única; não espalhar checagens soltas.

2. **Fallbacks de identidade.** Onde hoje se usa `user ?? DEMO_USER`
   (`dashboard-shell.tsx`, `dashboard/page.tsx`, `dashboard/conta/page.tsx`):
   - Com Supabase ligado, **não** usar `DEMO_USER`. Como o `AuthGuard` já bloqueia
     a renderização sem `user`, dentro do dashboard o `user` sempre existe — então
     trocar `?? DEMO_USER` por uso direto do `user` (e, no máximo, manter o
     `DEMO_USER` atrás de `isDemoMode()` para o ambiente sem backend).

3. **Server actions** (`src/lib/data/actions.ts`): manter o retorno `demo:true`
   apenas quando `createClient()` for nulo (já é o caso). Em produção o cliente
   nunca é nulo, então os dados são persistidos de verdade — nada a relaxar aqui,
   só confirmar que nenhuma action "finge" sucesso quando o Supabase existe.

4. **Não remover** `DEMO_USER`/placeholders do mapa: eles continuam válidos para
   desenvolvimento local e para o fallback elegante do mapa sem token.

---

## 3. LOGIN REAL (cadastro, entrada, recuperação)

A página `src/app/auth/page.tsx` já faz `signUp`/`signInWithPassword` com
`full_name` e `role` em `user_metadata`. Completar para produção:

1. **Escolha de papel no cadastro.** Garantir que o cadastro pergunte/registre o
   papel inicial (`owner` ou `tenant`) em `user_metadata.role`. Admin nunca é
   auto-atribuído — só via painel.
2. **Perfil persistido.** Ao primeiro login, garantir uma linha em `profiles`
   (id = `auth.uid()`, `full_name`, `email`, `phone`, `role`). Preferir um
   **trigger no banco** (`on auth.users insert`) a lógica no cliente.
3. **Confirmação de e-mail.** Respeitar o fluxo do Supabase (tela "verifique seu
   e-mail"); não logar antes de confirmar se a confirmação estiver exigida.
4. **Recuperação de senha.** Ligar `resetPasswordForEmail` + rota de definição de
   nova senha (a tela de alterar senha em `conta` já cobre o caso logado).
5. **Sair.** `signOut` deve encerrar a sessão do Supabase **e** limpar o store
   (`useAuthStore.signOut`) — confirmar que ambos acontecem.

---

## 4. PAPÉIS E PERMISSÕES (fonte da verdade no SERVIDOR)

Regra de ouro: **`role` (de cadastro) governa permissão; `activeMode` é só UX.**
A troca de modo inquilino⇄proprietário (já entregue) muda o "mundo" visível,
mas nunca concede poder que a conta não tem.

1. **Papéis:** `admin`, `owner`, `tenant`. Derivar de `profiles.role`
   (ou `user_metadata.role`). `admin` enxerga o painel do proprietário + `/admin`.

2. **`/admin` exige `role = admin`.** Hoje o middleware só checa "logado", e
   `admin/page.tsx` não checa papel — **lacuna a fechar**:
   - No middleware (`src/middleware.ts`), para `/admin/*`, além de `user`,
     buscar o papel (via `profiles`) e redirecionar não-admin para `/dashboard`.
   - Reforçar no servidor: tornar a página/admin um Server Component (ou um
     layout server) que valida `role === "admin"` e faz `redirect("/dashboard")`
     caso contrário. Defesa em profundidade, não confiar só no cliente.

3. **RLS (Row Level Security) no Supabase** — a barreira real:
   - `properties`: dono só lê/edita as próprias (`owner_id = auth.uid()`);
     leitura pública apenas de imóveis `status = 'active'`.
   - `favorites`: `tenant_id = auth.uid()`.
   - `leads`: visíveis ao `owner_id` (e ao `tenant_id` que o criou).
   - `messages`: apenas `sender_id`/`receiver_id`.
   - `qualification_checklists`: dono lê os seus; **admin** pode revisar
     (`reviewChecklist`) — política específica para `role = admin`.
   - `payment_accounts`: nunca expor `asaas_subaccount_apikey` ao cliente;
     manter criptografado e restrito ao backend.
   - Conferir que **toda** tabela sensível tem RLS habilitada (negar por padrão).

4. **Guarda de rota por papel no cliente** (`dashboard-shell.tsx` já tem
   `OWNER_ONLY`/`TENANT_ONLY`): manter como UX/atalho, mas a RLS é quem de fato
   impede o acesso a dados do outro papel.

---

## 5. PROTEÇÃO DE ROTAS (resumo do que precisa valer)

- `middleware.ts` (servidor): `/dashboard/*`, `/qualificar`, `/admin/*` exigem
  sessão; `/admin/*` exige **papel admin**.
- `AuthGuard` (cliente): defesa em profundidade — redireciona sem `user`.
- Rotas exclusivas de papel: acessá-las por URL no modo/role errado redireciona
  para a Visão geral (cliente) e é negada nos dados (RLS).
- Páginas públicas (`/home`, `/buscar`, `/imoveis/[id]`, `/precos`, etc.)
  permanecem abertas; o detalhe do imóvel mostra a **área aproximada** até o
  aceite (já entregue).

---

## 6. TESTES (não dar GO sem isto)

Automatizar (Playwright) + checagem manual com 3 contas reais
(admin / proprietário / inquilino):

1. **Login/cadastro/recuperação** funcionam com Supabase real (não demo).
2. **Proteção de rota:** deslogado em `/dashboard`, `/qualificar`, `/admin` →
   redireciona para `/auth`.
3. **Admin:** proprietário/inquilino logado tentando `/admin` por URL → barrado
   (redirect), e a action de revisão negada pela RLS.
4. **Isolamento de dados (RLS):** proprietário A não lê imóveis/leads de B;
   inquilino não lê leads alheios; mensagens só entre as partes.
5. **Papel × modo:** conta só-inquilino não acessa telas de proprietário nem por
   URL; conta com os dois papéis troca de modo (avatar/animação já validados).
6. **Persistência de sessão:** reload mantém logado; `Sair` encerra de verdade.
7. **Cadastro de imóvel real:** publica, geocodifica (lat/lng gravados) e aparece
   no mapa/busca; endereço sem coordenada cai no fallback sem quebrar.
8. **Sem regressão:** rodar o build/lint e o smoke das páginas públicas.

---

## 7. O QUE NÃO ENTRA (limites)

- Não cravar valores de garantia/seguro de terceiros; status "via parceiro" até a
  parceria existir.
- Não exibir logo de parceiro sem autorização; sem jargão de fornecedor.
- Não expor segredos no cliente; não logar tokens; não commitar `.env`.
- Não transformar a plataforma em locadora/fiadora — o acesso real apenas
  organiza quem conecta/verifica/documenta/registra.

---

## 8. CRITÉRIO DE ACEITE (🟢 GO do acesso real)

- [ ] Modo demo desligado quando o Supabase está configurado.
- [ ] Login/cadastro/recuperação reais funcionando, com perfil + papel gravados.
- [ ] `/admin` acessível só por admin (servidor + cliente).
- [ ] RLS negando por padrão e liberando só o dono/papel correto em todas as
      tabelas sensíveis.
- [ ] Rotas privadas protegidas no middleware e no AuthGuard.
- [ ] Todos os testes da seção 6 verdes, sem regressão no build/lint.

---

> Ordem sugerida de execução: **2 → 3 → 4 (RLS primeiro) → 5 → 6**. Commit por
> bloco, PR único "Acesso real (Fase 7)", merge só com os testes da seção 6
> verdes.
