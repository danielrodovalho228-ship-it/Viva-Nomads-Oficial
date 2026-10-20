import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { situacaoLimite, HORA } from "@/lib/limites";
import { isExemplo } from "@/lib/demo-listing";
import { hojeEmBrasilia } from "@/lib/checkin";
import { chaveCidade } from "@/lib/cidades";
import { configuracaoRotas, modosDisponiveis, provedorPara, ProvedorForaDoAr } from "@/lib/integrations/rotas";
import { artigoDoDestino, VALIDADE_CACHE_DIAS, type Modo } from "@/lib/rotas/tempo";
import { chaveDestino, chavePonto, limparRotulo, type DestinoDaBusca } from "@/lib/rotas/destino-url";
import { COORDENADAS_POR_CHAMADA, LOTES_POR_HORA, MAIS_PROXIMOS, emLotes, maisProximos, temCoordenada, type Ponto } from "@/lib/rotas/selecao";
import type { FonteTempo } from "@/lib/rotas/resposta";

/*
  Tempo de deslocamento no SERVIDOR (Prompt 37). A coordenada exata do imóvel só é lida aqui (cliente de serviço) e
  nunca sai: quem chama monta a resposta pública com montarResposta (minutos arredondados + linha reta aproximada).
  Cache em tempos_deslocamento por 30 dias; cálculo novo só para os 40 mais próximos e dentro do limite por IP.
*/

export interface Destino {
  id: string;
  slug: string;
  nome: string;
  rotulo_curto: string | null;
  tipo: "hospital" | "universidade" | "empresa" | "outro";
  cidade: string;
  uf: string;
  lat: number;
  lng: number;
  ativo: boolean;
}

export const COLUNAS_DESTINO = "id, slug, nome, rotulo_curto, tipo, cidade, uf, lat, lng, ativo";

/** Destino já resolvido para o cálculo. */
export interface DestinoResolvido {
  chave: string;
  ponto: Ponto;
  rotulo: string;
  artigo: "o" | "a" | null;
  destino?: Destino;
}

/** Destinos ATIVOS (leitura pública, RLS). [] sem banco ou sem a migração. */
export async function listarDestinosAtivos(): Promise<Destino[]> {
  const sb = createPublicClient();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from("destinos").select(COLUNAS_DESTINO).eq("ativo", true).order("nome").limit(200);
    if (error) return [];
    return (data ?? []) as Destino[];
  } catch {
    return [];
  }
}

export async function destinoAtivoPorSlug(slug: string): Promise<Destino | null> {
  const sb = createPublicClient();
  if (!sb || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  try {
    const { data } = await sb.from("destinos").select(COLUNAS_DESTINO).eq("slug", slug).eq("ativo", true).maybeSingle();
    return (data as Destino | null) ?? null;
  } catch {
    return null;
  }
}

export const rotuloDoDestino = (d: Pick<Destino, "nome" | "rotulo_curto">): string => (d.rotulo_curto?.trim() || d.nome).trim();

export function resolverCadastrado(d: Destino): DestinoResolvido {
  return { chave: chaveDestino(d.id), ponto: { lat: d.lat, lng: d.lng }, rotulo: rotuloDoDestino(d), artigo: artigoDoDestino(d.nome, d.tipo), destino: d };
}

/** Destino da busca → ponto + chave do cache + rótulo. null = destino desconhecido/inativo. */
export async function resolverDestino(d: DestinoDaBusca): Promise<DestinoResolvido | null> {
  if (d.slug) {
    const dest = await destinoAtivoPorSlug(d.slug);
    return dest ? resolverCadastrado(dest) : null;
  }
  if (d.ponto) {
    return { chave: chavePonto(d.ponto.lat, d.ponto.lng), ponto: { lat: d.ponto.lat, lng: d.ponto.lng }, rotulo: limparRotulo(d.ponto.rotulo) || "o endereço informado", artigo: null };
  }
  return null;
}

/** Os meios com dado de verdade agora. */
export function modosAtivos(): Modo[] {
  return modosDisponiveis(configuracaoRotas());
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export interface PontoImovel {
  id: string;
  lat: number;
  lng: number;
  city: string;
}

/** Coordenada EXATA dos imóveis ativos (cliente de serviço). Só ids reais; sem ponto fica de fora. */
export async function pontosExatos(admin: Admin, ids?: string[]): Promise<PontoImovel[]> {
  const reais = ids?.filter((id) => !isExemplo(id));
  if (ids && !reais?.length) return [];
  let q = admin.from("properties").select("id, lat, lng, city").eq("status", "active").limit(5000);
  if (reais) q = q.in("id", reais.slice(0, 1000));
  const { data, error } = await q;
  if (error) return [];
  return ((data ?? []) as { id: string; lat: number | null; lng: number | null; city: string | null }[])
    .filter((p) => temCoordenada(p))
    .map((p) => ({ id: p.id, lat: Number(p.lat), lng: Number(p.lng), city: p.city ?? "" }));
}

export interface ResultadoCalculo {
  /** Tempo EXATO por imóvel (fica no servidor). */
  tempos: Map<string, { minutos: number; metros: number } | null>;
  fonte: FonteTempo;
  pendentes: Set<string>;
  /** Pares calculados agora no provedor (para os testes e o log). */
  novos: number;
}

/**
 * Lê o cache e calcula o que falta para os `maxNovos` mais próximos (linha reta). Provedor fora ou sem token →
 * fonte "linha_reta" (nunca minuto inventado, nada gravado). Limite por IP estourado → fonte "limite".
 * `chaveLimite` null = sem limite por IP (cron e páginas do servidor).
 */
export async function calcularTempos(o: {
  admin: Admin;
  destino: DestinoResolvido;
  modo: Modo;
  imoveis: PontoImovel[];
  chaveLimite: string | null;
  maxNovos?: number;
  /** Só lê o cache (sem chamar o provedor). */
  soCache?: boolean;
}): Promise<ResultadoCalculo> {
  const tempos = new Map<string, { minutos: number; metros: number } | null>();
  const pendentes = new Set<string>();
  if (o.imoveis.length === 0) return { tempos, fonte: "rotas", pendentes, novos: 0 };
  const desde = new Date(Date.now() - VALIDADE_CACHE_DIAS * 86_400_000).toISOString();
  for (const lote of emLotes(o.imoveis.map((p) => p.id), 300)) {
    const { data } = await o.admin
      .from("tempos_deslocamento")
      .select("property_id, minutos, metros")
      .eq("destino_chave", o.destino.chave)
      .eq("modo", o.modo)
      .gte("calculado_em", desde)
      .in("property_id", lote);
    for (const r of (data ?? []) as { property_id: string; minutos: number; metros: number }[]) tempos.set(r.property_id, { minutos: r.minutos, metros: r.metros });
  }
  const faltam = o.imoveis.filter((p) => !tempos.has(p.id));
  if (!faltam.length) return { tempos, fonte: "rotas", pendentes, novos: 0 };
  if (o.soCache) return { tempos, fonte: "rotas", pendentes: new Set(faltam.map((p) => p.id)), novos: 0 };
  const provedor = provedorPara(o.modo);
  if (!provedor) return { tempos, fonte: "linha_reta", pendentes, novos: 0 };

  const escolhidos = maisProximos(faltam, o.destino.ponto, o.maxNovos ?? MAIS_PROXIMOS);
  const escolhidosIds = new Set(escolhidos.map((p) => p.id));
  for (const p of faltam) if (!escolhidosIds.has(p.id)) pendentes.add(p.id);
  let fonte: FonteTempo = "rotas";
  let novos = 0;
  for (const lote of emLotes(escolhidos, COORDENADAS_POR_CHAMADA - 1)) {
    if (o.chaveLimite && (await situacaoLimite(o.chaveLimite, LOTES_POR_HORA, HORA)) === "estourou") {
      fonte = "limite";
      break;
    }
    let r: ({ minutos: number; metros: number } | null)[];
    try {
      r = await provedor.calcular(o.destino.ponto, lote, o.modo);
    } catch (e) {
      if (!(e instanceof ProvedorForaDoAr)) console.error("[tempos] falha inesperada:", e instanceof Error ? e.message : e);
      fonte = "linha_reta";
      break;
    }
    const linhas: { property_id: string; destino_chave: string; modo: Modo; minutos: number; metros: number; calculado_em: string }[] = [];
    lote.forEach((p, i) => {
      const t = r[i];
      if (!t) return;
      tempos.set(p.id, t);
      linhas.push({ property_id: p.id, destino_chave: o.destino.chave, modo: o.modo, minutos: Math.max(0, Math.min(1440, Math.round(t.minutos))), metros: Math.max(0, Math.min(1_000_000, t.metros)), calculado_em: new Date().toISOString() });
    });
    novos += lote.length;
    if (linhas.length) {
      const { error } = await o.admin.from("tempos_deslocamento").upsert(linhas, { onConflict: "property_id,destino_chave,modo" });
      if (error) console.error("[tempos] cache não gravado:", error.message);
    }
  }
  return { tempos, fonte, pendentes, novos };
}

/** +1 busca no destino cadastrado (só a contagem do dia; sem quem buscou). Best-effort. */
export async function contarBuscaDestino(admin: Admin, destinoId: string): Promise<void> {
  try {
    await admin.rpc("contar_busca_destino", { p_destino: destinoId, p_dia: hojeEmBrasilia(new Date()) });
  } catch {
    /* contagem nunca quebra a busca */
  }
}

/**
 * Cron diário (/api/cron/automacoes): pré-calcula, para cada destino ativo e cada meio com dado, os imóveis ativos
 * da MESMA cidade que faltam no cache ou têm mais de 30 dias. Teto por execução para o custo não fugir.
 */
export async function precalcularTempos(admin: Admin, tetoPares = 2400): Promise<{ destinos: number; pares: number; fonte: FonteTempo }> {
  const { data } = await admin.from("destinos").select(COLUNAS_DESTINO).eq("ativo", true).limit(200);
  const destinos = (data ?? []) as Destino[];
  const imoveis = await pontosExatos(admin);
  let pares = 0;
  let fonte: FonteTempo = "rotas";
  for (const d of destinos) {
    const daCidade = imoveis.filter((p) => chaveCidade(p.city) === chaveCidade(d.cidade));
    for (const modo of modosAtivos()) {
      if (pares >= tetoPares) return { destinos: destinos.length, pares, fonte };
      const r = await calcularTempos({ admin, destino: resolverCadastrado(d), modo, imoveis: daCidade, chaveLimite: null, maxNovos: Math.min(daCidade.length, tetoPares - pares) });
      pares += r.novos;
      if (r.fonte !== "rotas") fonte = r.fonte;
    }
  }
  return { destinos: destinos.length, pares, fonte };
}
