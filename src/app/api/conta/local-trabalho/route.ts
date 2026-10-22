import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estadoDoLocal, normalizarLocal } from "@/lib/data/local-trabalho";
import { destinosAtivos } from "@/lib/data/tempos";
import { modosDisponiveis } from "@/lib/integrations/rotas";

/**
 * GET /api/conta/local-trabalho — o "Meu local de trabalho" da PRÓPRIA pessoa (prompt 37), no formato da busca.
 * Sem login: 204. Lido com o cliente da sessão: a RLS do perfil garante que ninguém lê o de outra pessoa.
 */
export async function GET() {
  const supabase = await createClient();
  if (!supabase) return new NextResponse(null, { status: 204 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });
  const { data } = await supabase.from("profiles").select("local_trabalho").eq("id", user.id).maybeSingle();
  const local = normalizarLocal(data?.local_trabalho ?? null);
  const admin = createAdminClient();
  const estado = await estadoDoLocal(local, admin);
  const destinos = (await destinosAtivos(admin)).map((d) => ({ slug: d.slug, nome: d.nome, cidade: d.cidade }));
  return NextResponse.json({ estado, rotulo: local?.rotulo ?? null, destinos, modos: modosDisponiveis() }, { headers: { "Cache-Control": "private, no-store" } });
}
