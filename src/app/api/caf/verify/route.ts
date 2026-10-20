import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTenant, isCafConfigured } from "@/lib/integrations/caf";
import { IntegracaoNaoConfigurada, emProducao } from "@/lib/integracoes";
import { contaEhDeTeste, laudoSimuladoTeste, MSG_VERIFICACAO_EM_BREVE } from "@/lib/contas-de-teste";
import { consumirLimite } from "@/lib/limites";
import { CAF_JANELA_CONSULTA_S, validadeDoLaudo } from "@/lib/caf/validade";
import type { CafResult } from "@/lib/closing";

async function gravarSimulado(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string, laudo: CafResult) {
  await admin.from("tenant_verifications").insert({
    tenant_id: userId,
    caf_result: { ...laudo, simulado: true },
    traffic_light: null,
    valid_until: validadeDoLaudo(new Date()).toISOString(),
  });
}

/**
 * Verificação de identidade (CAF) — de QUALQUER conta (prompt 19: o proprietário confirma a identidade antes da
 * conferência da matrícula; o inquilino, como antes). A5: cada consulta custa e envolve dado pessoal (LGPD) — então:
 *  - só da PRÓPRIA pessoa logada: nome e CPF vêm do perfil, nunca do pedido
 *    (antes dava para consultar o CPF de qualquer terceiro);
 *  - 1 consulta por pessoa a cada 12 meses (decisão do Daniel, 18/10 — prompt 22);
 *  - o laudo fica gravado em tenant_verifications (válido por 12 meses) e é reaproveitado pela matrícula;
 *  - trocou o nome ou o CPF: o laudo deixa de valer e a cota é liberada (gatilho no banco, 0164).
 * Laudo SIMULADO (conta de teste ou laboratório) também é gravado, marcado `simulado` e sem semáforo (não aparece
 * para os donos nos pedidos): a conferência da matrícula só o aceita fora de uma conta real em produção.
 */
export async function POST() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  // Conta de teste (is_teste): laudo SIMULADO, sem CPF, sem Certta/CAF e sem gastar a cota (ordem ee7d27b8).
  if (await contaEhDeTeste(admin, user.id)) {
    const laudo = laudoSimuladoTeste();
    await gravarSimulado(admin, user.id, laudo);
    return NextResponse.json(laudo);
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("full_name, cpf")
    .eq("id", user.id)
    .maybeSingle();
  const cpf = String(perfil?.cpf ?? "").replace(/\D/g, "");
  if (cpf.length !== 11) {
    return NextResponse.json({ error: "Cadastre seu CPF no perfil para verificar sua identidade." }, { status: 400 });
  }

  // Sem a integração em produção: avisa ANTES de gastar a cota de 12 meses.
  if (!isCafConfigured() && emProducao()) {
    return NextResponse.json({ error: MSG_VERIFICACAO_EM_BREVE }, { status: 503 });
  }
  if (!(await consumirLimite(`caf:user:${user.id}`, 1, CAF_JANELA_CONSULTA_S))) {
    return NextResponse.json(
      { error: "Você já fez uma verificação nos últimos 12 meses (ou o serviço está indisponível). Se trocou o nome ou o CPF, a nova verificação fica liberada." },
      { status: 429 }
    );
  }

  try {
    const result = await verifyTenant({ name: (perfil?.full_name as string) || "Titular", cpf });
    if (result.demo) {
      await gravarSimulado(admin, user.id, result);
    } else {
      await admin.from("tenant_verifications").insert({
        tenant_id: user.id,
        caf_result: result,
        traffic_light: result.light,
        valid_until: validadeDoLaudo(new Date()).toISOString(),
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof IntegracaoNaoConfigurada) {
      return NextResponse.json({ error: MSG_VERIFICACAO_EM_BREVE }, { status: 503 });
    }
    console.error("[caf] falha:", err);
    return NextResponse.json({ error: "Falha na verificação." }, { status: 502 });
  }
}
