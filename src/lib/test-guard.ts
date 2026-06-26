import { NextResponse } from "next/server";

/*
  Trava para rotas de teste (envio de e-mail). Evita que terceiros disparem
  e-mails pelo domínio. Regra: exige ?key=... igual à env TEST_ROUTES_KEY.
  Se TEST_ROUTES_KEY não estiver definida, a rota fica BLOQUEADA por padrão
  (seguro em produção). Para reativar: defina TEST_ROUTES_KEY na Vercel e chame
  a rota com ?key=<valor>.
*/
export function testRouteForbidden(request: Request): NextResponse | null {
  const expected = process.env.TEST_ROUTES_KEY;
  const provided = new URL(request.url).searchParams.get("key");
  if (!expected || provided !== expected) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Rota de teste protegida. Defina TEST_ROUTES_KEY na Vercel e chame com ?key=<sua-chave>.",
      },
      { status: 403 }
    );
  }
  return null;
}
