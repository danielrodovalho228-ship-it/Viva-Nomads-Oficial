"use server";

import { createClient } from "@/lib/supabase/server";
import { consumirLimite, DIA } from "@/lib/limites";
import { localComoBusca, normalizarLocal, type LocalTrabalho } from "@/lib/rotas/local-trabalho";
import { limparRotulo, pontoValido, type DestinoDaBusca } from "@/lib/rotas/destino-url";
import { ehModo } from "@/lib/rotas/tempo";

/*
  "Meu local de trabalho" (Prompt 37): privado, na própria linha de profiles (a RLS só deixa a pessoa ler e gravar a
  dela). Vira o destino padrão da busca, do alerta de busca e do pedido de moradia. Nunca aparece para o dono.
*/

type Cliente = NonNullable<Awaited<ReturnType<typeof createClient>>>;

async function sessao(): Promise<{ supabase: Cliente; userId: string } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

export interface LocalTrabalhoTela extends LocalTrabalho {
  /** Slug do destino cadastrado (quando é um), para a tela marcar o chip. */
  slug: string | null;
}

/** O local salvo da pessoa logada. null: sem sessão, sem local ou sem a migração. */
export async function meuLocalTrabalho(): Promise<LocalTrabalhoTela | null> {
  const s = await sessao();
  if (!s) return null;
  const { data, error } = await s.supabase.from("profiles").select("local_trabalho").eq("id", s.userId).maybeSingle();
  if (error) return null;
  const l = normalizarLocal((data as { local_trabalho?: unknown } | null)?.local_trabalho);
  if (!l) return null;
  let slug: string | null = null;
  if (l.destino_id) {
    const { data: d } = await s.supabase.from("destinos").select("slug").eq("id", l.destino_id).eq("ativo", true).maybeSingle();
    slug = (d?.slug as string | undefined) ?? null;
  }
  return { ...l, slug };
}

/** O local salvo como destino da busca (padrão quando a URL não traz destino). */
export async function meuLocalComoBusca(): Promise<DestinoDaBusca | null> {
  const l = await meuLocalTrabalho();
  return localComoBusca(l, () => l?.slug ?? null);
}

export type ResultadoLocal = { ok: true; local: LocalTrabalhoTela | null } | { ok: false; error: string };

/** Salva o local: um destino cadastrado (slug) OU um endereço escolhido nas sugestões (ponto + rótulo). */
export async function salvarLocalTrabalho(entrada: {
  destinoSlug?: string | null;
  ponto?: { lat: number; lng: number; rotulo: string } | null;
  modo: string;
}): Promise<ResultadoLocal> {
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre na sua conta para salvar o local de trabalho." };
  if (!(await consumirLimite(`local-trabalho:${s.userId}`, 30, DIA))) return { ok: false, error: "Muitas alterações hoje. Tente de novo amanhã." };
  const modo = ehModo(entrada.modo) ? entrada.modo : "carro";
  let bruto: Record<string, unknown> | null = null;
  let slug: string | null = null;
  if (entrada.destinoSlug) {
    const { data: d } = await s.supabase
      .from("destinos")
      .select("id, slug, nome, rotulo_curto, lat, lng")
      .eq("slug", String(entrada.destinoSlug).slice(0, 60))
      .eq("ativo", true)
      .maybeSingle();
    if (!d) return { ok: false, error: "Esse destino não está disponível. Escolha outro." };
    slug = d.slug as string;
    bruto = { destino_id: d.id, rotulo: (d.rotulo_curto as string | null) || d.nome, lat: d.lat, lng: d.lng, modo_preferido: modo };
  } else if (entrada.ponto && pontoValido(entrada.ponto.lat, entrada.ponto.lng)) {
    bruto = { rotulo: limparRotulo(entrada.ponto.rotulo) || "Local de trabalho", lat: entrada.ponto.lat, lng: entrada.ponto.lng, modo_preferido: modo };
  } else {
    return { ok: false, error: "Escolha um destino da lista ou um endereço das sugestões." };
  }
  const local = normalizarLocal(bruto);
  if (!local) return { ok: false, error: "Endereço inválido." };
  const { error } = await s.supabase.from("profiles").update({ local_trabalho: local }).eq("id", s.userId);
  if (error) return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  return { ok: true, local: { ...local, slug } };
}

export async function apagarLocalTrabalho(): Promise<ResultadoLocal> {
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre na sua conta." };
  const { error } = await s.supabase.from("profiles").update({ local_trabalho: null }).eq("id", s.userId);
  if (error) return { ok: false, error: "Não foi possível apagar agora. Tente de novo." };
  return { ok: true, local: null };
}

/** Destinos ativos para os chips (cadastro do perfil e do pedido). Leitura pública. */
export async function destinosParaEscolha(): Promise<{ slug: string; nome: string; rotulo: string; cidade: string; uf: string }[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("destinos").select("slug, nome, rotulo_curto, cidade, uf").eq("ativo", true).order("nome").limit(200);
  if (error) return [];
  return ((data ?? []) as { slug: string; nome: string; rotulo_curto: string | null; cidade: string; uf: string }[]).map((d) => ({
    slug: d.slug,
    nome: d.nome,
    rotulo: d.rotulo_curto || d.nome,
    cidade: d.cidade,
    uf: d.uf,
  }));
}
