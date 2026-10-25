import { NextResponse } from "next/server";
import { destinosAtivos } from "@/lib/data/tempos";
import { modosDisponiveis } from "@/lib/integrations/rotas";

/** GET /api/destinos — destinos ativos (chips do "Onde você vai trabalhar ou estudar?") e os meios com dado. Público. */
export async function GET() {
  const destinos = (await destinosAtivos()).map((d) => ({ id: d.id, slug: d.slug, nome: d.nome, cidade: d.cidade }));
  return NextResponse.json({ destinos, modos: modosDisponiveis() }, { headers: { "Cache-Control": "public, max-age=300" } });
}
