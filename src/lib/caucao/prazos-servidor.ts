import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { CAUCAO_PRAZOS_ATIVA } from "@/lib/flags";
import { ASSUNTOS } from "@/lib/notifications/assuntos";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import { contratoTemCaucao, estadoDosPrazos, type ItemDesconto } from "./prazos";

/*
  E637 — roda os prazos da caução (1×/dia). ATRÁS DA CHAVE CAUCAO_PRAZOS_ATIVA (desligada): sem ela, não faz nada.
    • contrato encerrado (todos os blocos acabaram) ganha a linha de prazos, com o dia do check-out;
    • passou do dia 7 sem parecer → "liberação integral" (silêncio) e AVISA os dois (uma vez);
    • passou do dia 30 sem devolução → pendência (painel do dono + bloqueio de anúncio novo) e AVISA o dono (uma vez).
  A Viva nunca decide a disputa: aqui só se contam prazos.
*/
export interface ResumoCaucao {
  ativa: boolean;
  contratos: number;
  liberacoes: number;
  pendencias: number;
}

const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

export async function rodarCaucaoPrazos(admin: SupabaseClient, agora: Date = new Date()): Promise<ResumoCaucao> {
  if (!CAUCAO_PRAZOS_ATIVA) return { ativa: false, contratos: 0, liberacoes: 0, pendencias: 0 };
  const hoje = dia(agora);
  const resumo: ResumoCaucao = { ativa: true, contratos: 0, liberacoes: 0, pendencias: 0 };

  // Contratos cujos blocos já acabaram (todos terminaram antes de hoje) e ainda não têm linha de prazos.
  const { data: contratos } = await admin
    .from("contratos")
    .select("id, tenant_id, property_id, garantia, properties(owner_id, title), contrato_blocos(fim)")
    .in("status", ["concluido", "encerrado_sem_renovacao", "encerrado_em_acerto"]);
  for (const c of (contratos ?? []) as unknown as { id: string; tenant_id: string; garantia?: string | null; properties: { owner_id?: string; title?: string } | null; contrato_blocos: { fim: string }[] | null }[]) {
    // E642: contrato com seguro-fiança não tem caução — nada de prazo de devolução, aviso nem bloqueio.
    if (!contratoTemCaucao(c.garantia)) continue;
    const fins = (c.contrato_blocos ?? []).map((b) => b.fim).sort();
    if (!fins.length || fins[fins.length - 1] >= hoje) continue;
    await admin.from("caucao_prazos").upsert({ contrato_id: c.id, saida_em: fins[fins.length - 1] }, { onConflict: "contrato_id", ignoreDuplicates: true });
  }

  const { data: linhas } = await admin
    .from("caucao_prazos")
    .select("contrato_id, saida_em, parecer_em, liberacao_integral_em, avisou_liberacao_em, devolvida_em, pendencia_em")
    .is("devolvida_em", null);
  for (const l of (linhas ?? []) as { contrato_id: string; saida_em: string; parecer_em: string | null; liberacao_integral_em: string | null; avisou_liberacao_em: string | null; devolvida_em: string | null; pendencia_em: string | null }[]) {
    resumo.contratos++;
    const { data: itens } = await admin.from("caucao_desconto_itens").select("id, valor, categoria, comodo, foto_entrada_path, foto_saida_path, comprovante_path, status").eq("contrato_id", l.contrato_id);
    const descontos: ItemDesconto[] = ((itens ?? []) as { id: string; valor: number; categoria: string; comodo: string; foto_entrada_path: string | null; foto_saida_path: string | null; comprovante_path: string | null; status: ItemDesconto["status"] }[]).map((i) => ({
      id: i.id, valor: Number(i.valor), categoria: i.categoria, comodo: i.comodo, fotoEntrada: i.foto_entrada_path, fotoSaida: i.foto_saida_path, comprovante: i.comprovante_path, status: i.status,
    }));
    const estado = estadoDosPrazos({ saida: l.saida_em, parecerEm: l.parecer_em ? l.parecer_em.slice(0, 10) : null, descontos, devolvidaEm: null, hoje });
    const { data: ctr } = await admin.from("contratos").select("tenant_id, properties(owner_id, title)").eq("id", l.contrato_id).maybeSingle();
    const dono = (ctr?.properties as unknown as { owner_id?: string; title?: string } | null) ?? {};
    const imovel = dono.title ?? "o imóvel";
    const [{ data: pd }, { data: pm }] = await Promise.all([
      dono.owner_id ? admin.from("profiles").select("email, full_name").eq("id", dono.owner_id).maybeSingle() : Promise.resolve({ data: null }),
      ctr?.tenant_id ? admin.from("profiles").select("email, full_name").eq("id", ctr.tenant_id as string).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const donoP = pd as { email?: string | null; full_name?: string | null } | null;
    const moradorP = pm as { email?: string | null; full_name?: string | null } | null;

    if (estado.chave === "liberacao_integral" && !l.liberacao_integral_em) {
      await admin.from("caucao_prazos").update({ liberacao_integral_em: agora.toISOString(), liberacao_motivo: estado.motivo, atualizado_em: agora.toISOString() }).eq("contrato_id", l.contrato_id);
      resumo.liberacoes++;
    }
    if (estado.avisarOsDois && !l.avisou_liberacao_em) {
      const texto = (n?: string) => `Olá${n ? " " + n : ""}, o prazo de 7 dias para o parecer sobre a caução de ${imovel} terminou sem desconto. A liberação integral foi registrada: a devolução é devida agora. O teto externo é ${estado.tetoExterno.split("-").reverse().join("/")} (30 dias do check-out).`;
      if (donoP?.email) await notify({ event: "contract_status", email: donoP.email, name: donoP.full_name ?? undefined, userId: dono.owner_id, pushUrl: `/dashboard/contratos/${l.contrato_id}`, subject: ASSUNTOS.caucaoLiberacaoIntegral, body: texto, ctaLabel: "Ver o contrato" });
      if (moradorP?.email) await notify({ event: "contract_status", email: moradorP.email, name: moradorP.full_name ?? undefined, userId: ctr?.tenant_id as string, pushUrl: HREF_ESTADIA(l.contrato_id), subject: ASSUNTOS.caucaoLiberacaoIntegral, body: texto, ctaLabel: "Ver o contrato" });
      await admin.from("caucao_prazos").update({ avisou_liberacao_em: agora.toISOString() }).eq("contrato_id", l.contrato_id);
    }
    if (estado.pendenciaDevolucao && !l.pendencia_em) {
      await admin.from("caucao_prazos").update({ pendencia_em: agora.toISOString(), atualizado_em: agora.toISOString() }).eq("contrato_id", l.contrato_id);
      resumo.pendencias++;
      if (donoP?.email) {
        await notify({
          event: "contract_status", email: donoP.email, name: donoP.full_name ?? undefined, userId: dono.owner_id, pushUrl: "/dashboard/contratos",
          subject: ASSUNTOS.caucaoDevolucaoAtraso, ctaLabel: "Ver os contratos",
          body: (n) => `Olá${n ? " " + n : ""}, a devolução da caução de ${imovel} passou de 30 dias. Enquanto não for regularizada, você não consegue publicar anúncios novos.`,
        });
      }
    }
  }
  return resumo;
}
