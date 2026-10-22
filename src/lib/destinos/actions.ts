"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessaoAal2 } from "@/lib/data/admin-guard";
import { chaveGoogle } from "@/lib/integrations/chave-google";
import { UBERLANDIA_CENTER } from "@/lib/integrations/geocoding";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { SITE_URL, SUPORTE_EMAIL } from "@/lib/site";
import { validarDestino } from "./regras";
import { consultaDoPonto, pontosDoGoogle, pontosDoOsm, type PontoSugerido } from "./ponto";

export type ResultadoDestino = { ok: boolean; erro?: string; mensagem?: string };

async function exigirAdmin() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!(perfil?.role === "admin" && (await sessaoAal2(supabase)))) return null;
  // Grava com o cliente de serviço DEPOIS do portão do admin (papel + 2 etapas pela regra do app), como as outras telas
  // do /admin. Com o cliente da sessão, a RLS (is_admin() exige aal2 quando a conta tem fator) recusava o admin que o
  // app já deixou entrar: "new row violates row-level security policy" → "Não foi possível salvar." (22/10).
  return { db: createAdminClient() ?? supabase, userId: user.id };
}

const aposMudar = (slug?: string) => {
  revalidatePath("/admin/destinos");
  revalidatePath("/buscar");
  if (slug) revalidatePath(`/imoveis-perto-de/${slug}`);
};

/** Admin: cadastra ou corrige um destino (pelo endereço da página). Sem ponto, fica inativo. */
export async function salvarDestino(_: ResultadoDestino | null, form: FormData): Promise<ResultadoDestino> {
  const adm = await exigirAdmin();
  if (!adm) return { ok: false, erro: "Sem permissão." };
  const v = validarDestino(Object.fromEntries(form.entries()));
  if (!v.ok) return { ok: false, erro: v.erro };
  const d = v.destino;
  const { data: existente } = await adm.db.from("destinos").select("id, ativo").eq("slug", d.slug).maybeSingle();
  const semPonto = d.lat == null || d.lng == null;
  const linha = { nome: d.nome, artigo: d.artigo, tipo: d.tipo, cidade: d.cidade, uf: d.uf, lat: d.lat, lng: d.lng };
  const { error } = existente
    ? await adm.db.from("destinos").update({ ...linha, ...(semPonto ? { ativo: false } : {}) }).eq("id", existente.id)
    : await adm.db.from("destinos").insert({ ...linha, slug: d.slug, ativo: false, criado_por: adm.userId });
  if (error) {
    console.error("[salvarDestino]", error.code, error.message);
    return { ok: false, erro: error.code === "23505" ? "Já existe um destino com esse nome." : "Não foi possível salvar." };
  }
  aposMudar(d.slug);
  return { ok: true, mensagem: semPonto ? `${d.nome} salvo sem ponto: confira no mapa para poder ativar.` : `${d.nome} salvo. Ative quando conferir o ponto no mapa.` };
}

/** Admin: ativa ou desativa (ativar exige ponto — o banco também recusa). */
export async function alternarDestino(id: string, ativar: boolean): Promise<ResultadoDestino> {
  const adm = await exigirAdmin();
  if (!adm) return { ok: false, erro: "Sem permissão." };
  if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, erro: "Destino inválido." };
  const { data, error } = await adm.db.from("destinos").update({ ativo: Boolean(ativar) }).eq("id", id).select("slug");
  if (error) {
    console.error("[alternarDestino]", error.code, error.message);
    return { ok: false, erro: ativar ? "Confira o ponto no mapa antes de ativar." : "Não foi possível atualizar." };
  }
  aposMudar((data?.[0] as { slug?: string } | undefined)?.slug);
  return { ok: true };
}

// ── Busca do ponto no mapa (só admin, só servidor) ──────────────────────────────────────────────────────────────
// Google Places (Text Search) quando há chave; senão o Nominatim do OpenStreetMap, sem custo, com a política de uso
// do OSM (User-Agent da Viva com e-mail de contato, no máximo 1 pedido por segundo). Só o texto digitado sai daqui.
const USER_AGENT = `VivaNomads/1.0 (+${SITE_URL}; ${SUPORTE_EMAIL})`;
let proximoSlotOsm = 0;
async function aguardarVezOsm(): Promise<void> {
  const agora = Date.now();
  const espera = Math.max(0, proximoSlotOsm - agora);
  proximoSlotOsm = Math.max(agora, proximoSlotOsm) + 1000;
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
}

export type ResultadoBuscaPonto = { ok: true; itens: PontoSugerido[]; fonte: "google" | "osm" | "laboratorio" } | { ok: false; erro: string };

export async function buscarPontoDestino(q: string, cidade: string, uf: string): Promise<ResultadoBuscaPonto> {
  if (!(await exigirAdmin())) return { ok: false, erro: "Sem permissão." };
  if (String(q ?? "").trim().length < 3) return { ok: false, erro: "Digite pelo menos 3 letras do nome ou do endereço." };
  const consulta = consultaDoPonto(String(q), String(cidade ?? ""), String(uf ?? ""));
  if (integracoesSimuladas()) {
    await registrarSimulado("destinos-busca-ponto", { consulta });
    return { ok: true, fonte: "laboratorio", itens: [{ id: "lab:1", rotulo: `${consulta} (laboratório)`, ...UBERLANDIA_CENTER }] };
  }
  const chave = chaveGoogle();
  try {
    if (chave) {
      const p = new URLSearchParams({ query: consulta, key: chave, language: "pt-BR", region: "br" });
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${p}`, { signal: AbortSignal.timeout(8000) });
      const itens = r.ok ? pontosDoGoogle(await r.json()) : [];
      if (itens.length) return { ok: true, fonte: "google", itens };
    }
    await aguardarVezOsm();
    const p = new URLSearchParams({ q: consulta, format: "jsonv2", limit: "5", countrycodes: "br", "accept-language": "pt-BR" });
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, erro: "A busca no mapa não respondeu agora. Tente de novo ou cole a latitude e a longitude." };
    return { ok: true, fonte: "osm", itens: pontosDoOsm(await r.json()) };
  } catch (e) {
    console.error("[buscarPontoDestino]", e);
    return { ok: false, erro: "A busca no mapa não respondeu agora. Tente de novo ou cole a latitude e a longitude." };
  }
}
