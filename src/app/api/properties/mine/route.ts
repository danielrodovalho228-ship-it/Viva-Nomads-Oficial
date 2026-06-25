import { NextResponse } from "next/server";
import { listMyProperties } from "@/lib/data/properties";

/**
 * Imóveis do proprietário logado (todos os status), para telas client —
 * visão geral e orçamentos. Em modo demonstração, devolve exemplos.
 */
export async function GET() {
  const properties = await listMyProperties();
  return NextResponse.json({ properties });
}
