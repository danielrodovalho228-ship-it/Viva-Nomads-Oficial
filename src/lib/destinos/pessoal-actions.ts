"use server";

/*
  DESTINO-PESSOAL-B — ações do "Outro local" da busca.
  • buscarOutroLocal: o servidor acha o endereço (Nominatim do OSM e, sem resultado, Mapbox com token). Logada, a pessoa
    guarda o local em destinos_pessoais (só ela lê); sem login, nada é guardado: o ponto vai só na URL.
  • Não achou: "Não achamos este endereço." e a tela oferece "Não achei meu local" (nome do lugar + cidade), que vai
    para a fila do admin em /admin/destinos.
  • Laboratório: nada sai para a rede (pontoDoLaboratorio).
*/
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { consumirLimite, ipHash, DIA, HORA } from "@/lib/limites";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { geocodificarLugar } from "@/lib/proximidades/osm-servidor";
import {
  MAX_DESTINOS_PESSOAIS,
  MSG_NAO_ACHAMOS,
  consultaDoLocal,
  pontoDoLaboratorio,
  pontoGuardado,
  pontoValido,
  rotuloDoLocal,
  validarNaoAchei,
} from "./pessoal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LocalPessoal {
  id: string;
  rotulo: string;
  lat: number;
  lng: number;
}

export type ResultadoOutroLocal =
  | { ok: true; ponto: { lat: number; lng: number }; rotulo: string; guardado: boolean }
  | { ok: false; naoAchou: true; erro: string }
  | { ok: false; naoAchou?: false; erro: string };

async function sessao() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, uid: null as string | null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, uid: user?.id ?? null };
}

async function chaveDoPedido(uid: string | null): Promise<string> {
  if (uid) return `u:${uid}`;
  return `ip:${ipHash(new Request("http://viva.local", { headers: await headers() }))}`;
}

/** "Outro local": acha o endereço no servidor; logada, guarda para a pessoa. */
export async function buscarOutroLocal(texto: string, cidade: string, uf: string): Promise<ResultadoOutroLocal> {
  const q = consultaDoLocal(texto, cidade, uf);
  if (!q) return { ok: false, erro: "Digite o nome do lugar ou o endereço (pelo menos 3 letras)." };
  const { supabase, uid } = await sessao();
  if (!(await consumirLimite(`destino-pessoal:${await chaveDoPedido(uid)}`, 30, HORA))) {
    return { ok: false, erro: "Muitas buscas seguidas. Tente de novo daqui a pouco." };
  }
  let ponto: { lat: number; lng: number } | null;
  if (integracoesSimuladas()) {
    await registrarSimulado("osm", { acao: "destino-pessoal" });
    ponto = pontoDoLaboratorio(q.endereco);
  } else {
    const etapas: string[] = [];
    ponto = await geocodificarLugar(q.endereco, q.cidade, q.uf, etapas).catch(() => null);
    console.log(`[destino-pessoal] ${ponto ? "achou" : "nao_achou"} ${etapas.join(",")}`);
  }
  if (!ponto || !pontoValido(ponto)) return { ok: false, naoAchou: true, erro: MSG_NAO_ACHAMOS };

  const guardar = pontoGuardado(ponto);
  const rotulo = rotuloDoLocal(q.endereco);
  let guardado = false;
  if (uid && supabase) {
    const agora = new Date().toISOString();
    // Mesmo ponto já guardado: só atualiza o uso (o cliente da pessoa só pode mudar rótulo e uso — grant da 0240).
    const { data: ja } = await supabase.from("destinos_pessoais").select("id").eq("user_id", uid).eq("lat", guardar.lat).eq("lng", guardar.lng).maybeSingle();
    const { error } = ja
      ? await supabase.from("destinos_pessoais").update({ rotulo, usado_em: agora }).eq("id", ja.id)
      : await supabase.from("destinos_pessoais").insert({ user_id: uid, rotulo, lat: guardar.lat, lng: guardar.lng });
    if (error) console.error("[destino-pessoal] guardar", error.code, error.message);
    else {
      guardado = true;
      await podarAntigos(supabase, uid);
    }
  }
  return { ok: true, ponto: guardar, rotulo, guardado };
}

/** Mantém só os MAX_DESTINOS_PESSOAIS usados mais recentemente. */
async function podarAntigos(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, uid: string): Promise<void> {
  const { data } = await supabase.from("destinos_pessoais").select("id").eq("user_id", uid).order("usado_em", { ascending: false });
  const sobra = ((data ?? []) as { id: string }[]).slice(MAX_DESTINOS_PESSOAIS).map((r) => r.id);
  if (sobra.length) await supabase.from("destinos_pessoais").delete().in("id", sobra);
}

/** Os locais da pessoa logada (sem login, lista vazia). */
export async function meusLocais(): Promise<LocalPessoal[]> {
  const { supabase, uid } = await sessao();
  if (!supabase || !uid) return [];
  const { data } = await supabase.from("destinos_pessoais").select("id, rotulo, lat, lng").eq("user_id", uid).order("usado_em", { ascending: false }).limit(MAX_DESTINOS_PESSOAIS);
  return ((data ?? []) as LocalPessoal[]).map((l) => ({ ...l, lat: Number(l.lat), lng: Number(l.lng) }));
}

/** Escolheu um local guardado: conta como uso (o agregado do admin olha os últimos 90 dias). */
export async function usarLocal(id: string): Promise<void> {
  const { supabase, uid } = await sessao();
  if (!supabase || !uid || !UUID.test(id ?? "")) return;
  await supabase.from("destinos_pessoais").update({ usado_em: new Date().toISOString() }).eq("id", id).eq("user_id", uid);
}

export async function apagarLocal(id: string): Promise<{ ok: boolean }> {
  const { supabase, uid } = await sessao();
  if (!supabase || !uid || !UUID.test(id ?? "")) return { ok: false };
  const { error } = await supabase.from("destinos_pessoais").delete().eq("id", id).eq("user_id", uid);
  return { ok: !error };
}

/** "Não achei meu local": nome do lugar + cidade para a fila do admin. */
export async function pedirLocalNaoAchado(nome: string, cidade: string): Promise<{ ok: true; mensagem: string } | { ok: false; erro: string }> {
  const v = validarNaoAchei({ nome, cidade });
  if (!v.ok) return v;
  const { uid } = await sessao();
  if (!(await consumirLimite(`destino-nao-achei:${await chaveDoPedido(uid)}`, 5, DIA))) {
    return { ok: false, erro: "Você já mandou vários pedidos hoje. A equipe vai olhar." };
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, erro: "Não foi possível enviar agora." };
  const { error } = await admin.from("destinos_nao_achados").insert({ user_id: uid, nome: v.nome, cidade: v.cidade });
  if (error) {
    console.error("[destino-nao-achei]", error.code, error.message);
    return { ok: false, erro: "Não foi possível enviar agora." };
  }
  revalidatePath("/admin/destinos");
  return { ok: true, mensagem: `Pedido enviado: a equipe vai procurar "${v.nome}" em ${v.cidade}.` };
}

/** Admin: marca o pedido como resolvido (cadastrou a âncora ou não há o que fazer). */
export async function resolverLocalNaoAchado(id: string): Promise<{ ok: boolean; erro?: string }> {
  const { supabase, uid } = await sessao();
  const admin = createAdminClient();
  if (!supabase || !uid || !admin || !UUID.test(id ?? "")) return { ok: false, erro: "Sem permissão." };
  if (!(await ehAdmin(supabase, uid))) return { ok: false, erro: "Sem permissão." };
  const { error } = await admin.from("destinos_nao_achados").update({ resolvido_em: new Date().toISOString(), resolvido_por: uid }).eq("id", id).is("resolvido_em", null);
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  revalidatePath("/admin/destinos");
  return { ok: true };
}
