import { NextResponse } from "next/server";
import { iaCadastroLigadaAqui } from "@/lib/ai/registro-ia";

export const dynamic = "force-dynamic";

/**
 * A IA do cadastro está ligada? (prompt 22). A tela do cadastro usa para mostrar "A IA preenche o resto pelas fotos"
 * só quando é verdade. Só booleanos: nada de chave, valor de variável ou dado pessoal.
 */
export function GET() {
  return NextResponse.json(iaCadastroLigadaAqui(), { headers: { "Cache-Control": "no-store" } });
}
