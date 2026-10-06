import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notaValida } from "@/lib/atendimento/servidor";
import { SITE_URL } from "@/lib/site";

/**
 * Nota de 1 a 5 em UM clique, pelo e-mail de "chamado resolvido" — sem login.
 * O link é assinado (chamado + nota); só vale para chamado resolvido/encerrado
 * e a primeira nota fica (clicar de novo não muda).
 */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const c = u.searchParams.get("c") ?? "";
  const n = Number(u.searchParams.get("n"));
  const s = u.searchParams.get("s") ?? "";
  const volta = (q: string) => NextResponse.redirect(`${SITE_URL}/ajuda?${q}`, 303);
  if (!/^[0-9a-f-]{36}$/i.test(c) || !Number.isInteger(n) || n < 1 || n > 5 || !notaValida(c, n, s)) {
    return volta("avaliacao=invalida");
  }
  const admin = createAdminClient();
  if (!admin) return volta("avaliacao=indisponivel");
  const { data } = await admin
    .from("chamados")
    .update({ nota_satisfacao: n, atualizado_em: new Date().toISOString() })
    .eq("id", c)
    .in("status", ["resolvido", "encerrado"])
    .is("nota_satisfacao", null)
    .select("id");
  if (data && data.length) {
    await admin.from("chamado_eventos").insert({ chamado_id: c, ator_tipo: "usuario", acao: "avaliado", para: String(n) });
  }
  return volta("avaliado=1");
}
