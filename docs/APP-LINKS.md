# Links que abrem o app (um link só)

Cada e-mail tem **um botão** com o endereço normal, `https://vivanomads.com.br/<caminho exato>`. O sistema decide sozinho:

| Situação | O que acontece |
|---|---|
| Tem o app e a tela existe no app | Abre o app direto na tela |
| Tem o app, mas a tela é só do site | Abre no navegador |
| Não tem o app | Abre o site. Nas telas do app aparece a faixa "Abrir no app" (Android; no iPhone, o banner da Apple). |
| Confirmar e-mail, trocar senha, confirmar exclusão | **Sempre** no navegador. No celular, termina em "Pronto!" com "Voltar para o app". |
| Já está no app e abre algo só do site | Aviso "Esta parte fica no site" com "Abrir no navegador". Depois do login, a pessoa volta para onde ia. |

**Fonte única:** `src/config/rotas-app.ts`. Dela saem:
- o arquivo da Apple;
- o filtro do Android (`android.intentFilters` do `app.json` do Expo, gerado por `intentFiltersExpo()`);
- o aviso dentro do app;
- a faixa "Abrir no app".

## Telas do app
**Decisão do Daniel:** tudo fica no app, inclusive **criar e editar anúncio**, por causa das fotos pelo celular. A qualificação também fica, porque vem antes do anúncio.

**Saem do app (só no site):**
- `/dashboard/assinatura` (planos pagos; regra da Apple para pagamentos);
- `/dashboard/fechamento`;
- simuladores: `/dashboard/simulador`, `roi-imovel`, `viabilidade`, `ferramentas`, `/simulacao`;
- `/admin/*`;
- as páginas de marketing (o app já manda para a aba inicial).

**Sempre no navegador:** `/auth/confirm`, `/auth/callback`, `/auth/reset`, `/excluir-conta/confirmar`, `/api/*`.

A lista do app é explícita (`ROTAS_APP`): uma tela nova só entra no app quando for colocada lá. Isso é necessário porque o Android não aceita exclusões, só inclusões.

Para mudar a lista: edite `rotas-app.ts`, rode `npm test`, gere de novo o trecho do `app.json` (abaixo) e publique o app.

## E-mails: botão → caminho → onde abre

| E-mail | Botão leva a | Abre |
|---|---|---|
| Novo interessado (proprietário) | `/dashboard/leads` | app |
| Nova mensagem no chat | `/dashboard/mensagens` | app |
| Candidatura aceita (inquilino) | `/dashboard/candidaturas` | app |
| Renovação de contrato (pedido ou confirmação) | `/dashboard/contratos` (antes ia para `/dashboard`) | app |
| Documento aprovado ou recusado | `/dashboard/imoveis` (antes saía **sem botão**) | app |
| Pedido de Moradia: resposta / expirando | `/dashboard/pedidos` | app |
| Pedido aceito para conversa | `/dashboard/mensagens` | app |
| Pedido compatível / resumo diário (proprietário) | `/dashboard/pedidos-cidade` (antes saía sem botão) | app |
| Imóvel novo para o seu pedido (inquilino) | `/dashboard/pedidos` | app |
| Pedido ocultado pela moderação | `/dashboard/pedidos` | app |
| Chamado aberto / respondido / resolvido | `/ajuda?chamado=VN-…` (visitante: `/ajuda`) | app |
| Chamado: "Falar com uma pessoa" (Viva) | `/ajuda?pessoa=…` | app |
| Chamado: nota de 1 a 5 | `/api/atendimento/avaliar…` | navegador (só registra e volta para `/ajuda`) |
| Manutenção nova / atrasada / lembrete (proprietário) | `/dashboard/solicitacoes` (antes saía sem botão) | app |
| Atendimento: chamado para a equipe (admin) | `/admin/atendimento/<id>` | site |
| Documento recebido para conferir (admin) | `/admin/documentos` (antes ia para `/dashboard`) | site |
| Confirmar exclusão de conta | `/excluir-conta/confirmar?token=…` | navegador |
| Confirmar e-mail (Supabase) | `/auth/confirm?token_hash=…&type=signup&next=/dashboard` | navegador → "Pronto!" no celular |
| Trocar senha (Supabase) | `/auth/reset` | navegador → "Pronto!" no celular |

Regra no código (`notify`):
- o botão-padrão leva à mesma tela do push, nunca à home;
- quando o detalhe do e-mail já tem um link, o e-mail fica só com esse link.

O rodapé "Se você tem o app Viva Nomads, ele abre direto no app." aparece com `APP_LINKS_ATIVO=on`. **Ligue só depois que a versão nova do app estiver nas lojas.**

## O que configurar (Vercel)

| Variável | Valor | Onde pegar |
|---|---|---|
| `APP_IOS_IDS` | `TEAMID.bundle.id` (ex.: `ABCDE12345.br.com.vivanomads.app`) | Team ID: developer.apple.com → Account → Membership. O bundle id é o `ios.bundleIdentifier` do `app.json`. |
| `APP_ANDROID_SHA256` | `AA:BB:…` (32 pares; vírgula para mais de um) | Veja abaixo. |
| `APP_ANDROID_PACKAGE` | opcional (padrão `br.com.vivanomads.app`) | O `android.package` do `app.json`. |
| `NEXT_PUBLIC_IOS_APP_ID` | número do app na App Store | App Store Connect → o app → Informações do app → Apple ID. Liga o banner da Apple. |
| `NEXT_PUBLIC_APP_ANDROID_PUBLICADO` | `on` quando o app estiver público na Play | Liga a faixa "Abrir no app" no Android. |
| `APP_LINKS_ATIVO` | `on` depois da versão nova nas lojas | Rodapé dos e-mails. |

**SHA-256 do Android (app Expo).** O `assetlinks.json` precisa da impressão do certificado que **assina o app instalado no celular**. São duas:
1. **Chave de assinatura do Google (Play App Signing).** Vale para quem instala pela Play, ou seja, a que importa. Play Console → o app → Testar e lançar → Configuração → **Integridade do app** → "Certificado da chave de assinatura do app" → SHA-256. Só aparece depois do primeiro `.aab` enviado.
2. **Chave de upload do EAS.** Vale para testar um build instalado direto, fora da Play. No PowerShell, `eas credentials -p android` → escolha o perfil (production) → "Keystore" mostra o SHA-256. O mesmo valor aparece no Play Console como "Certificado da chave de upload".

Cadastre as duas, separadas por vírgula. Sem `APP_IOS_IDS` ou sem `APP_ANDROID_SHA256`, o arquivo correspondente responde 404, de propósito.

Para conferir depois do deploy:
- `https://vivanomads.com.br/.well-known/apple-app-site-association`
- `https://vivanomads.com.br/.well-known/assetlinks.json`

Os dois têm de responder 200, em JSON e sem redirecionamento. Validadores:
- Apple: <https://app-site-association.cdn-apple.com/a/v1/vivanomads.com.br>
- Google: <https://developers.google.com/digital-asset-links/tools/generator>

## App Expo (viva-nomads-app) — iPhone e Android
**Um app só.** O Capacitor foi aposentado (veja `docs/CAPACITOR-APOSENTADO.md`).

**app.json** (trecho gerado de `rotas-app.ts`; junte ao que já existe):
```json
{
  "expo": {
    "scheme": "vivanomads",
    "ios": {
      "associatedDomains": [
        "applinks:vivanomads.com.br"
      ]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/auth"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/app"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/app/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/buscar"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/buscar/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/imoveis"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/imoveis/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/pedidos"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/pedidos/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/ajuda"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/ajuda/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/mensagens"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/mensagens/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/favoritos"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/favoritos/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/candidaturas"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/candidaturas/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/leads"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/leads/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/pedidos"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/pedidos/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/pedidos-cidade"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/pedidos-cidade/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/contratos"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/contratos/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/locacoes"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/locacoes/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/solicitacoes"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/solicitacoes/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/buscas"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/buscas/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/imoveis"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/imoveis/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/qualificar"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/qualificar/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/verificacao"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/verificacao/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/carteira"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/carteira/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/orcamentos"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/orcamentos/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/reembolsos"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/reembolsos/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/garantias"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/garantias/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/comparar"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/comparar/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/indicacoes"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/indicacoes/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/dashboard/conta"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "pathPrefix": "/dashboard/conta/"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/excluir-conta"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/privacidade"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/termos"
            },
            {
              "scheme": "https",
              "host": "vivanomads.com.br",
              "path": "/seguranca"
            }
          ],
          "category": [
            "BROWSABLE",
            "DEFAULT"
          ]
        },
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "vivanomads"
            }
          ],
          "category": [
            "BROWSABLE",
            "DEFAULT"
          ]
        }
      ]
    }
  }
}
```

**Tela da WebView** (ajuste os nomes ao código atual):
```tsx
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { WebView } from "react-native-webview";

const SITE = "https://vivanomads.com.br";
const ATALHOS: Record<string, string> = { perfil: "/dashboard/conta", mensagens: "/dashboard/mensagens", contratos: "/dashboard/contratos", pedidos: "/dashboard/pedidos", ajuda: "/ajuda", painel: "/dashboard" };

/** Mesmo critério de caminhoDoLink (src/config/rotas-app.ts) no site. */
function caminhoDoLink(link: string | null): string | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    let caminho: string;
    if (u.protocol === "vivanomads:") {
      const bruto = (`${u.host ? `/${u.host}` : ""}${u.pathname}`.replace(/\/{2,}/g, "/")) || "/";
      const chave = bruto.slice(1).split("/")[0];
      caminho = bruto === `/${chave}` && ATALHOS[chave] ? ATALHOS[chave] : bruto;
    } else if (u.protocol === "https:" && (u.hostname === "vivanomads.com.br" || u.hostname === "www.vivanomads.com.br")) {
      caminho = u.pathname;
    } else return null;
    const c = `${caminho}${u.search}${u.hash}`;
    return c.startsWith("/") && !c.startsWith("//") ? c : null;
  } catch {
    return null;
  }
}

export function TelaSite() {
  const ref = useRef<WebView>(null);
  const [inicio, setInicio] = useState<string | null>(null);

  useEffect(() => {
    // App fechado: abre direto no caminho do link.
    Linking.getInitialURL().then((l) => setInicio(SITE + (caminhoDoLink(l) ?? "/")));
    // App aberto: leva a WebView ao caminho.
    const sub = Linking.addEventListener("url", ({ url }) => {
      const c = caminhoDoLink(url);
      if (c) ref.current?.injectJavaScript(`window.location.assign(${JSON.stringify(c)});true;`);
    });
    return () => sub.remove();
  }, []);

  if (!inicio) return null;
  return (
    <WebView
      ref={ref}
      source={{ uri: inicio }}
      // "Esta parte fica no site" → "Abrir no navegador": o site manda esta mensagem.
      onMessage={(e) => {
        try {
          const m = JSON.parse(e.nativeEvent.data);
          if (m?.tipo === "abrir-navegador" && typeof m.url === "string" && m.url.startsWith(SITE + "/")) Linking.openURL(m.url);
        } catch {}
      }}
      /* …demais props atuais (userAgent com "VivaNomadsApp", etc.) */
    />
  );
}
```
As telas só do site não estão no filtro do Android nem no arquivo da Apple. Por isso o `Linking.openURL` delas cai no navegador, e não de volta no app.

Depois: `eas build -p all` e `eas submit`. O EAS liga o Associated Domains no App ID quando o `app.json` tem `associatedDomains`.

## Push no app Expo (plano — sem código)
**Hoje:** o push só existia no Capacitor. O site guarda tokens do Firebase (FCM) em `push_tokens` (`user_id`, `token`, `platform`) pela ação `registrarPushToken`, e `sendPush` envia direto pelo FCM v1 com a conta de serviço do Firebase. O `notify()` já dispara o push junto com o e-mail, com o título do evento e a tela (`url`), sem dado pessoal.

**Proposta:** usar o serviço de push do Expo, com o mínimo de mudança.
1. **No app:** `expo-notifications`. Depois do login, e só então, uma frase explica o motivo e o app pede a permissão. Em seguida pega o `getExpoPushTokenAsync()` (`ExponentPushToken[…]`).
2. **Ligar o token à pessoa:** o app entrega o token à WebView (`injectJavaScript`), e o site chama a mesma `registrarPushToken(token, "ios" | "android")`, com a sessão da pessoa. O token do Expo se reconhece pelo prefixo `ExponentPushToken[`. Não precisa de tabela nova nem de migration: `push_tokens` já serve.
3. **No servidor:** `sendPush` passa a separar os tokens. Os `ExponentPushToken[…]` vão em lote para `https://exp.host/--/api/v2/push/send`; os do Firebase, se ainda existirem, continuam pelo FCM até o Capacitor sair. Tokens que o Expo devolver como `DeviceNotRegistered` são apagados.
4. **Toque na notificação:** o app lê `data.url` e leva a WebView à tela, pelo mesmo caminho dos links (`caminhoDoLink`).
5. **Credenciais, uma vez só, pelo EAS:**
   - **Android:** criar o projeto no Firebase, baixar o `google-services.json` (vai no `app.json` como `android.googleServicesFile`) e subir a chave da conta de serviço FCM v1 com `eas credentials -p android` → Push Notifications.
   - **iPhone:** o EAS cria a chave APNs sozinho no `eas build`.
6. **Testes:** unitário da separação Expo × FCM e do tratamento de `DeviceNotRegistered`; manual com um aparelho de cada sistema.

## Login social no app — decisão
- **iPhone (lançamento): só e-mail e senha.** Nada de Google nem Apple agora: se o iPhone oferecer Google, a Apple exige também uma opção de login focada em privacidade ("Entrar com a Apple").
- **Quem entrou com Google no site:** dentro do app, a tela de entrar mostra "Entrou com Google no site? Toque em 'Esqueci minha senha' para criar uma senha e usar o app." O botão do Google não aparece no app.
  - **Mesma conta:** o Auth do Supabase guarda um usuário por e-mail (índice `users_email_partial_key`, conferido em produção) e só atualiza a senha desse usuário.
  - **Mesmo perfil:** o perfil nasce só no cadastro (gatilho `on_auth_user_created`, de INSERT). Redefinir a senha não cria outro.
  - **Testes:** a fase `GOOGLE→SENHA` da suíte de banco (`supabase/testes/p0-rls/fase_google_senha.sql`); o e2e T14 confere a dica no app.
- **Android: Google pelo navegador do sistema** (a implementar no `viva-nomads-app`, quando ele estiver no GitHub):
  1. no app, o site chama `signInWithOAuth({ provider: "google", options: { redirectTo: "vivanomads://auth/callback", skipBrowserRedirect: true } })`, e o verificador PKCE fica na WebView;
  2. o site manda `postMessage({ tipo: "login-google", url })`, e o app chama `WebBrowser.openAuthSessionAsync(url, "vivanomads://auth/callback")`;
  3. o app leva a WebView a `/auth/callback?code=…`, que troca o código pela sessão. O código sozinho não serve para nada;
  4. Supabase → Authentication → URL Configuration: acrescentar `vivanomads://auth/callback`.

  Quando isso existir, a dica e o "sem Google" passam a valer só no iPhone.
- **Pós-lançamento:** Google **e** "Entrar com a Apple" juntos no iPhone, se fizer falta.

## Roteiro de teste manual (depois dos builds)
Em cada aparelho (iPhone e Android), **com** o app novo instalado e **sem** o app, toque no link de:
1. nova mensagem;
2. novo interessado;
3. candidatura aceita;
4. chamado respondido (`/ajuda?chamado=…`);
5. documento aprovado;
6. manutenção nova;
7. chamado para a equipe (admin);
8. confirmar e-mail;
9. trocar senha.

| | Com o app | Sem o app |
|---|---|---|
| 1–6 | Abre o app **na tela do link** (não na home) | Abre o site na tela; no Android, a faixa "Abrir no app" (se a Play estiver ligada) |
| 7 | Abre no **navegador** | Abre no navegador |
| 8–9 | Abre no **navegador**; no fim, "Pronto!" + "Voltar para o app" → abre o app no Perfil | Abre no navegador; "Voltar para o app" não faz nada (sem app) |

Dentro do app:
- abra Painel → "Anunciar imóvel": deve abrir **no app**;
- abra Painel → "Assinatura": deve aparecer "Esta parte fica no site". "Abrir no navegador" leva ao navegador; entre, se pedir, e confira que a pessoa cai em `/dashboard/assinatura`.
