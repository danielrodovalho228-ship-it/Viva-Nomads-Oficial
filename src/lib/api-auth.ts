import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exige sessão em rotas /api sensíveis (pagamento, verificação, documentos).
 *
 * Regra: em PRODUÇÃO (Supabase configurado) bloqueia anônimo com 401. Em modo
 * demonstração/preview (sem Supabase) deixa passar — os fluxos de demonstração
 * (fechamento) chamam essas rotas e devem funcionar sem backend.
 *
 * Uso:
 *   const { user, block } = await requireUser();
 *   if (block) return block;
 */
export async function requireUser(): Promise<{
  user: { id: string; email?: string } | null;
  block: NextResponse | null;
}> {
  const supabase = await createClient();
  if (!supabase) return { user: null, block: null }; // demo/preview: sem backend
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      user: null,
      block: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }
  return { user: { id: user.id, email: user.email }, block: null };
}
