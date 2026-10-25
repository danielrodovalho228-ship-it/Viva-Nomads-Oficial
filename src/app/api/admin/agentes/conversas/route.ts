import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { lerAtas, lerConversas, slugValido } from "@/lib/data/agentes-conversas";

/**
 * ADMIN-5 — página do chat (?slug=…) ou das atas (?atas=1) da Central de Agentes, com ?antes=<data> para a anterior.
 * Só admin (403). Leitura: nada é gravado aqui.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const uid = supabase ? (await supabase.auth.getUser()).data.user?.id : null;
  if (!supabase || !uid || !(await ehAdmin(supabase, uid))) return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  const u = new URL(request.url);
  const antes = u.searchParams.get("antes");
  if (u.searchParams.get("atas") === "1") return NextResponse.json(await lerAtas(supabase, antes));
  const slug = u.searchParams.get("slug");
  if (!slugValido(slug)) return NextResponse.json({ erro: "Agente inválido." }, { status: 400 });
  return NextResponse.json(await lerConversas(supabase, slug, antes));
}
