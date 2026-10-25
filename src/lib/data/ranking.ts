import "server-only";
import { niveisDosImoveis, vistoriadosDosImoveis } from "@/lib/niveis/servidor";
import { createAdminClient } from "@/lib/supabase/admin";
import { estadosIdentidade } from "@/lib/identidade/estado-servidor";
import { CHAVE_ORDEM_NOVA, gravarSombra, ordemNovaLigada } from "@/lib/ranking/chave";
import { sinaisDaLinha, type LinhaRankingSinais } from "@/lib/ranking/sinais";
import type { SinaisAnuncio } from "@/lib/ranking/ordem";
import { boaParaVideochamada, sinalMorador, type Rodada } from "@/lib/internet-medida";
import { procedentes12m, pendenciaVencida, type PendenciaConforto } from "@/lib/conforto/regras";
import { foraDoPrazo90d, type OrdemSolucao } from "@/lib/manutencao-solucao";
import { considerarPreenchido } from "@/lib/anuncio/chegada-e-pedido";

/*
  Servidor da ordem dos imóveis (Prompt 33, itens 4 e 5). Nunca importe em componente client:
  os sinais têm campos restritos (matrícula, CAF). O que sai daqui para a tela é nota, selo e motivo.
*/

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sinais de vários anúncios: UMA chamada a ranking_sinais (0196) + a identidade dos donos em lote.
 * Ids que não são uuid (anúncios de exemplo) ficam fora — quem chama monta os de exemplo à parte.
 * Sem cliente de serviço ou sem a migração: lista vazia (a ordem antiga continua valendo).
 */
export async function sinaisDosAnuncios(ids: string[], admin: Admin | null = createAdminClient()): Promise<SinaisAnuncio[]> {
  const reais = [...new Set(ids.filter((id) => UUID.test(id)))];
  if (!admin || reais.length === 0) return [];
  const { data, error } = await admin.rpc("ranking_sinais", { p_ids: reais });
  if (error || !data) {
    if (error) console.error("[ranking_sinais]", error.code, error.message);
    return [];
  }
  const linhas = data as LinhaRankingSinais[];
  const donos = [...new Set(linhas.map((l) => l.dono_id))];
  const [identidades, internet, prazos, niveis, vistoriados, considerar] = await Promise.all([
    estadosIdentidade(admin, donos),
    internetDosAnuncios(admin, reais),
    prazos59(admin, reais, donos),
    niveisDosImoveis(admin, reais).catch(() => new Map()), // sem a 0211, a nota segue sem o nível
    vistoriadosDosImoveis(admin, reais).catch(() => new Set<string>()),
    considerarDosAnuncios(admin, reais),
  ]);
  return linhas.map((l) =>
    sinaisDaLinha(l, {
      identidadeConfirmada: identidades.get(l.dono_id)?.estado === "confirmada",
      ...(internet.get(l.id) ?? {}),
      confortoProcedentes12m: prazos.procedentes.get(l.id) ?? 0,
      manutencaoFora90d: prazos.fora90d.get(l.dono_id) ?? 0,
      confortoPendenciasAbertas: prazos.abertas.get(l.id) ?? 0,
      nivel: niveis.get(l.id) ?? null,
      vistoriado: vistoriados.has(l.id),
      considerarAntes: considerar.has(l.id),
    }),
  );
}

/** 61-B: anúncios com "o que considerar antes de pedir" preenchido. Sem a 0225, nenhum (a nota segue sem o fato). */
async function considerarDosAnuncios(admin: Admin, ids: string[]): Promise<Set<string>> {
  const { data, error } = await admin.from("properties").select("id, considerar_antes, considerar_antes_texto").in("id", ids);
  if (error || !data) return new Set();
  const linhas = data as { id: string; considerar_antes: string[] | null; considerar_antes_texto: string | null }[];
  return new Set(linhas.filter((l) => considerarPreenchido({ itens: l.considerar_antes, texto: l.considerar_antes_texto })).map((l) => l.id));
}

/**
 * Prompt 57: etiqueta "Para trabalhar de casa" com internet MEDIDA (última medição validada do dono, vigente, que passa
 * a regra de videochamada) ou só informada; e o sinal do morador (última medição validada dele abaixo de 50% da do dono).
 * Sem a migração 0205, nada muda.
 */
async function internetDosAnuncios(admin: Admin, ids: string[]): Promise<Map<string, { homeOffice: "medido" | "informado" | null; internetAbaixoMorador: boolean }>> {
  const r = new Map<string, { homeOffice: "medido" | "informado" | null; internetAbaixoMorador: boolean }>();
  try {
    const agora = new Date().toISOString();
    const [{ data: tags }, { data: meds }] = await Promise.all([
      admin.from("properties").select("id, tag_home_office").in("id", ids),
      admin
        .from("internet_medicoes")
        .select("property_id, papel, download_mbps, upload_mbps, latencia_ms, medido_em")
        .in("property_id", ids)
        .eq("validada", true)
        .gt("valido_ate", agora)
        .order("medido_em", { ascending: false }),
    ]);
    type L = { property_id: string; papel: string; download_mbps: number | string; upload_mbps: number | string; latencia_ms: number; medido_em: string };
    const rodada = (l: L): Rodada => ({ downloadMbps: Number(l.download_mbps), uploadMbps: Number(l.upload_mbps), latenciaMs: Number(l.latencia_ms) });
    const linhas = (meds ?? []) as L[];
    for (const t of (tags ?? []) as { id: string; tag_home_office: boolean | null }[]) {
      const dono = linhas.find((l) => l.property_id === t.id && l.papel === "dono");
      const morador = dono ? linhas.find((l) => l.property_id === t.id && l.papel === "morador" && l.medido_em > dono.medido_em) : undefined;
      r.set(t.id, {
        homeOffice: t.tag_home_office ? (dono && boaParaVideochamada(rodada(dono)) ? "medido" : "informado") : null,
        internetAbaixoMorador: !!dono && !!morador && sinalMorador(rodada(dono), rodada(morador)),
      });
    }
  } catch {
    /* sem 0205: a nota segue sem a internet */
  }
  return r;
}

/**
 * Prompt 59: pendências PROCEDENTES do padrão mínimo em 12 meses (por anúncio), soluções de manutenção fora do prazo em
 * 90 dias (por proprietário) e pendências abertas (sinal "imóvel diferente do anúncio"). Sem a 0210, nada muda.
 */
async function prazos59(admin: Admin, ids: string[], donos: string[]) {
  const procedentes = new Map<string, number>();
  const abertas = new Map<string, number>();
  const fora90d = new Map<string, number>();
  const agora = new Date();
  try {
    const desde = new Date(agora.getTime() - 400 * 86_400_000).toISOString();
    const [{ data: pend }, { data: ordens }] = await Promise.all([
      admin.from("conforto_pendencias").select("property_id, chave, status, aberta_em, prazo_ate, decidido_em").in("property_id", ids).gte("aberta_em", desde),
      admin.from("service_orders").select("owner_id, priority, status, opened_at, provisoria_em, solucao_marcada_em, resolved_at, simulacao").in("owner_id", donos).gte("opened_at", new Date(agora.getTime() - 120 * 86_400_000).toISOString()),
    ]);
    const porImovel = new Map<string, PendenciaConforto[]>();
    for (const p of (pend ?? []) as (PendenciaConforto & { property_id: string })[]) porImovel.set(p.property_id, [...(porImovel.get(p.property_id) ?? []), p]);
    for (const [id, ps] of porImovel) {
      procedentes.set(id, procedentes12m(ps, agora));
      abertas.set(id, ps.filter((p) => p.status === "aberta" || p.status === "contestada" || pendenciaVencida(p, agora)).length);
    }
    const porDono = new Map<string, OrdemSolucao[]>();
    for (const o of (ordens ?? []) as { owner_id: string; priority: OrdemSolucao["priority"]; status: string; opened_at: string; provisoria_em: string | null; solucao_marcada_em: string | null; resolved_at: string | null; simulacao: boolean | null }[]) {
      if (o.simulacao) continue;
      porDono.set(o.owner_id, [...(porDono.get(o.owner_id) ?? []), { priority: o.priority, openedAt: o.opened_at, provisoriaEm: o.provisoria_em, solucaoMarcadaEm: o.solucao_marcada_em, resolvedAt: o.resolved_at, status: o.status }]);
    }
    for (const [dono, os] of porDono) fora90d.set(dono, foraDoPrazo90d(os, agora));
  } catch {
    /* sem 0210: a nota e o selo seguem sem o padrão mínimo e o prazo de solução */
  }
  return { procedentes, abertas, fora90d };
}

/** Interruptor do admin (null = ninguém mexeu; vale a variável de ambiente). */
export async function interruptorOrdemNova(admin: Admin | null = createAdminClient()): Promise<boolean | null> {
  if (!admin) return null;
  const { data, error } = await admin.from("plataforma_chaves").select("ligada").eq("chave", CHAVE_ORDEM_NOVA).maybeSingle();
  if (error || !data) return null;
  return (data as { ligada: boolean }).ligada === true;
}

/** A ordem nova vale agora? Desligada por padrão; o interruptor do admin vence o ambiente. */
export async function ordemNovaAtiva(admin: Admin | null = createAdminClient()): Promise<boolean> {
  return ordemNovaLigada(process.env.ORDEM_NOVA_ATIVA, await interruptorOrdemNova(admin));
}

export interface RegistroSombra {
  /** Filtros resumidos (cidade, faixa de valor, ordenação…). Nunca nome, e-mail, telefone ou id de pessoa. */
  busca: Record<string, string | number | boolean | null>;
  topAntigo: string[];
  topNovo: string[];
  donoDe: (id: string) => string | undefined;
}

const donosDistintos = (ids: string[], donoDe: (id: string) => string | undefined) =>
  new Set(ids.map((id) => donoDe(id) ?? id)).size;

/** Modo sombra: 1 em cada 5 buscas grava o top 10 antigo × novo (best-effort, nunca quebra a busca). */
export async function registrarSombra(r: RegistroSombra, admin: Admin | null = createAdminClient(), sorteio = Math.random()): Promise<boolean> {
  if (!admin || !gravarSombra(sorteio)) return false;
  const topAntigo = r.topAntigo.filter((id) => UUID.test(id)).slice(0, 10);
  const topNovo = r.topNovo.filter((id) => UUID.test(id)).slice(0, 10);
  const { error } = await admin.from("ranking_sombra").insert({
    busca: r.busca,
    top_antigo: topAntigo,
    top_novo: topNovo,
    donos_antigo: donosDistintos(topAntigo, r.donoDe),
    donos_novo: donosDistintos(topNovo, r.donoDe),
  });
  return !error;
}

/** Cron diário: apaga os registros da sombra com mais de 30 dias. */
export async function limparSombra(admin: Admin): Promise<number> {
  const { data, error } = await admin.rpc("limpar_ranking_sombra");
  return error ? 0 : Number(data) || 0;
}
