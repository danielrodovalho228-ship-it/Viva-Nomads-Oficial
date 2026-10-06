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
- o filtro do Android (um teste confere que o `AndroidManifest.xml` bate com ela);
- o aviso dentro do app;
- a faixa "Abrir no app".

## Telas do app (proposta)
A lista saiu das abas e do painel que o app mostra hoje:

`/auth` (entrar) · `/app/*` · `/buscar` · `/imoveis/*` (anúncio público) · `/pedidos/*` · `/ajuda` (chamados) · `/dashboard` (painel) · `/dashboard/mensagens` · `/favoritos` · `/candidaturas` · `/leads` (interessados) · `/pedidos` · `/pedidos-cidade` · `/contratos` · `/locacoes` · `/solicitacoes` (manutenção) · `/buscas` · `/dashboard/imoveis` (só a lista) · `/dashboard/conta/*` (perfil) · `/excluir-conta` (as lojas exigem que a conta possa ser excluída dentro do app) · `/privacidade` · `/termos` · `/seguranca`.

**Só no site** é todo o resto. Por exemplo:
- `/admin/*`, `/qualificar`;
- criar e editar anúncio: `/dashboard/imoveis/novo` e `/dashboard/imoveis/*/editar`;
- `/dashboard/fechamento`, `/dashboard/assinatura` (pagamento fica fora do app, regra da Apple);
- os simuladores e ferramentas: `simulador`, `roi-imovel`, `viabilidade`, `ferramentas`;
- `carteira`, `orcamentos`, `reembolsos`, `garantias`, `comparar`, `verificacao`, `indicacoes`;
- as páginas de marketing.

**Sempre no navegador:** `/auth/confirm`, `/auth/callback`, `/auth/reset`, `/excluir-conta/confirmar`, `/api/*`.

Para mudar a lista, edite `rotas-app.ts`, rode `npm test` (o teste aponta o `AndroidManifest.xml` desatualizado) e publique um app novo nas lojas.

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
| `APP_IOS_IDS` | `TEAMID.bundle.id` (ex.: `ABCDE12345.br.com.vivanomads.app`) | Team ID: developer.apple.com → Account → Membership. O bundle id está no `app.json` do viva-nomads-app (`ios.bundleIdentifier`). |
| `APP_ANDROID_SHA256` | `AA:BB:…` (32 pares; use vírgula para mais de um) | Play Console → o app → Testar e lançar → Configuração → **Integridade do app** → "Certificado da chave de assinatura do app" → SHA-256. Para testar um `.aab` local antes da Play, inclua também o SHA-256 do "Certificado da chave de upload". |
| `APP_ANDROID_PACKAGE` | opcional (padrão `br.com.vivanomads.app`) | |
| `NEXT_PUBLIC_IOS_APP_ID` | número do app na App Store | App Store Connect → o app → Informações do app → Apple ID. Liga o banner da Apple. |
| `NEXT_PUBLIC_APP_ANDROID_PUBLICADO` | `on` quando o app estiver público na Play | Liga a faixa "Abrir no app" no Android. |
| `APP_LINKS_ATIVO` | `on` depois da versão nova nas lojas | Rodapé dos e-mails. |

Sem `APP_IOS_IDS` ou sem `APP_ANDROID_SHA256`, o arquivo correspondente responde 404. Assim nada inválido fica guardado em cache pela Apple ou pelo Google.

Para conferir depois do deploy:
- `https://vivanomads.com.br/.well-known/apple-app-site-association`
- `https://vivanomads.com.br/.well-known/assetlinks.json`

Os dois têm de responder 200, em JSON e sem redirecionamento. Validadores:
- Apple: <https://app-site-association.cdn-apple.com/a/v1/vivanomads.com.br>
- Google: <https://developers.google.com/digital-asset-links/tools/generator>

## Android (Capacitor, neste repositório)
Já está feito neste PR:
- `AndroidManifest.xml`: filtro com `autoVerify` para as telas do app e o esquema `vivanomads://`;
- `versionCode 3` / `1.0.2`;
- `src/components/app/links-do-app.tsx`: com o app fechado, lê `App.getLaunchUrl()`; com o app aberto, escuta `appUrlOpen`; nos dois casos leva a WebView à tela do link.

Para publicar:
```powershell
npm install
npx cap sync android
```
Depois, no Android Studio, gere o `.aab` assinado e suba na Play (veja `docs/PLAY-STORE.md`).

## iPhone (Expo, repositório viva-nomads-app — fora deste GitHub)
Não tenho acesso a esse repositório. Aplique isto (ou suba o repositório para o GitHub que eu aplico e testo):

**app.json**
```json
{
  "expo": {
    "scheme": "vivanomads",
    "ios": { "associatedDomains": ["applinks:vivanomads.com.br"] }
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

/** Mesmo critério de src/config/rotas-app.ts (caminhoDoLink) no site. */
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
Depois: `eas build -p ios` e `eas submit -p ios`. O Associated Domains precisa estar ligado no App ID; o EAS faz isso sozinho quando o `app.json` tem `associatedDomains`.

> Se o app do Android publicado também for o do Expo (e não o Capacitor deste repositório), me avise: aí o filtro do Android vai para `android.intentFilters` do `app.json`, gerado da mesma lista.

## Login com Google no app (plano — não implementado)
**Por que falha hoje:** o Google bloqueia login dentro de WebView (erro `disallowed_useragent`). Por isso o app do iPhone mostra um alerta.

**Proposta, sem passar sessão na URL:** login no navegador do sistema, com PKCE, voltando ao app pelo esquema.
1. No app, "Continuar com Google" chama no site `signInWithOAuth({ provider: "google", options: { redirectTo: "vivanomads://auth/callback", skipBrowserRedirect: true } })`. O verificador PKCE fica guardado **na WebView**.
2. O site entrega a URL do Google ao app:
   - iPhone: `postMessage({ tipo: "login-google", url })`, e o app chama `WebBrowser.openAuthSessionAsync(url, "vivanomads://auth/callback")`;
   - Android: `Browser.open`.
3. O Google volta para `vivanomads://auth/callback?code=…`. O app leva a WebView a `/auth/callback?code=…`, que troca o código pela sessão usando o verificador que só ela tem. O código sozinho não serve para nada.
4. Supabase → Authentication → URL Configuration: acrescentar `vivanomads://auth/callback` em Redirect URLs.

**Alternativa:** login nativo (Google Sign-In SDK + `signInWithIdToken`). Exige client IDs próprios de iOS e Android e mais código nativo. Recomendo a primeira.

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

Dentro do app, abra Painel → "Anunciar imóvel". Deve aparecer "Esta parte fica no site". "Abrir no navegador" leva ao navegador; entre, se pedir, e confira que a pessoa cai em `/dashboard/imoveis/novo`.
