/*
  Trava para rotas de teste (envio de e-mail). Evita que terceiros disparem
  e-mails pelo domínio. Regra: exige ?key=... igual à env TEST_ROUTES_KEY.
  Se TEST_ROUTES_KEY não estiver definida, a rota fica BLOQUEADA por padrão
  (seguro em produção). Para reativar: defina TEST_ROUTES_KEY na Vercel e chame
  a rota com ?key=<valor>.
  Em produção na Vercel (VERCEL_ENV=production) a rota nem "existe": 404 com ou
  sem chave. Em preview segue valendo a chave.
*/
export function emProducaoVercel(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function testRouteForbidden(request: Request): Response | null {
  if (emProducaoVercel()) {
    return Response.json({ ok: false, error: "Não encontrado." }, { status: 404 });
  }
  const expected = process.env.TEST_ROUTES_KEY;
  const provided = new URL(request.url).searchParams.get("key");
  if (!expected || provided !== expected) {
    return Response.json(
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
