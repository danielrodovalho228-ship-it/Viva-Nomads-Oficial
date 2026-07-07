import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy (Next.js 16) — substitui a antiga convenção `middleware`.
 * Protege rotas privadas no servidor (Blocker 2): valida a sessão a cada
 * requisição. Só atua quando o Supabase está configurado; em modo
 * demonstração (sem backend), deixa passar para não bloquear a navegação.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  const response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
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

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  // O módulo Pedido de Moradia exige sessão para LISTAR/responder (o mural expõe
  // pedidos de inquilinos). EXCEÇÃO: /pedidos/novo é público — o inquilino vê o
  // formulário sem logar e só precisa de sessão para PUBLICAR (o server action
  // exige auth.uid() e a RLS é a trava real). Assim o CTA "Publicar pedido" do
  // topo não bate numa parede de login antes de a pessoa ver do que se trata.
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

  // Área de admin exige papel admin (validado no servidor, não só no cliente).
  // O papel vem da tabela `profiles` (fonte confiável), não do user_metadata
  // editável. Não-admin é mandado para a Visão geral.
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
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/qualificar",
    "/pedidos",
    "/pedidos/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
