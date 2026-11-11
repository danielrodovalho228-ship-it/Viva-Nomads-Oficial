import { NextResponse } from "next/server";
import { respostaNaoAdmin } from "@/lib/admin/api-nao-admin";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { listarPendentesAdmin } from "@/lib/agentes/aprovacoes-servidor";

/** Cartões de aprovação pendentes para o chat do Moacir. Só admin (404 para os demais, ordem 12a8086d). */
export async function GET() {
  const sessao = await createClient();
  if (!sessao) return respostaNaoAdmin();
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user || !(await ehAdmin(sessao, user.id))) return respostaNaoAdmin();
  const cartoes = await listarPendentesAdmin(sessao).catch(() => null);
  if (!cartoes) return NextResponse.json({ erro: "Não foi possível ler as aprovações agora." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ cartoes }, { headers: { "Cache-Control": "no-store" } });
}
