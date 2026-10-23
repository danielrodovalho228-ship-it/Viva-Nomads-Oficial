import { type NextRequest, NextResponse } from "next/server";
import { rotaDetalheContrato } from "@/lib/contrato-rota";
import { createServerClient } from "@supabase/ssr";
import {
  isInternalPath,
  acessoInterno,
  INVESTIDOR_COOKIE,
  SOCIOS_COOKIE,
  SOCIOS_UNLOCK_PATH,
} from "@/lib/socios/access";
import { COOKIE_ADMIN_ATIVO, LIMITE_OCIOSO_ADMIN_MS, sessaoAdminOciosa } from "@/lib/admin/sessao-ociosa";
import { APP_COOKIE, appHome, isAppUserAgent, isMarketingPath } from "@/lib/app-mode";
import { destinoAposLogin } from "@/lib/destino-login";
import { precisaVerificarUsuario, requisicaoPrefetch, temCookieSessao } from "@/lib/login-celular";
import { decidirPortaoMfa, mfaAdminObrigatoria, rotaLivreDeAal2, urlAtivar2fa, urlVerificarCodigo } from "@/lib/admin/mfa";

/**
 * Papel para a aba inicial do APP: preferência salva, senão o papel de
 * cadastro (owner/admin → proprietário). Sem sessão → null (boas-vindas).
 */
async function papelDoApp(request: NextRequest): Promise<"owner" | "tenant" | null> {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !supaKey) return "tenant";
  // Sem cookie de sessão não há usuário: dispensa a ida ao servidor de autenticação (ordem 0f66a754).
  if (!precisaVerificarUsuario(request.cookies.getAll())) return null;
  const supabase = createServerClient(supaUrl, supaKey, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("role, preferred_mode")
    .eq("id", user.id)
    .maybeSingle();
  if (p?.preferred_mode === "owner" || p?.preferred_mode === "tenant") return p.preferred_mode;
  return p?.role === "owner" || p?.role === "admin" ? "owner" : "tenant";
}

/**
 * Proxy (Next.js 16) — substitui a antiga convenção `middleware`.
 * Protege rotas privadas no servidor a cada requisição.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── MODO APP (Android/iPhone) ─────────────────────────────────────────────
  // Dentro do app, páginas de marketing não existem: vão para a aba inicial do
  // papel. Roda ANTES de tudo (inclusive do portão dos sócios). No site normal,
  // só lê um cookie/cabeçalho e segue.
  const ehApp =
    request.cookies.get(APP_COOKIE)?.value === "1" || isAppUserAgent(request.headers.get("user-agent"));
  if (ehApp && pathname === "/app/boas-vindas") {
    const papel = await papelDoApp(request);
    if (papel) {
      const url = request.nextUrl.clone();
      url.pathname = appHome(papel);
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  if (ehApp && isMarketingPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = appHome(await papelDoApp(request));
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Site normal: home e marketing públicos seguem direto (sem consultar o
  // Supabase a cada visita). As internas dos sócios continuam no portão abaixo.
  if (isMarketingPath(pathname) && !isInternalPath(pathname)) return NextResponse.next();

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ── PÁGINAS INTERNAS DOS SÓCIOS (deck/simulações) ──────────────────────────
  // Gate por lista central (lib/socios/access). PORTA ÚNICA: só o cookie de
  // sócio válido (obtido na tela de desbloqueio digitando o código) libera —
  // SEM exceção para admin. Daniel, Romulo e Danilo passam pela mesma senha.
  // Roda ANTES do resto e não depende do Supabase. Desliga com
  // PAGES_INTERNAS_PRIVADAS=off.
  if (process.env.PAGES_INTERNAS_PRIVADAS !== "off" && isInternalPath(pathname)) {
    const response = NextResponse.next({ request });
    // Sócio abre todas; o código do investidor abre só o /simulacao.
    const allowed = !!(await acessoInterno(pathname, {
      socio: request.cookies.get(SOCIOS_COOKIE)?.value,
      investidor: request.cookies.get(INVESTIDOR_COOKIE)?.value,
    }));

    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = SOCIOS_UNLOCK_PATH;
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    // Reforço: nunca indexar (robots.txt + noindex + este header são camadas).
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  // ── DEMAIS ROTAS PRIVADAS (dashboard/admin/pedidos) — exigem Supabase ───────
  if (!supaUrl || !supaKey) return NextResponse.next();

  const cabecalhos = new Headers(request.headers);
  cabecalhos.set("x-vn-destino", destinoAposLogin(pathname, request.nextUrl.search));
  const response = NextResponse.next({ request: { headers: cabecalhos } });
  const supabase = createServerClient(supaUrl, supaKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Prefetch (o Next pré-carrega links visíveis): não é navegação de verdade, e
  // cada um custava um getUser no Supabase (~25 por login) — a 1ª tela ficava
  // lenta no celular. Sem cookie de sessão a rota protegida segue barrada
  // abaixo (sem rede, só leitura local); com cookie respondemos vazio e a
  // navegação real, que passa por toda a checagem, busca a página.
  const prefetch = requisicaoPrefetch(request.headers);
  const protegidaPorPrefixo =
    pathname.startsWith("/dashboard") || pathname.startsWith("/qualificar") ||
    pathname.startsWith("/admin") || pathname.startsWith("/pedidos");
  if (prefetch && protegidaPorPrefixo && temCookieSessao(request.cookies.getAll())) {
    return new NextResponse(null, { status: 204 });
  }

  const {
    data: { user },
  } = !precisaVerificarUsuario(request.cookies.getAll())
    ? { data: { user: null } }
    : await supabase.auth.getUser();

  const isAdminRoute = pathname.startsWith("/admin");
  // O módulo Pedido de Moradia exige sessão para LISTAR/responder (o mural expõe
  // pedidos de inquilinos). EXCEÇÃO: /pedidos/novo é público — o inquilino vê o
  // formulário sem logar e só precisa de sessão para PUBLICAR (o server action
  // exige auth.uid() e a RLS é a trava real).
  const isPedidosRoute =
    pathname !== "/pedidos/novo" &&
    (pathname === "/pedidos" || pathname.startsWith("/pedidos/"));
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/qualificar") ||
    isPedidosRoute ||
    isAdminRoute;

  // Sem sessão em rota protegida → login (guardando o destino pretendido).
  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("redirect", destinoAposLogin(pathname, request.nextUrl.search));
    // Prompt 49: anunciar é momento de valor — a entrada diz por que pede a conta.
    if (pathname.startsWith("/dashboard/imoveis/novo") || pathname.startsWith("/qualificar")) redirectUrl.searchParams.set("motivo", "anunciar");
    return NextResponse.redirect(redirectUrl);
  }

  // Admin parado há mais de 30 min: encerra a sessão e pede login de novo.
  if (isAdminRoute && user) {
    const agora = Date.now();
    const ultimoLogin = Date.parse(user.last_sign_in_at ?? "") || 0;
    if (
      sessaoAdminOciosa(
        request.cookies.get(COOKIE_ADMIN_ATIVO)?.value,
        agora,
        LIMITE_OCIOSO_ADMIN_MS,
        ultimoLogin,
      )
    ) {
      // scope local: encerra só este navegador, sem derrubar os outros aparelhos.
      await supabase.auth.signOut({ scope: "local" });
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/auth";
      loginUrl.search = "";
      loginUrl.searchParams.set("redirect", destinoAposLogin(pathname, request.nextUrl.search));
      const resposta = NextResponse.redirect(loginUrl);
      // signOut escreveu a limpeza dos cookies de sessão em `response`: repassa.
      response.cookies.getAll().forEach((c) => resposta.cookies.set(c));
      resposta.cookies.delete(COOKIE_ADMIN_ATIVO);
      return resposta;
    }
    response.cookies.set(COOKIE_ADMIN_ATIVO, String(agora), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  }

  // Área de admin exige papel admin (fonte confiável: tabela `profiles`).
  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      // Não-admin: 404 (a área de admin não revela que existe).
      const notFoundUrl = request.nextUrl.clone();
      notFoundUrl.pathname = "/nao-encontrado-admin";
      notFoundUrl.search = "";
      return NextResponse.rewrite(notFoundUrl, { status: 404 });
    }

    // Verificação em duas etapas obrigatória (ordem f7817f00): admin precisa de AAL2.
    // Sem fator → tela de ativação; com fator e sessão só com senha → tela do código.
    // O destino volta COMPLETO (pathname+search).
    if (mfaAdminObrigatoria() && !rotaLivreDeAal2(pathname)) {
      const { data: aal, error: aalErro } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const portao = aalErro ? "verificar" : decidirPortaoMfa(aal?.currentLevel, aal?.nextLevel);
      if (portao !== "liberar") {
        const destino = destinoAposLogin(pathname, request.nextUrl.search);
        const alvo = request.nextUrl.clone();
        const [caminho, consulta] = (portao === "verificar" ? urlVerificarCodigo(destino) : urlAtivar2fa(destino)).split("?");
        alvo.pathname = caminho;
        alvo.search = consulta ? `?${consulta}` : "";
        const resposta = NextResponse.redirect(alvo);
        response.cookies.getAll().forEach((c) => resposta.cookies.set(c));
        return resposta;
      }
    }
  }

  // Detalhe do contrato (dono e inquilino): id inexistente ou de outra pessoa = 404 DE VERDADE.
  // Na página o notFound() sairia 200 (o loading.tsx do painel faz streaming). A leitura vai pelo RLS.
  const rotaContrato = user ? rotaDetalheContrato(pathname) : null;
  if (rotaContrato) {
    let existe = false;
    if (rotaContrato.tipo === "id") {
      const { data } = await supabase.from("contratos").select("id").eq("id", rotaContrato.id).maybeSingle();
      existe = !!data;
    }
    if (!existe) {
      const naoEncontrado = request.nextUrl.clone();
      naoEncontrado.pathname = "/nao-encontrado-admin";
      naoEncontrado.search = "";
      return NextResponse.rewrite(naoEncontrado, { status: 404 });
    }
  }

  return response;
}

export const config = {
  // Inclui os caminhos "nus" (/dashboard, /admin) além dos subcaminhos — em
  // alguns matchers "/dashboard/:path*" não casa o /dashboard exato, deixando a
  // rota raiz passar sem o guard (era o sintoma do QA: /dashboard sem login).
  // As entradas de páginas internas espelham lib/socios/access.INTERNAL_PAGES —
  // ao adicionar uma página interna, atualize a lista LÁ e adicione aqui.
  matcher: [
    // Modo app: home e páginas de marketing (redirecionam DENTRO do app).
    "/",
    "/app/boas-vindas",
    "/home",
    "/como-funciona",
    "/para-proprietarios",
    "/precos",
    "/planos",
    "/empresas",
    "/acesso-socios",
    "/cidades/:path*",
    "/simulador",
    "/dashboard",
    "/dashboard/:path*",
    "/qualificar",
    "/pedidos",
    "/pedidos/:path*",
    "/admin",
    "/admin/:path*",
    // Páginas internas (deck dos sócios) — gate admin OU cookie de sócio.
    "/simulacao",
    "/simulacao/:path*",
    "/roi",
    "/roi/:path*",
    "/modelodenegocio",
    "/modelodenegocio/:path*",
    "/socios",
    "/socios/:path*",
    "/decisao",
    "/decisao/:path*",
    "/tributario",
    "/tributario/:path*",
  ],
};
