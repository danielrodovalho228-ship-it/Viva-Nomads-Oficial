import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isInternalPath,
  sociosCookieValido,
  SOCIOS_COOKIE,
  SOCIOS_UNLOCK_PATH,
} from "@/lib/socios/access";
import { APP_COOKIE, appHome, isAppUserAgent, isMarketingPath } from "@/lib/app-mode";

/**
 * Papel para a aba inicial do APP: preferência salva, senão o papel de
 * cadastro (owner/admin → proprietário). Sem sessão → null (boas-vindas).
 */
async function papelDoApp(request: NextRequest): Promise<"owner" | "tenant" | null> {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !supaKey) return "tenant";
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
    const allowed = await sociosCookieValido(request.cookies.get(SOCIOS_COOKIE)?.value);

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

  const response = NextResponse.next({ request });
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Área de admin exige papel admin (fonte confiável: tabela `profiles`).
  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      return NextResponse.redirect(redirectUrl);
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
