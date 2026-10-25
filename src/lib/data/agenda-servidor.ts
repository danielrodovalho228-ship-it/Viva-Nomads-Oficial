import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvatarUrl } from "@/lib/data/avatar-actions";
import { primeiroNome } from "@/lib/calendario-estadias";
import type { ItemAgenda } from "@/lib/agenda";

/*
  Agenda do proprietário (prompt 23, item 5). Tudo filtrado pelo DONO logado no servidor: outro proprietário nunca
  vê nada daqui. Visitas (vídeo e presencial, sem as canceladas), entradas e saídas dos contratos ativos e as datas
  bloqueadas, de todos os imóveis. Nome curto e foto do inquilino SÓ depois do aceite (contrato ou candidatura
  aceita); antes disso a visita mostra só "Interessado(a)".
  AGENDA-A: a estadia também vem como período (faixa contínua na grade), o bloqueio traz a origem (o importado só
  a sincronia tira) e a visita traz os horários que as ações do dia precisam.
*/

export interface AgendaDoDono {
  itens: ItemAgenda[];
  imoveis: { id: string; titulo: string }[];
}

type LinhaVisita = {
  id: string;
  property_id: string;
  tenant_id: string;
  modalidade: string | null;
  status: string;
  horarios: string[] | null;
  horario_confirmado: string | null;
  horario_proposto: string | null;
};

export async function carregarAgendaDoDono(): Promise<AgendaDoDono> {
  const vazio: AgendaDoDono = { itens: [], imoveis: [] };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return vazio;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return vazio;

  const { data: props } = await admin.from("properties").select("id, title").eq("owner_id", user.id).order("created_at", { ascending: false });
  const imoveis = ((props ?? []) as { id: string; title: string | null }[]).map((p) => ({ id: p.id, titulo: p.title || "Imóvel" }));
  if (imoveis.length === 0) return vazio;
  const ids = imoveis.map((p) => p.id);
  const titulo = new Map(imoveis.map((p) => [p.id, p.titulo]));

  const [{ data: visitas }, { data: contratos }, { data: bloqueios }, { data: aceitas }] = await Promise.all([
    admin
      .from("visitas_video")
      .select("id, property_id, tenant_id, modalidade, status, horarios, horario_confirmado, horario_proposto")
      .eq("owner_id", user.id)
      .in("status", ["pedido", "remarcar", "confirmado", "feito"])
      .limit(500),
    admin.from("contratos").select("id, property_id, tenant_id, status, contrato_blocos(inicio, fim)").in("property_id", ids).eq("status", "ativo"),
    admin.from("property_blocks").select("id, property_id, inicio, fim, origem").in("property_id", ids),
    admin.from("leads").select("tenant_id, property_id").eq("owner_id", user.id).eq("status", "accepted"),
  ]);

  // Relação aceita (candidatura aceita ou contrato): só então nome curto e foto.
  const aceito = new Set<string>(((aceitas ?? []) as { tenant_id: string; property_id: string }[]).map((l) => `${l.tenant_id}_${l.property_id}`));
  for (const c of (contratos ?? []) as { tenant_id: string; property_id: string }[]) aceito.add(`${c.tenant_id}_${c.property_id}`);
  const pessoasComAceite = aceito;

  const tenantIds = [...new Set([...pessoasComAceite].map((k) => k.split("_")[0]))];
  const nomes = new Map<string, string>();
  if (tenantIds.length) {
    const { data: perfis } = await admin.from("profiles").select("id, full_name").in("id", tenantIds);
    for (const p of (perfis ?? []) as { id: string; full_name: string | null }[]) nomes.set(p.id, primeiroNome(p.full_name));
  }
  const fotos = new Map<string, string | null>();
  await Promise.all(
    [...pessoasComAceite].map(async (k) => {
      const [tenantId, propertyId] = k.split("_");
      fotos.set(k, (await getAvatarUrl({ targetId: tenantId, propertyId }).catch(() => ({ url: null }))).url ?? null);
    }),
  );
  const pessoa = (tenantId: string, propertyId: string) => {
    const k = `${tenantId}_${propertyId}`;
    return pessoasComAceite.has(k) ? { nome: nomes.get(tenantId) ?? "Inquilino", fotoUrl: fotos.get(k) ?? null } : null;
  };

  const itens: ItemAgenda[] = [];
  for (const v of (visitas ?? []) as LinhaVisita[]) {
    if (!titulo.has(v.property_id)) continue;
    const quando = v.horario_confirmado ?? (v.status === "remarcar" ? v.horario_proposto : null) ?? (v.horarios ?? [])[0];
    if (!quando) continue;
    itens.push({
      id: `visita-${v.id}`,
      tipo: "visita",
      propertyId: v.property_id,
      imovel: titulo.get(v.property_id)!,
      quando,
      modalidade: v.modalidade === "presencial" ? "presencial" : "video",
      status: v.status,
      pessoa: pessoa(v.tenant_id, v.property_id),
      href: `/dashboard/visitas#visita-${v.id}`,
      visita: { id: v.id, horarios: v.horarios ?? [], horarioConfirmado: v.horario_confirmado, horarioProposto: v.horario_proposto },
    });
  }
  for (const c of (contratos ?? []) as { id: string; property_id: string; tenant_id: string; contrato_blocos: { inicio: string; fim: string }[] | null }[]) {
    const blocos = (c.contrato_blocos ?? []).filter((b) => b?.inicio && b?.fim);
    if (!blocos.length) continue;
    const inicio = blocos.map((b) => b.inicio).sort()[0];
    const fim = blocos.map((b) => b.fim).sort().at(-1)!;
    const base = { propertyId: c.property_id, imovel: titulo.get(c.property_id) ?? "Imóvel", pessoa: pessoa(c.tenant_id, c.property_id), href: `/dashboard/contratos/${c.id}` };
    itens.push({ ...base, id: `estadia-${c.id}`, tipo: "estadia", quando: inicio, ate: fim });
    itens.push({ ...base, id: `entrada-${c.id}`, tipo: "entrada", quando: inicio });
    itens.push({ ...base, id: `saida-${c.id}`, tipo: "saida", quando: fim });
  }
  for (const b of (bloqueios ?? []) as { id: string; property_id: string; inicio: string; fim: string; origem?: string | null }[]) {
    itens.push({
      id: `bloqueio-${b.id}`,
      tipo: "bloqueio",
      propertyId: b.property_id,
      imovel: titulo.get(b.property_id) ?? "Imóvel",
      quando: b.inicio,
      ate: b.fim,
      origem: b.origem === "importado" ? "importado" : "manual",
      pessoa: null,
      href: null,
    });
  }
  return { itens, imoveis };
}
