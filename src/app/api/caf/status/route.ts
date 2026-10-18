import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { resumoDoLaudo, type LaudoCafGravado } from "@/lib/documento/conferencia-matricula";

export const dynamic = "force-dynamic";

/**
 * Situação da confirmação de identidade (CAF) da PRÓPRIA pessoa, para a etapa "Identidade" do cadastro do anúncio
 * (decisão do Daniel, 18/10): pula a etapa se já há laudo válido (12 meses). Devolve só booleanos e a validade —
 * nunca o laudo, o CPF ou o nome.
 */
export async function GET() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.json({ feita: false, ok: false, temCpf: false });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const [{ data: perfil }, { data: laudo }] = await Promise.all([
    admin.from("profiles").select("cpf, is_teste").eq("id", user.id).maybeSingle(),
    admin
      .from("tenant_verifications")
      .select("caf_result, traffic_light, valid_until, created_at")
      .eq("tenant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const r = resumoDoLaudo((laudo as LaudoCafGravado | null) ?? null, new Date(), integracoesSimuladas() || perfil?.is_teste === true);
  return NextResponse.json({
    feita: r.feita,
    ok: r.ok,
    temCpf: String(perfil?.cpf ?? "").replace(/\D/g, "").length === 11,
    // Prompt 23: a tela de verificação mostra o laudo simulado só para a conta de teste (decisão do servidor).
    teste: perfil?.is_teste === true,
    validoAte: r.feita ? ((laudo?.valid_until as string | null) ?? null) : null,
    // Prompt 25: havia laudo e ele deixou de valer (venceu ou a pessoa trocou o nome/CPF — 0164): "Confirmar de novo".
    refazer: !r.feita && !!laudo,
  });
}
