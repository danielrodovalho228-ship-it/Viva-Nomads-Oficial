import { NextResponse } from "next/server";
import { listProperties } from "@/lib/data/properties";

/**
 * Imóveis públicos ATIVOS (para telas client que precisam dos dados reais —
 * favoritos, comparar). Em modo demonstração, a camada devolve os exemplos.
 */
export async function GET() {
  const properties = await listProperties();
  return NextResponse.json({ properties });
}
