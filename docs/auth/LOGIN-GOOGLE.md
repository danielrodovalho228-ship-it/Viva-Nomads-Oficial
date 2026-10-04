# Ativar o login com Google (quando for lançar)

Hoje o botão "Continuar com Google" fica **escondido** (flag
`NEXT_PUBLIC_LOGIN_GOOGLE_ATIVO`, desligada). O provedor Google não está ativado
no Supabase — com o botão visível, quem clicava caía num erro técnico
("Unsupported provider: provider is not enabled"). Siga estes passos para ligar.
Leva uns 30 minutos.

## 1. Google Cloud — tela de consentimento OAuth
1. https://console.cloud.google.com → crie (ou escolha) o projeto **Viva Nomads**.
2. **APIs e serviços → Tela de consentimento OAuth**.
3. Tipo de usuário: **Externo** → Criar.
4. Nome do app: **Viva Nomads**; e-mail de suporte: `contato@vivanomads.com.br`;
   logotipo (opcional); domínio autorizado: `vivanomads.com.br`;
   links da Política de Privacidade (`https://vivanomads.com.br/privacidade`) e dos
   Termos (`https://vivanomads.com.br/termos`).
5. Escopos: só os básicos — `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
6. **Publicar o app** (status "Em produção"). Com escopos básicos não há revisão demorada.

## 2. Google Cloud — Client ID e Secret
1. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**.
2. Tipo: **Aplicativo da Web**. Nome: `Viva Nomads — Supabase`.
3. **Origens JavaScript autorizadas:** `https://vivanomads.com.br` e `https://www.vivanomads.com.br`.
4. **URIs de redirecionamento autorizados:** a URL de callback do Supabase,
   que aparece na tela do provedor Google no Supabase (passo 3):
   `https://esezeutgtycekfosxplk.supabase.co/auth/v1/callback`
5. Criar → copie o **Client ID** e o **Client Secret** (não cole em chat nem no código).

## 3. Supabase — ativar o provedor
1. Supabase → projeto **Viva Nomads** → **Authentication → Sign In / Providers → Google**.
2. Ative **Enable Sign in with Google**, cole o **Client ID** e o **Client Secret** → Save.

## 4. Supabase — URLs de redirecionamento
**Authentication → URL Configuration**:
- **Site URL:** `https://vivanomads.com.br`
- **Redirect URLs** (adicione todas):
  - `https://vivanomads.com.br/auth/callback`
  - `https://vivanomads.com.br/auth/reset`
  - `https://vivanomads.com.br/**`
  - `https://www.vivanomads.com.br/**`
  - (previews da Vercel, se quiser testar lá) `https://*-daniels-projects-386afd6c.vercel.app/**`

## 5. Apps
- **Android (Capacitor):** o app abre o site; o login Google abre no navegador do
  sistema e volta pelo `/auth/callback`. Teste depois de ligar a flag.
- **iPhone (Expo):** na v1, **não** usar Google — a Apple exige "Entrar com a Apple"
  quando há login social. O app Expo já mostra "Entre com e-mail e senha no app" se
  a página tentar abrir `accounts.google.com`. Para o iPhone ganhar Google, é preciso
  antes implementar Sign in with Apple.

## 6. Ligar o botão
Vercel → projeto → Settings → Environment Variables → `NEXT_PUBLIC_LOGIN_GOOGLE_ATIVO = on`
(Production) → novo deploy. Teste: `/auth` → "Continuar com Google" → volta logado.
