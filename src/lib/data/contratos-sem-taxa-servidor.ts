import "server-only";
/*
  E1205 (ORDEM-DUET-979 e 1012) — a leitura do contrato sem taxa reservada (servidor, cliente de serviço) e a rotina que
  avisa o dono. NÃO cobra nada e não escreve na reserva da taxa: só lê, põe o contrato na fila da Central (pela leitura
  de lerContratosSemTaxa, a mesma da rotina) e avisa o dono uma vez por contrato.
  A regra do desenho: um caso REAL encontrado aqui fica registado no log — a decisão vira (a reserva passa para dentro
  da ação do contrato, como item novo decidido pelo coordenador).
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { MINUTOS_SEM_TAXA, assuntoDoAvisoSemTaxa, contratosSemTaxa, corpoDoAvisoSemTaxa, hrefAssistenteDaEstadia, type ContratoSemTaxa } from "@/lib/fechamento/contratos-sem-taxa";
import { notify } from "@/lib/notifications";
import { gravarAviso } from "@/lib/notifications/avisos-servidor";

type Admin = SupabaseClient;
export type ContratoSemTaxaLido = ContratoSemTaxa & { numeroProposta: string | null; donoId: string | null; imovel: string };

/** Os contratos ATIVOS com proposta, sem a taxa reservada, há MINUTOS_SEM_TAXA ou mais (o status filtrado na consulta: a fonte única da rotina e da Central — ORDEM-DUET-1041). Leitura que falha LANÇA. */
export async function lerContratosSemTaxa(admin: Admin, agora: Date): Promise<ContratoSemTaxaLido[]> {
  const limite = new Date(agora.getTime() - MINUTOS_SEM_TAXA * 60_000).toISOString();
  const { data: cs, error } = await admin.from("contratos").select("id, lead_id, proposta_id, created_at, property_id, status").eq("status", "ativo").not("proposta_id", "is", null).lte("created_at", limite).limit(2000);
  if (error) throw new Error(`[E1205] contratos: ${error.message}`);
  const contratos = (cs ?? []) as { id: string; lead_id: string; proposta_id: string | null; created_at: string; property_id: string | null; status: string }[];
  if (!contratos.length) return [];
  const leads = [...new Set(contratos.map((c) => c.lead_id))];
  const { data: rs, error: eR } = await admin.from("cobrancas_fechamento").select("lead_id, tipo, proposta_id").in("lead_id", leads).eq("tipo", "comissao");
  if (eR) throw new Error(`[E1205] reservas: ${eR.message}`);
  const sem = contratosSemTaxa(contratos, (rs ?? []) as { lead_id: string; tipo: string; proposta_id: string | null }[], agora);
  if (!sem.length) return [];
  const imovelDe = new Map(contratos.map((c) => [c.id, c.property_id]));
  const [{ data: ps }, { data: ls }, { data: ims }] = await Promise.all([
    admin.from("propostas").select("id, numero").in("id", [...new Set(sem.map((c) => c.proposta_id))]),
    admin.from("leads").select("id, owner_id").in("id", [...new Set(sem.map((c) => c.lead_id))]),
    admin.from("properties").select("id, title").in("id", [...new Set(sem.map((c) => imovelDe.get(c.id)).filter((x): x is string => !!x))]),
  ]);
  const titulo = new Map(((ims ?? []) as { id: string; title: string | null }[]).map((p) => [p.id, p.title]));
  const numero = new Map(((ps ?? []) as { id: string; numero: string | null }[]).map((p) => [p.id, p.numero]));
  const dono = new Map(((ls ?? []) as { id: string; owner_id: string | null }[]).map((l) => [l.id, l.owner_id]));
  return sem.map((c) => ({ ...c, numeroProposta: numero.get(c.proposta_id) ?? null, donoId: dono.get(c.lead_id) ?? null, imovel: titulo.get(imovelDe.get(c.id) ?? "") || "o imóvel" }));
}

/** A rotina de hora em hora: avisa o dono de cada contrato sem taxa, uma vez por contrato. Não cobra nada. */
export async function avisarContratosSemTaxa(admin: Admin, agora: Date): Promise<{ encontrados: number; avisados: number; jaAvisados: number }> {
  const sem = await lerContratosSemTaxa(admin, agora);
  if (!sem.length) return { encontrados: 0, avisados: 0, jaAvisados: 0 };
  console.warn("[E1205] caso real de contrato sem taxa reservada:", sem.map((c) => c.id).join(", "));
  // Um aviso por contrato: o aviso já gravado no sino (em qualquer estado — lido, resolvido ou pendente) não se repete.
  const { data: ja, error } = await admin.from("avisos").select("ref_id").eq("evento", "contrato_sem_taxa").in("ref_id", sem.map((c) => c.id));
  if (error) throw new Error(`[E1205] avisos: ${error.message}`);
  const avisado = new Set(((ja ?? []) as { ref_id: string | null }[]).map((a) => a.ref_id));
  let avisados = 0;
  for (const c of sem) {
    if (avisado.has(c.id) || !c.donoId) continue;
    const { data } = await admin.from("profiles").select("email, full_name").eq("id", c.donoId).maybeSingle();
    const pf = data as { email?: string | null; full_name?: string | null } | null;
    if (!pf?.email) continue;
    // ORDEM-DUET-1017 §3: a âncora grava-se ANTES do e-mail. Se o e-mail falhar depois, o sino fica como o aviso deste
    // contrato e a hora seguinte não repete; sem âncora, nada sai agora (tenta na hora seguinte).
    const ancorado = await gravarAviso({ usuarioId: c.donoId, evento: "contrato_sem_taxa", papel: "dono", refId: c.id, url: hrefAssistenteDaEstadia(c.lead_id, c.proposta_id) });
    if (!ancorado) continue;
    await notify({
      event: "contrato_sem_taxa",
      email: pf.email,
      name: pf.full_name ?? undefined,
      userId: c.donoId,
      refId: c.id,
      papelAviso: "dono",
      pushUrl: hrefAssistenteDaEstadia(c.lead_id, c.proposta_id),
      subject: assuntoDoAvisoSemTaxa(c.imovel),
      body: corpoDoAvisoSemTaxa(c.id, c.numeroProposta),
    });
    avisados++;
  }
  return { encontrados: sem.length, avisados, jaAvisados: avisado.size };
}
