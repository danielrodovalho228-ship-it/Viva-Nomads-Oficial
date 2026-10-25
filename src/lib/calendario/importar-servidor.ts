import "server-only";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { integracoesSimuladas } from "@/lib/integracoes";
import { periodosOcupados } from "@/lib/data/periodo-servidor";
import { periodoDaEstadia } from "@/lib/contrato-periodo";
import {
  LIMITE_BYTES_ICS,
  avisarFalha,
  causaDaFalha,
  conflitosComViva,
  lerIcs,
  planoDeSincronia,
  precisaLer,
  tipoDeCalendario,
  urlIcalPermitida,
  type BloqueioExterno,
  type OrigemLink,
} from "./importar";

/*
  Prompt 53 — importar calendário do Airbnb/Booking (SERVER-ONLY). Lê o .ics do link que o dono colou, guarda só as datas
  como bloqueios "importado" da própria importação, avisa o dono de conflito com compromisso da Viva (sem cancelar nada)
  e de 3 falhas seguidas (com a causa). O link nunca vai à tela nem a log.
  Laboratório: link em ical.lab.vivanomads.test vai à rota /api/lab/ical (arquivo escrito pelo teste), nunca à rede.
*/

type Admin = SupabaseClient;
export const HOST_LAB_ICAL = "ical.lab.vivanomads.test";

export interface Importacao {
  id: string;
  property_id: string;
  owner_id: string;
  url: string;
  origem: OrigemLink;
  ultima_leitura: string | null;
  falhas_seguidas: number;
}

export type Leitura = { ok: true; bloqueios: BloqueioExterno[] } | { ok: false; erro: string };

const hojeBrasilia = (agora: Date) => new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

/** No laboratório, o link de teste vira a rota local (o arquivo que o teste escreveu). Fora dele, null. */
function urlDoLaboratorio(url: string): string | null {
  if (!integracoesSimuladas()) return null;
  const u = new URL(url);
  if (u.hostname !== HOST_LAB_ICAL) return null;
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${base}/api/lab/ical/${encodeURIComponent(path.basename(u.pathname))}`;
}

/** Lê o corpo até o limite (nunca baixa mais que 1 MB). */
async function corpoLimitado(res: Response): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITE_BYTES_ICS) {
      await reader.cancel().catch(() => null);
      return null;
    }
    partes.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(partes));
}

/**
 * Busca o .ics: só https público (urlIcalPermitida), cada redirecionamento conferido de novo (nada de rede interna),
 * resposta text/calendar, até 1 MB. Devolve só datas.
 */
export async function lerLink(url: string): Promise<Leitura> {
  const valida = urlIcalPermitida(url);
  if (!valida.ok) return { ok: false, erro: valida.erro };
  let atual = valida.url;
  for (let salto = 0; salto < 4; salto++) {
    const destino = urlDoLaboratorio(atual) ?? atual;
    let res: Response;
    try {
      res = await fetch(destino, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { Accept: "text/calendar" } });
    } catch {
      return { ok: false, erro: "sem resposta" };
    }
    if (res.status >= 300 && res.status < 400) {
      const prox = res.headers.get("location");
      const ok = prox ? urlIcalPermitida(new URL(prox, atual).toString()) : null;
      if (!ok?.ok) return { ok: false, erro: "redirecionamento recusado" };
      atual = ok.url;
      continue;
    }
    if (!res.ok) return { ok: false, erro: `HTTP ${res.status}` };
    if (!tipoDeCalendario(res.headers.get("content-type"))) return { ok: false, erro: "a resposta não é um calendário (.ics)" };
    const texto = await corpoLimitado(res);
    if (texto === null) return { ok: false, erro: "O calendário é grande demais." };
    return lerIcs(texto);
  }
  return { ok: false, erro: "redirecionamentos demais" };
}

/** Compromissos da Viva no imóvel (datas): contrato vigente, proposta em andamento/aceita e candidatura com entrada. */
export async function compromissosDaViva(admin: Admin, propertyId: string): Promise<{ inicio: string; fim: string; tipo: string }[]> {
  const out: { inicio: string; fim: string; tipo: string }[] = [];
  for (const p of await periodosOcupados(admin, propertyId).catch(() => [])) out.push({ ...p, tipo: "contrato" });
  const { data: props } = await admin
    .from("propostas")
    .select("id, versao_atual, status")
    .eq("property_id", propertyId)
    .in("status", ["enviada", "vista", "contraproposta", "aceita", "em_contrato"]);
  for (const p of (props ?? []) as { id: string; versao_atual: number }[]) {
    const { data: v } = await admin.from("proposta_versoes").select("data_entrada, meses").eq("proposta_id", p.id).eq("versao", p.versao_atual).maybeSingle();
    const versao = v as { data_entrada: string | null; meses: number | null } | null;
    if (versao?.data_entrada && versao.meses) out.push({ ...periodoDaEstadia(versao.data_entrada, versao.meses), tipo: "proposta" });
  }
  const { data: leads } = await admin.from("leads").select("inicio_desejado").eq("property_id", propertyId).in("status", ["new", "accepted"]).not("inicio_desejado", "is", null);
  for (const l of (leads ?? []) as { inicio_desejado: string }[]) out.push({ ...periodoDaEstadia(l.inicio_desejado, 1), tipo: "candidatura" });
  return out;
}

async function avisarDono(admin: Admin, ownerId: string, evento: "calendario_conflito" | "calendario_falha", propertyId: string, detalhe?: string): Promise<void> {
  try {
    const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", ownerId).maybeSingle();
    const d = data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    await notify({
      event: evento,
      email: d?.notif_email === false ? undefined : (d?.email ?? undefined),
      name: d?.full_name ?? undefined,
      userId: ownerId,
      pushUrl: `/dashboard/imoveis/${propertyId}/editar#calendario`,
      detailsText: detalhe,
    });
  } catch {
    /* aviso é complemento */
  }
}

/** Grava a chave; false se o aviso desta chave já saiu (um aviso por conflito). */
async function primeiraVez(admin: Admin, chave: string, tipo: string): Promise<boolean> {
  const { error } = await admin.from("automacoes_envios").insert({ chave, tipo });
  return !error;
}

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

export interface ResultadoSincronia {
  ok: boolean;
  inseridos: number;
  removidos: number;
  conflitos: number;
  erro?: string;
}

/** Lê e sincroniza UMA importação. Nunca lança. */
export async function sincronizarImportacao(admin: Admin, imp: Importacao, agora: Date = new Date()): Promise<ResultadoSincronia> {
  const leitura = await lerLink(imp.url);
  if (!leitura.ok) {
    const falhas = (imp.falhas_seguidas ?? 0) + 1;
    const causa = causaDaFalha(leitura.erro, imp.origem);
    await admin.from("calendario_importacoes").update({ falhas_seguidas: falhas, ultimo_erro: causa.slice(0, 300) }).eq("id", imp.id);
    if (avisarFalha(falhas)) await avisarDono(admin, imp.owner_id, "calendario_falha", imp.property_id, causa);
    return { ok: false, inseridos: 0, removidos: 0, conflitos: 0, erro: causa };
  }
  const { data: atuais } = await admin.from("property_blocks").select("id, inicio, fim").eq("importacao_id", imp.id);
  const plano = planoDeSincronia(
    ((atuais ?? []) as { id: string; inicio: string; fim: string }[]).map((a) => ({ id: a.id, inicio: String(a.inicio), fim: String(a.fim) })),
    leitura.bloqueios,
    hojeBrasilia(agora),
  );
  if (plano.apagar.length) await admin.from("property_blocks").delete().in("id", plano.apagar).eq("importacao_id", imp.id);
  if (plano.inserir.length) {
    await admin
      .from("property_blocks")
      .insert(plano.inserir.map((b) => ({ property_id: imp.property_id, inicio: b.inicio, fim: b.fim, origem: "importado", importacao_id: imp.id })));
  }
  await admin.from("calendario_importacoes").update({ ultima_leitura: agora.toISOString(), ultimo_erro: null, falhas_seguidas: 0 }).eq("id", imp.id);

  // Conflito com compromisso da Viva: aviso ao dono (a decisão é dele), uma vez por data importada × compromisso.
  let conflitos = 0;
  const { data: vigentes } = await admin.from("property_blocks").select("inicio, fim").eq("importacao_id", imp.id);
  const importados = ((vigentes ?? []) as { inicio: string; fim: string }[]).map((b) => ({ inicio: String(b.inicio), fim: String(b.fim) }));
  const lista = conflitosComViva(importados, await compromissosDaViva(admin, imp.property_id).catch(() => []));
  for (const c of lista) {
    const chave = `cal_conflito:${imp.id}:${c.importado.inicio}:${c.importado.fim}:${c.compromisso.tipo}:${c.compromisso.inicio}`;
    if (await primeiraVez(admin, chave, "calendario_conflito")) {
      conflitos++;
      await avisarDono(
        admin,
        imp.owner_id,
        "calendario_conflito",
        imp.property_id,
        `Datas ocupadas no outro site: ${dataBR(c.importado.inicio)} a ${dataBR(c.importado.fim)}. Na Viva há ${c.compromisso.tipo === "contrato" ? "um contrato" : c.compromisso.tipo === "proposta" ? "uma proposta" : "uma candidatura"} de ${dataBR(c.compromisso.inicio)} a ${dataBR(c.compromisso.fim)}. Nada foi cancelado: decida qual vale.`,
      );
    }
  }
  return { ok: true, inseridos: plano.inserir.length, removidos: plano.apagar.length, conflitos };
}

const COLUNAS = "id, property_id, owner_id, url, origem, ultima_leitura, falhas_seguidas";

/** Cron: lê as importações ativas que passaram de 3 h (no máximo 200 por vez). */
export async function sincronizarTodas(admin: Admin, agora: Date = new Date()): Promise<{ lidas: number; falhas: number; conflitos: number }> {
  const { data, error } = await admin.from("calendario_importacoes").select(COLUNAS).eq("ativo", true).order("ultima_leitura", { ascending: true, nullsFirst: true }).limit(200);
  if (error) return { lidas: 0, falhas: 0, conflitos: 0 };
  let lidas = 0;
  let falhas = 0;
  let conflitos = 0;
  for (const imp of (data ?? []) as Importacao[]) {
    if (!precisaLer(imp.ultima_leitura, agora)) continue;
    const r = await sincronizarImportacao(admin, imp, agora);
    lidas++;
    if (!r.ok) falhas++;
    conflitos += r.conflitos;
  }
  return { lidas, falhas, conflitos };
}

export async function importacaoPorId(admin: Admin, id: string): Promise<Importacao | null> {
  const { data } = await admin.from("calendario_importacoes").select(COLUNAS).eq("id", id).maybeSingle();
  return (data as Importacao | null) ?? null;
}
