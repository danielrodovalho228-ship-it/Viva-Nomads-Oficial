/**
 * Tempo até o trabalho (prompt 37) — dados no servidor. SERVER-ONLY (sem "use server": chamado pelas rotas e pelo cron).
 *
 * • O tempo é calculado com o ponto EXATO do imóvel (lat_exata/lng_exata, só o servidor lê) e guardado no cache
 *   tempos_deslocamento por 30 dias. À tela vai só o texto arredondado ("~15 min de carro até o HC-UFU") e os minutos
 *   arredondados para o filtro — nunca coordenada nem metros.
 * • Endereço digitado: os 40 mais próximos em linha reta vão à Matrix; o resto mostra a linha reta.
 * • Limite: 300 cálculos novos por hora por IP (em unidades de 10). Acima disso, ou sem provedor, linha reta medida
 *   sobre o ponto PÚBLICO (aproximado) e dita como tal — nunca minutos inventados.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularTempos, modosDisponiveis, provedorDisponivel, ProvedorRotasIndisponivel } from "@/lib/integrations/rotas";
import {
  CALCULOS_POR_HORA_POR_IP,
  CANDIDATOS_POR_ENDERECO,
  VALIDADE_CACHE_DIAS,
  chaveDestino,
  comArtigo,
  escolherCandidatos,
  metrosEntre,
  minutosArredondados,
  pontoDaUrl,
  rotuloLimpo,
  rotuloReta,
  rotuloTempo,
  type ModoRota,
  type Ponto,
} from "@/lib/rotas/tempo";
import { situacaoLimite, HORA } from "@/lib/limites";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Destino cadastrado: o cálculo sob demanda vai em até 2 lotes por pedido; o resto chega no próximo (a tela repete). */
const NOVOS_POR_PEDIDO_DESTINO = 48;
const UNIDADE_LIMITE = 10;

export interface DestinoPublico {
  id: string;
  slug: string;
  nome: string;
  artigo: "o" | "a" | "";
  tipo: "hospital" | "universidade" | "empresa" | "outro";
  cidade: string;
  uf: string;
}

export interface DestinoResolvido {
  chave: string;
  ponto: Ponto;
  /** Com artigo: "o HC-UFU"; endereço digitado: "Av. Pará, Umuarama". */
  rotulo: string;
  destinoId?: string;
  slug?: string;
}

export interface TempoNaTela {
  id: string;
  texto: string;
  /** Minutos arredondados (múltiplo de 5; 0 = menos de 5). null = sem tempo de rota (linha reta). */
  min: number | null;
}

export async function destinosAtivos(admin: Admin | null = createAdminClient()): Promise<DestinoPublico[]> {
  if (!admin) return [];
  const { data, error } = await admin
    .from("destinos")
    .select("id, slug, nome, artigo, tipo, cidade, uf")
    .eq("ativo", true)
    .order("nome");
  if (error) {
    console.error("[destinos]", error.message);
    return [];
  }
  return (data ?? []) as DestinoPublico[];
}

/** Destino da busca a partir da URL: ?destino=<slug> ou ?dlat=&dlng=&drot= (ponto com 2 casas). */
export async function resolverDestino(
  q: { destino?: string | null; dlat?: string | null; dlng?: string | null; drot?: string | null },
  admin: Admin | null = createAdminClient(),
): Promise<DestinoResolvido | null> {
  if (q.destino && /^[a-z0-9-]{2,60}$/.test(q.destino)) {
    if (!admin) return null;
    const { data } = await admin.from("destinos").select("id, slug, nome, artigo, lat, lng").eq("slug", q.destino).eq("ativo", true).maybeSingle();
    if (!data || data.lat == null || data.lng == null) return null;
    return {
      chave: chaveDestino({ destinoId: data.id as string }),
      ponto: { lat: Number(data.lat), lng: Number(data.lng) },
      rotulo: comArtigo(data.nome as string, data.artigo as "o" | "a" | ""),
      destinoId: data.id as string,
      slug: data.slug as string,
    };
  }
  const ponto = pontoDaUrl(q.dlat, q.dlng);
  if (!ponto) return null;
  const rotulo = rotuloLimpo(q.drot ?? "") || "o endereço informado";
  return { chave: chaveDestino(ponto), ponto, rotulo };
}

interface LinhaImovel {
  id: string;
  lat: number | null;
  lng: number | null;
  lat_exata: number | null;
  lng_exata: number | null;
}

async function imoveisAtivos(admin: Admin, ids?: string[]): Promise<LinhaImovel[]> {
  let q = admin.from("properties").select("id, lat, lng, lat_exata, lng_exata").eq("status", "active").not("lat_exata", "is", null);
  if (ids) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) {
    console.error("[tempos] imóveis:", error.message);
    return [];
  }
  return (data ?? []) as LinhaImovel[];
}

interface LinhaCache {
  property_id: string;
  minutos: number | null;
  calculado_em: string;
}

async function lerCache(admin: Admin, chave: string, modo: ModoRota, ids?: string[]): Promise<Map<string, LinhaCache>> {
  const desde = new Date(Date.now() - VALIDADE_CACHE_DIAS * 86_400_000).toISOString();
  let q = admin.from("tempos_deslocamento").select("property_id, minutos, calculado_em").eq("destino_chave", chave).eq("modo", modo).gte("calculado_em", desde);
  if (ids) q = q.in("property_id", ids);
  const { data } = await q;
  return new Map(((data ?? []) as LinhaCache[]).map((l) => [l.property_id, { ...l, minutos: l.minutos == null ? null : Number(l.minutos) }]));
}

/** Consome o limite do IP para n cálculos novos (unidades de 10). false = estourou: fica na linha reta. */
async function cabeNoLimite(ip: string, n: number): Promise<boolean> {
  for (let i = 0; i < Math.ceil(n / UNIDADE_LIMITE); i++) {
    const s = await situacaoLimite(`rotas:ip:${ip}`, CALCULOS_POR_HORA_POR_IP / UNIDADE_LIMITE, HORA);
    if (s !== "ok") return false;
  }
  return true;
}

/**
 * Calcula (no provedor) e grava no cache os tempos que faltam. Devolve quantos calculou; 0 sem provedor ou com falha.
 * Usado pela busca (sob demanda, com limite por IP) e pelo cron (sem limite).
 */
export async function calcularFaltantes(
  admin: Admin,
  destino: DestinoResolvido,
  modo: ModoRota,
  faltam: LinhaImovel[],
  opcoes: { ip?: string | null; max: number },
): Promise<number> {
  if (faltam.length === 0 || !provedorDisponivel(modo)) return 0;
  const origens = escolherCandidatos(
    faltam.map((p) => ({ id: p.id, lat: Number(p.lat_exata), lng: Number(p.lng_exata) })),
    destino.ponto,
    opcoes.max,
  );
  if (opcoes.ip && !(await cabeNoLimite(opcoes.ip, origens.length))) return 0;
  try {
    const tempos = await calcularTempos(origens, destino.ponto, modo);
    const agora = new Date().toISOString();
    const { error } = await admin.from("tempos_deslocamento").upsert(
      tempos.map((t) => ({ property_id: t.id, destino_chave: destino.chave, modo, minutos: t.minutos, metros: t.metros, calculado_em: agora })),
      { onConflict: "property_id,destino_chave,modo" },
    );
    if (error) console.error("[tempos] cache:", error.message);
    return tempos.length;
  } catch (e) {
    if (!(e instanceof ProvedorRotasIndisponivel)) console.error("[tempos] provedor:", e);
    return 0;
  }
}

/**
 * Tempos até o destino para a tela. `ids` limita aos imóveis da lista (até 400). `calculando` = ainda há imóvel sem
 * tempo que o próximo pedido calcula (destino cadastrado com muitos novos de uma vez).
 */
export async function temposAte(
  destino: DestinoResolvido,
  modo: ModoRota,
  opcoes: { ids?: string[]; ip?: string | null } = {},
  admin: Admin | null = createAdminClient(),
): Promise<{ itens: TempoNaTela[]; calculando: boolean; reta: boolean }> {
  if (!admin) return { itens: [], calculando: false, reta: true };
  const ids = opcoes.ids?.filter((id) => UUID.test(id)).slice(0, 400);
  const imoveis = await imoveisAtivos(admin, ids);
  let cache = await lerCache(admin, destino.chave, modo, ids);
  const faltam = imoveis.filter((p) => !cache.has(p.id));

  let calculando = false;
  if (faltam.length) {
    const max = destino.destinoId ? NOVOS_POR_PEDIDO_DESTINO : CANDIDATOS_POR_ENDERECO;
    const feitos = await calcularFaltantes(admin, destino, modo, faltam, { ip: opcoes.ip, max });
    if (feitos) {
      cache = await lerCache(admin, destino.chave, modo, ids);
      calculando = Boolean(destino.destinoId) && feitos === max && imoveis.some((p) => !cache.has(p.id));
    }
  }

  const itens: TempoNaTela[] = [];
  for (const p of imoveis) {
    const c = cache.get(p.id);
    if (c && c.minutos != null) {
      itens.push({ id: p.id, texto: rotuloTempo({ minutos: c.minutos, modo, destinoRotulo: destino.rotulo }), min: minutosArredondados(c.minutos) ?? 0 });
    } else if (c && modo === "onibus") {
      continue; // sem linha de ônibus: o meio não aparece para este imóvel
    } else if (modo !== "onibus" && p.lat != null && p.lng != null) {
      // Linha reta sobre o ponto PÚBLICO (aproximado), arredondada a 100 m.
      itens.push({ id: p.id, texto: rotuloReta(metrosEntre({ lat: Number(p.lat), lng: Number(p.lng) }, destino.ponto), destino.rotulo), min: null });
    }
  }
  return { itens, calculando, reta: itens.length > 0 && itens.every((i) => i.min == null) };
}

/** Conta a busca por destino cadastrado (só a contagem do dia; sem endereço nem quem buscou). */
export async function contarBuscaDestino(destinoId: string, admin: Admin | null = createAdminClient()): Promise<void> {
  if (!admin) return;
  const { error } = await admin.rpc("registrar_busca_destino", { p_destino: destinoId });
  if (error) console.error("[destinos] contagem:", error.message);
}

/** Pré-cálculo do cron diário: por destino ativo × meio, os pares que faltam ou passaram de 30 dias. */
const PRECALCULO_MAX_POR_DESTINO = 240;

export async function precalcularTempos(admin: Admin, simular: boolean): Promise<{ temposCalculados: number; temposFaltando: number }> {
  const { data: dests } = await admin.from("destinos").select("id, slug, nome, artigo, cidade, lat, lng").eq("ativo", true);
  // Pedidos de moradia com destino: o "até N min" da compatibilidade precisa do tempo no cache.
  const { data: peds } = await admin.from("pedidos_moradia").select("cidade, destino").eq("status", "ativo").not("destino", "is", null);
  const alvos: { destino: DestinoResolvido; cidade: string; modos: ModoRota[] }[] = [];
  for (const d of (dests ?? []) as { id: string; slug: string; nome: string; artigo: "o" | "a" | ""; cidade: string; lat: number | null; lng: number | null }[]) {
    if (d.lat == null || d.lng == null) continue;
    alvos.push({
      destino: { chave: chaveDestino({ destinoId: d.id }), ponto: { lat: Number(d.lat), lng: Number(d.lng) }, rotulo: comArtigo(d.nome, d.artigo), destinoId: d.id, slug: d.slug },
      cidade: d.cidade,
      modos: modosDisponiveis(),
    });
  }
  for (const p of (peds ?? []) as { cidade: string; destino: { destino_id?: string; lat: number; lng: number; rotulo: string; modo_preferido?: string } }[]) {
    if (p.destino.destino_id) continue; // destino cadastrado já entra acima
    const ponto = { lat: Number(p.destino.lat), lng: Number(p.destino.lng) };
    const modo = (p.destino.modo_preferido ?? "carro") as ModoRota;
    alvos.push({ destino: { chave: chaveDestino(ponto), ponto, rotulo: p.destino.rotulo }, cidade: p.cidade, modos: [modo] });
  }

  let temposCalculados = 0;
  let temposFaltando = 0;
  const imoveis = await imoveisAtivos(admin);
  const { data: cidades } = await admin.from("properties").select("id, city").eq("status", "active");
  const cidadeDe = new Map(((cidades ?? []) as { id: string; city: string | null }[]).map((c) => [c.id, (c.city ?? "").toLocaleLowerCase("pt-BR")]));
  for (const a of alvos) {
    const daCidade = imoveis.filter((p) => cidadeDe.get(p.id) === a.cidade.toLocaleLowerCase("pt-BR"));
    for (const modo of a.modos) {
      const cache = await lerCache(admin, a.destino.chave, modo, daCidade.map((p) => p.id));
      const faltam = daCidade.filter((p) => !cache.has(p.id));
      temposFaltando += faltam.length;
      if (!simular) temposCalculados += await calcularFaltantes(admin, a.destino, modo, faltam, { max: PRECALCULO_MAX_POR_DESTINO });
    }
  }
  return { temposCalculados, temposFaltando };
}
