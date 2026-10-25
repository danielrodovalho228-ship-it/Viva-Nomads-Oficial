# Login com Apple ("Continuar com a Apple")

**Estado:** código pronto e **desligado**. A flag `LOGIN_APPLE_ATIVO` (`NEXT_PUBLIC_LOGIN_APPLE_ATIVO`, em
`src/lib/flags.ts`) nasce desligada e **não existe na Vercel**. Sem ela, nenhuma tela muda: `/auth` mostra só o que
mostra hoje. As chaves são do Daniel e chegam depois.

## Por que
O app do iPhone oferece o login com Google. Quando um app oferece login de terceiros, a App Store exige também
"Entrar com a Apple" (App Review 4.8). Sem ele, a loja rejeita o app.

## O que já está no código
- **Site (`/auth`):** o botão "Continuar com a Apple" fica preto, com a maçã branca (Human Interface Guidelines), e
  vem **antes** do Google. O componente é `src/components/auth/botao-apple.tsx`, e a lista de botões vem de
  `src/lib/auth/provedores-sociais.ts`. O clique chama `signInWithOAuth({ provider: "apple" })` com volta para
  `/auth/callback`. Com a flag desligada, o clique não faz nada, mesmo que alguém force o botão na tela.
- **App (iPhone e Android):** a mesma ponte do Google (ordem 1f65c73d). `POST /api/app/login-social` emite o
  `state` para `apple`, o site manda `postMessage({ tipo: "login-social", provedor: "apple", url, state })`, e
  `/auth/app-callback` devolve ao app por `vivanomads://auth/callback`. O lado nativo já trata o `provedor` de forma
  genérica.
- **Testes:** `src/lib/auth/provedores-sociais.test.ts` (flag ligada e desligada) e a E2E
  `tests/e2e/specs/t471-login-apple.spec.ts`.

## Ligar (Daniel, quando as chaves chegarem): nesta ordem
1. **Apple Developer** (developer.apple.com → Certificates, Identifiers & Profiles):
   - no App ID `br.com.vivanomads.app`, ligar a capacidade **Sign in with Apple**;
   - criar um **Services ID** (ex.: `br.com.vivanomads.web`), com Sign in with Apple ligado. Em
     *Domains*: `vivanomads.com.br` e o domínio do Supabase. Em *Return URLs*:
     `https://<projeto>.supabase.co/auth/v1/callback`;
   - criar uma **Key** com Sign in with Apple e baixar o `.p8` (só baixa uma vez). Anotar o **Key ID** e o
     **Team ID**.
2. **Supabase** (Authentication → Providers → Apple): ligar o provedor.
   - *Client IDs*: o Services ID **e** o bundle `br.com.vivanomads.app`, separados por vírgula.
   - *Secret Key*: o JWT gerado com o `.p8`, o Key ID e o Team ID.
   - **O JWT vence em no máximo 6 meses**: marcar na agenda a renovação.
   - Em Authentication → URL Configuration, as mesmas URLs do Google já servem (`/auth/callback` e
     `/auth/app-callback**`).
3. **E-mail para o "Ocultar meu e-mail"** (Apple → Services → *Sign in with Apple for Email Communication*):
   registrar o domínio e o remetente do `RESEND_FROM`, com o SPF. Sem isso, os e-mails da plataforma não chegam a
   quem escolheu esconder o e-mail (`@privaterelay.appleid.com`).
4. **Vercel:** criar `NEXT_PUBLIC_LOGIN_APPLE_ATIVO = on` **primeiro só em Preview**, fazer um deploy de Preview e
   rodar a T471 com `TESTES_LOGIN_APPLE=on` e `TESTES_BASE_URL` apontando para o Preview. Se passar e o login de
   verdade funcionar, criar a mesma variável em Production e fazer um novo deploy. A variável é lida no build
   (`NEXT_PUBLIC_*`): mudar sem novo deploy não liga nada.

## Cuidados
- A Apple só manda o **nome** no primeiro login, e o fluxo web nem sempre o entrega. Quem entra pela Apple pode
  chegar sem nome. A regra do cadastro completo (nome, e-mail confirmado, documento e foto) já pede o que falta na
  Conta.
- **Mesma pessoa, provedores diferentes:** se o e-mail da Apple for o mesmo de uma conta existente, o Supabase liga
  ao mesmo usuário. Com "Ocultar meu e-mail", nasce uma conta nova (o e-mail é outro).
- **Desligar:** apagar a variável na Vercel e fazer um novo deploy. Nada no banco muda; não há migração.
