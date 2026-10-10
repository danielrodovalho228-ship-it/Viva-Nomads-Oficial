import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { listarPendentesAdmin } from "@/lib/agentes/aprovacoes-servidor";

/** Cartões de aprovação pendentes para o chat do Moacir. Só admin (403 para os demais). */
export async function GET() {
  const sessao = await createClient();
  if (!sessao) return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user || !(await ehAdmin(sessao, user.id))) return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  return NextResponse.json({ cartoes: await listarPendentesAdmin(sessao) }, { headers: { "Cache-Control": "no-store" } });
}
