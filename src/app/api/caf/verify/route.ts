import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTenant, isCafConfigured } from "@/lib/integrations/caf";
import { IntegracaoNaoConfigurada, MSG_NAO_CONFIGURADA, emProducao } from "@/lib/integracoes";
import { consumirLimite, DIA } from "@/lib/limites";

/**
 * Verificação de identidade (CAF). A5: cada consulta custa e envolve dado
 * pessoal (LGPD) — então:
 *  - só da PRÓPRIA pessoa logada: nome e CPF vêm do perfil, nunca do pedido
 *    (antes dava para consultar o CPF de qualquer terceiro);
 *  - 1 consulta por pessoa a cada 90 dias;
 *  - o laudo fica gravado em tenant_verifications (válido por 90 dias).
 */
export async function POST() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: perfil } = await supabase
    .from("profiles")
    .select("full_name, cpf")
    .eq("id", user.id)
    .maybeSingle();
  const cpf = String(perfil?.cpf ?? "").replace(/\D/g, "");
  if (cpf.length !== 11) {
    return NextResponse.json({ error: "Cadastre seu CPF no perfil para verificar sua identidade." }, { status: 400 });
  }

  // Sem a integração em produção: avisa ANTES de gastar a cota de 90 dias.
  if (!isCafConfigured() && emProducao()) {
    return NextResponse.json({ error: MSG_NAO_CONFIGURADA }, { status: 503 });
  }
  if (!(await consumirLimite(`caf:user:${user.id}`, 1, 90 * DIA))) {
    return NextResponse.json(
      { error: "Você já fez uma verificação nos últimos 90 dias (ou o serviço está indisponível)." },
      { status: 429 }
    );
  }

  try {
    const result = await verifyTenant({ name: (perfil?.full_name as string) || "Inquilino", cpf });
    if (!result.demo) {
      await admin.from("tenant_verifications").insert({
        tenant_id: user.id,
        caf_result: result,
        traffic_light: result.light,
        valid_until: new Date(Date.now() + 90 * DIA * 1000).toISOString(),
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof IntegracaoNaoConfigurada) {
      return NextResponse.json({ error: MSG_NAO_CONFIGURADA }, { status: 503 });
    }
    console.error("[caf] falha:", err);
    return NextResponse.json({ error: "Falha na verificação." }, { status: 502 });
  }
}
