import "server-only";
import { CATEGORIAS_SO_CREDENCIAMENTO } from "@/lib/parceiros/regras";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cidadeDoCep, normalizarCep } from "@/lib/fotografos/regras";
import { geocodeForSave } from "@/lib/integrations/geocoding";
import { MUNICIPIOS } from "@/lib/municipios";
import { chaveCidade } from "@/lib/cidades";
import { filtrarParceiros, lerParceiroGeral, type ParceiroGeral, type ParceiroNaBusca } from "@/lib/parceiros/regras";

/**
 * Leitura PÚBLICA dos parceiros (Prompt 31a): só a view parceiros_publicos (status publicado; sem documento,
 * recebimento, telefone, CEP ou e-mail). Serviços e galeria pela RLS (só de parceiro publicado).
 */

export const BUCKET_PARCEIROS = "parceiros";

/** URL pública de uma imagem do bucket "parceiros" (foto, capa, galeria). */
export function urlMidiaParceiro(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base}/storage/v1/object/public/${BUCKET_PARCEIROS}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export interface ParceiroPublico extends ParceiroNaBusca {
  id: string;
  nomePublico: string;
  descricao: string | null;
  descricaoCurta: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  redes: { instagram: string | null; linkedin: string | null; facebook: string | null; tiktok: string | null; site: string | null };
}

type Linha = Record<string, unknown>;

function deLinha(l: Linha): ParceiroPublico {
  return {
    id: String(l.id),
    slug: String(l.slug),
    nomePublico: String(l.nome_publico),
    // "vistoria" é credenciamento (Prompt 62-B1): não aparece como serviço contratável na página nem na busca.
    categorias: ((l.categorias as string[]) ?? []).filter((c) => !CATEGORIAS_SO_CREDENCIAMENTO.includes(c)),
    cidades: (l.cidades as string[]) ?? [],
    descricao: (l.descricao as string | null) ?? null,
    descricaoCurta: (l.descricao_curta as string | null) ?? null,
    avatarUrl: urlMidiaParceiro(l.avatar_path as string | null),
    bannerUrl: urlMidiaParceiro(l.banner_path as string | null),
    redes: {
      instagram: (l.instagram as string | null) ?? null,
      linkedin: (l.linkedin as string | null) ?? null,
      facebook: (l.facebook as string | null) ?? null,
      tiktok: (l.tiktok as string | null) ?? null,
      site: (l.site as string | null) ?? null,
    },
    notaMedia: l.nota_media == null ? null : Number(l.nota_media),
    avaliacoesQtd: Number(l.avaliacoes_qtd ?? 0),
    publicadoEm: (l.publicado_em as string | null) ?? null,
    teste: l.teste === true,
    status: "publicado",
    lat: l.lat == null ? null : Number(l.lat),
    lng: l.lng == null ? null : Number(l.lng),
    raioKm: l.raio_km == null ? null : Number(l.raio_km),
  };
}

/** UF da cidade digitada sem CEP, quando o nome é de um só município (senão, fica em branco). */
export function ufUnica(cidade: string): string {
  const chave = chaveCidade(cidade);
  if (!chave) return "";
  const ufs = Object.keys(MUNICIPIOS).filter((u) => MUNICIPIOS[u].some((m) => chaveCidade(m) === chave));
  return ufs.length === 1 ? ufs[0] : "";
}

export interface ResultadoBusca {
  lista: ParceiroPublico[];
  cidade: string;
  uf: string;
  cep: string;
  cepNaoEncontrado: boolean;
}

/**
 * Quem olha é conta de teste (profiles.is_teste, só o servidor liga) ou admin? Então enxerga os parceiros de teste na
 * busca — o QA acha o próprio parceiro de teste. Visitante e conta real: nunca. Qualquer falha: não enxerga.
 */
async function veParceirosDeTeste(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    if (!supabase || !admin) return false;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await admin.from("profiles").select("is_teste, role").eq("id", user.id).maybeSingle();
    const p = data as { is_teste: boolean | null; role: string | null } | null;
    return p?.is_teste === true || p?.role === "admin";
  } catch {
    return false;
  }
}

/** Busca pública: categoria, cidade e/ou CEP (o CEP vira cidade e, com o mapa ligado, um ponto para o raio). */
export async function buscarParceiros(f: { categoria?: string | null; cidade?: string | null; uf?: string | null; cep?: string | null }): Promise<ResultadoBusca> {
  const cep = normalizarCep(f.cep) ?? "";
  const doCep = cep ? await cidadeDoCep(cep) : null;
  const cidade = (doCep?.cidade ?? f.cidade ?? "").toString().trim().slice(0, 80);
  const uf = (doCep?.uf ?? f.uf ?? "").toString().trim().toUpperCase().slice(0, 2) || (cidade ? ufUnica(cidade) : "");
  let ponto: { lat: number; lng: number } | null = null;
  if (doCep) {
    const g = await geocodeForSave({ city: `${doCep.cidade} - ${doCep.uf}` });
    if (!g.approximate) ponto = { lat: g.lat, lng: g.lng };
  }
  const sb = createPublicClient();
  if (!sb) return { lista: [], cidade, uf, cep, cepNaoEncontrado: !!cep && !doCep };
  const { data } = await sb.from("parceiros_publicos").select("*").limit(500);
  const lista = filtrarParceiros(((data ?? []) as Linha[]).map(deLinha).filter((p) => p.categorias.length > 0), { categoria: f.categoria, cidade, ponto, verTeste: await veParceirosDeTeste() });
  return { lista, cidade, uf, cep, cepNaoEncontrado: !!cep && !doCep };
}

export interface ServicoPublico {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  precoBase: number | null;
  unidade: string | null;
  prazoDias: number | null;
}
export interface FotoGaleria {
  id: string;
  url: string;
  legenda: string | null;
}

/** Página pública: o parceiro publicado, os serviços ativos e a galeria (na ordem). */
export async function parceiroPorSlug(slug: string): Promise<{ parceiro: ParceiroPublico; servicos: ServicoPublico[]; galeria: FotoGaleria[] } | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const sb = createPublicClient();
  if (!sb) return null;
  const { data } = await sb.from("parceiros_publicos").select("*").eq("slug", slug).maybeSingle();
  if (!data) return null;
  const parceiro = deLinha(data as Linha);
  const [{ data: sv }, { data: gl }] = await Promise.all([
    sb.from("parceiro_servicos").select("id, categoria, titulo, descricao, preco_base, unidade, prazo_dias").eq("parceiro_id", parceiro.id).eq("ativo", true).order("criado_em"),
    sb.from("parceiro_galeria").select("id, path, legenda, ordem").eq("parceiro_id", parceiro.id).order("ordem").limit(30),
  ]);
  return {
    parceiro,
    servicos: (sv ?? []).map((s) => ({
      id: s.id as string,
      categoria: s.categoria as string,
      titulo: s.titulo as string,
      descricao: (s.descricao as string | null) ?? null,
      precoBase: s.preco_base == null ? null : Number(s.preco_base),
      unidade: (s.unidade as string | null) ?? null,
      prazoDias: (s.prazo_dias as number | null) ?? null,
    })),
    galeria: (gl ?? []).flatMap((g) => {
      const url = urlMidiaParceiro(g.path as string);
      return url ? [{ id: g.id as string, url, legenda: (g.legenda as string | null) ?? null }] : [];
    }),
  };
}

/** Cartão do parceiro geral (chave PARCEIRO_GERAL_FALLBACK; desligada por padrão). Só o servidor lê. */
export async function lerParceiroGeralServidor(): Promise<ParceiroGeral> {
  const admin = createAdminClient();
  if (!admin) return lerParceiroGeral(null, false);
  const { data } = await admin.from("chaves_plataforma").select("ligada, valor").eq("chave", "PARCEIRO_GERAL_FALLBACK").maybeSingle();
  return lerParceiroGeral(data?.valor, data?.ligada === true);
}
