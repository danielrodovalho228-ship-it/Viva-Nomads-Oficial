"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_PARCEIROS, urlMidiaParceiro } from "@/lib/data/parceiros-publico";
import { cidadeDoCep, ehUuid, normalizarCep } from "@/lib/fotografos/regras";
import { geocodeForSave } from "@/lib/integrations/geocoding";
import { chaveCidade } from "@/lib/cidades";
import {
  CIDADES_MAX,
  categoriaValida,
  faltaParaPublicar,
  finalRecebimento,
  GALERIA_MAX,
  REDES,
  UNIDADES_SERVICO,
  validarRede,
  type ChaveRede,
} from "./regras";

/**
 * Painel do parceiro (/dashboard/parceiro, Prompt 31a item 5). Toda ação confere a sessão e grava pelo servidor
 * (service_role) só na linha do próprio parceiro. Suspenso não edita nem publica.
 */

type Res<T = null> = { ok: true; valor: T } | { ok: false; erro: string };
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export interface PainelParceiro {
  id: string;
  slug: string;
  status: string;
  suspensoMotivo: string | null;
  tipoPessoa: string;
  documentoMascarado: string;
  razaoSocial: string | null;
  nomePublico: string;
  categorias: string[];
  descricao: string;
  descricaoCurta: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  redes: Record<ChaveRede, string>;
  cidades: string[];
  cepBase: string;
  raioKm: number | null;
  recebimentoFinal: string | null;
  servicos: { id: string; categoria: string; titulo: string; descricao: string | null; precoBase: number | null; unidade: string | null; prazoDias: number | null; ativo: boolean }[];
  galeria: { id: string; url: string; legenda: string | null; ordem: number }[];
  agenda: { id: string; tipo: string; diaSemana: number | null; inicio: string | null; fim: string | null; dataInicio: string | null; dataFim: string | null }[];
  falta: string[];
}

async function meu(): Promise<{ admin: Admin; userId: string; p: Record<string, unknown> } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  if (!user || !admin) return null;
  const { data: p } = await admin.from("parceiros").select("*").eq("user_id", user.id).maybeSingle();
  return p ? { admin, userId: user.id, p } : null;
}

async function editavel() {
  const m = await meu();
  if (!m) return { erro: "Você ainda não é parceiro." } as const;
  if (m.p.status === "suspenso") return { erro: "A sua parceria está suspensa. Fale com a Viva pela Central de Ajuda." } as const;
  return m;
}

function mascararDoc(tipo: string, d: string): string {
  return tipo === "pj" ? `${d.slice(0, 2)}.•••.•••/••••-${d.slice(-2)}` : `•••.•••.${d.slice(6, 9)}-${d.slice(-2)}`;
}

async function contar(admin: Admin, id: string) {
  const [{ count: servicos }, { count: fotos }] = await Promise.all([
    admin.from("parceiro_servicos").select("id", { count: "exact", head: true }).eq("parceiro_id", id).eq("ativo", true),
    admin.from("parceiro_galeria").select("id", { count: "exact", head: true }).eq("parceiro_id", id),
  ]);
  return { servicos: servicos ?? 0, fotos: fotos ?? 0 };
}

function faltaDe(p: Record<string, unknown>, c: { servicos: number; fotos: number }): string[] {
  return faltaParaPublicar({
    avatarPath: (p.avatar_path as string | null) ?? null,
    descricao: (p.descricao as string | null) ?? null,
    servicosAtivos: c.servicos,
    cidades: (p.cidades as string[]) ?? [],
    categorias: (p.categorias as string[]) ?? [],
    fotosGaleria: c.fotos,
  });
}

/**
 * Sem revalidatePath aqui: no painel, revalidar trocava a tela pelo "carregando" e prendia o formulário; o painel relê
 * os próprios dados (meuPainelParceiro). As páginas públicas do parceiro e a busca são dinâmicas (sempre do banco).
 */
function atualizarTelas(_slug: string) {
  void _slug;
}
export async function meuPainelParceiro(): Promise<PainelParceiro | null> {
  const m = await meu();
  if (!m) return null;
  const { admin, p } = m;
  const id = p.id as string;
  const [{ data: sv }, { data: gl }, { data: ag }] = await Promise.all([
    admin.from("parceiro_servicos").select("id, categoria, titulo, descricao, preco_base, unidade, prazo_dias, ativo").eq("parceiro_id", id).order("criado_em"),
    admin.from("parceiro_galeria").select("id, path, legenda, ordem").eq("parceiro_id", id).order("ordem"),
    admin.from("parceiro_agenda").select("id, tipo, dia_semana, inicio, fim, data_inicio, data_fim").eq("parceiro_id", id).order("tipo").order("dia_semana").order("data_inicio"),
  ]);
  const servicos = (sv ?? []).map((s) => ({
    id: s.id as string,
    categoria: s.categoria as string,
    titulo: s.titulo as string,
    descricao: (s.descricao as string | null) ?? null,
    precoBase: s.preco_base == null ? null : Number(s.preco_base),
    unidade: (s.unidade as string | null) ?? null,
    prazoDias: (s.prazo_dias as number | null) ?? null,
    ativo: s.ativo === true,
  }));
  const galeria = (gl ?? []).flatMap((g) => {
    const url = urlMidiaParceiro(g.path as string);
    return url ? [{ id: g.id as string, url, legenda: (g.legenda as string | null) ?? null, ordem: Number(g.ordem) }] : [];
  });
  const rec = (p.dados_recebimento ?? {}) as { chave?: string };
  return {
    id,
    slug: p.slug as string,
    status: p.status as string,
    suspensoMotivo: (p.suspenso_motivo as string | null) ?? null,
    tipoPessoa: p.tipo_pessoa as string,
    documentoMascarado: mascararDoc(p.tipo_pessoa as string, p.documento as string),
    razaoSocial: (p.razao_social as string | null) ?? null,
    nomePublico: p.nome_publico as string,
    categorias: (p.categorias as string[]) ?? [],
    descricao: (p.descricao as string | null) ?? "",
    descricaoCurta: (p.descricao_curta as string | null) ?? "",
    avatarUrl: urlMidiaParceiro(p.avatar_path as string | null),
    bannerUrl: urlMidiaParceiro(p.banner_path as string | null),
    redes: Object.fromEntries(REDES.map((r) => [r.chave, (p[r.chave] as string | null) ?? ""])) as Record<ChaveRede, string>,
    cidades: (p.cidades as string[]) ?? [],
    cepBase: (p.cep_base as string | null) ?? "",
    raioKm: (p.raio_km as number | null) ?? null,
    recebimentoFinal: rec.chave ? finalRecebimento(rec.chave) : null,
    servicos,
    galeria,
    agenda: (ag ?? []).map((a) => ({
      id: a.id as string,
      tipo: a.tipo as string,
      diaSemana: (a.dia_semana as number | null) ?? null,
      inicio: a.inicio ? String(a.inicio).slice(0, 5) : null,
      fim: a.fim ? String(a.fim).slice(0, 5) : null,
      dataInicio: (a.data_inicio as string | null) ?? null,
      dataFim: (a.data_fim as string | null) ?? null,
    })),
    falta: faltaDe(p, { servicos: servicos.filter((s) => s.ativo).length, fotos: galeria.length }),
  };
}

const limpar = (t: unknown, max: number) => String(t ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);

export async function salvarPagina(e: { nomePublico: string; descricao: string; descricaoCurta: string; redes: Partial<Record<ChaveRede, string>> }): Promise<Res> {
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  const nome = limpar(e.nomePublico, 80).replace(/\s+/g, " ");
  if (nome.length < 2) return { ok: false, erro: "Informe o nome que aparece na página." };
  const descricao = limpar(e.descricao, 2000);
  const curta = limpar(e.descricaoCurta, 160).replace(/\s+/g, " ");
  const redes: Record<string, string | null> = {};
  for (const r of REDES) {
    const v = validarRede(r.chave, e.redes?.[r.chave]);
    if (!v.ok) return { ok: false, erro: v.erro };
    redes[r.chave] = v.valor;
  }
  const { error } = await m.admin
    .from("parceiros")
    .update({ nome_publico: nome, descricao: descricao || null, descricao_curta: curta || null, ...redes, atualizado_em: new Date().toISOString() })
    .eq("id", m.p.id);
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  atualizarTelas(m.p.slug as string);
  return { ok: true, valor: null };
}

/** WebP de verdade (RIFF....WEBP) e até 5 MB: o navegador já recortou, reduziu e tirou o EXIF. */
function ehWebp(b: Uint8Array): boolean {
  const t = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  return b.length > 12 && t(0, 4) === "RIFF" && t(8, 4) === "WEBP";
}

export async function enviarImagemParceiro(form: FormData): Promise<Res<{ url: string; id: string | null; legenda: string | null }>> {
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  const tipo = String(form.get("tipo") ?? "");
  if (!["avatar", "banner", "galeria"].includes(tipo)) return { ok: false, erro: "Tipo inválido." };
  const arq = form.get("arquivo");
  if (!(arq instanceof Blob) || arq.size === 0) return { ok: false, erro: "Escolha uma imagem." };
  if (arq.size > 5 * 1024 * 1024) return { ok: false, erro: "Imagem grande demais (até 5 MB)." };
  const bytes = new Uint8Array(await arq.arrayBuffer());
  if (!ehWebp(bytes)) return { ok: false, erro: "Formato não aceito. Use JPG, PNG ou WebP." };
  const id = m.p.id as string;
  if (tipo === "galeria") {
    const { count } = await m.admin.from("parceiro_galeria").select("id", { count: "exact", head: true }).eq("parceiro_id", id);
    if ((count ?? 0) >= GALERIA_MAX) return { ok: false, erro: `A galeria aceita até ${GALERIA_MAX} fotos.` };
  }
  const path = `${id}/${tipo}-${randomBytes(8).toString("hex")}.webp`;
  const { error } = await m.admin.storage.from(BUCKET_PARCEIROS).upload(path, bytes, { contentType: "image/webp", upsert: false });
  if (error) return { ok: false, erro: "Não foi possível enviar a imagem. Tente de novo." };
  let fotoId: string | null = null;
  let legendaFoto: string | null = null;
  if (tipo === "galeria") {
    const { data: ultima } = await m.admin.from("parceiro_galeria").select("ordem").eq("parceiro_id", id).order("ordem", { ascending: false }).limit(1).maybeSingle();
    const legenda = limpar(form.get("legenda"), 120) || null;
    const { data: nova, error: eGaleria } = await m.admin
      .from("parceiro_galeria")
      .insert({ parceiro_id: id, path, legenda, ordem: ultima ? Number(ultima.ordem) + 1 : 0 })
      .select("id")
      .single();
    if (eGaleria) {
      console.error("[parceiro] galeria não gravou:", eGaleria.code, eGaleria.message);
      await m.admin.storage.from(BUCKET_PARCEIROS).remove([path]);
      return { ok: false, erro: "Não foi possível salvar a foto. Tente de novo." };
    }
    fotoId = nova.id as string;
    legendaFoto = legenda;
  } else {
    const coluna = tipo === "avatar" ? "avatar_path" : "banner_path";
    const antigo = m.p[coluna] as string | null;
    await m.admin.from("parceiros").update({ [coluna]: path, atualizado_em: new Date().toISOString() }).eq("id", id);
    if (antigo) await m.admin.storage.from(BUCKET_PARCEIROS).remove([antigo]);
  }
  atualizarTelas(m.p.slug as string);
  return { ok: true, valor: { url: urlMidiaParceiro(path) ?? "", id: fotoId, legenda: legendaFoto } };
}

export async function removerFotoGaleria(fotoId: string): Promise<Res> {
  if (!ehUuid(fotoId)) return { ok: false, erro: "Foto inválida." };
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  const { data: f } = await m.admin.from("parceiro_galeria").select("path").eq("id", fotoId).eq("parceiro_id", m.p.id).maybeSingle();
  if (!f) return { ok: false, erro: "Foto não encontrada." };
  await m.admin.from("parceiro_galeria").delete().eq("id", fotoId);
  await m.admin.storage.from(BUCKET_PARCEIROS).remove([f.path as string]);
  atualizarTelas(m.p.slug as string);
  return { ok: true, valor: null };
}

/** Troca a foto de lugar com a vizinha (para cima ou para baixo). */
export async function moverFotoGaleria(fotoId: string, direcao: "antes" | "depois"): Promise<Res> {
  if (!ehUuid(fotoId)) return { ok: false, erro: "Foto inválida." };
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  const { data: fotos } = await m.admin.from("parceiro_galeria").select("id, ordem").eq("parceiro_id", m.p.id).order("ordem").order("criado_em");
  const lista = fotos ?? [];
  const i = lista.findIndex((f) => f.id === fotoId);
  const j = direcao === "antes" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) return { ok: true, valor: null };
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  await Promise.all(nova.map((f, k) => m.admin.from("parceiro_galeria").update({ ordem: k }).eq("id", f.id)));
  atualizarTelas(m.p.slug as string);
  return { ok: true, valor: null };
}

export async function legendarFotoGaleria(fotoId: string, legenda: string): Promise<Res> {
  if (!ehUuid(fotoId)) return { ok: false, erro: "Foto inválida." };
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  await m.admin.from("parceiro_galeria").update({ legenda: limpar(legenda, 120) || null }).eq("id", fotoId).eq("parceiro_id", m.p.id);
  atualizarTelas(m.p.slug as string);
  return { ok: true, valor: null };
}

export async function salvarServico(e: { id?: string | null; categoria: string; titulo: string; descricao?: string; precoBase?: string | number | null; unidade?: string; prazoDias?: string | number | null; ativo?: boolean }): Promise<Res> {
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  if (!categoriaValida(e.categoria) || !((m.p.categorias as string[]) ?? []).includes(e.categoria)) return { ok: false, erro: "Escolha uma das suas categorias." };
  const titulo = limpar(e.titulo, 80).replace(/\s+/g, " ");
  if (titulo.length < 3) return { ok: false, erro: "Dê um nome ao serviço." };
  const precoTxt = String(e.precoBase ?? "").replace(/\./g, "").replace(",", ".").trim();
  const preco = precoTxt ? Number(precoTxt) : null;
  if (preco != null && !(preco > 0 && preco < 1_000_000)) return { ok: false, erro: "Preço inválido (deixe em branco para \"sob consulta\")." };
  const unidade = UNIDADES_SERVICO.includes(String(e.unidade) as (typeof UNIDADES_SERVICO)[number]) ? String(e.unidade) : null;
  const prazo = String(e.prazoDias ?? "").trim() ? Number(e.prazoDias) : null;
  if (prazo != null && !(Number.isInteger(prazo) && prazo >= 0 && prazo <= 90)) return { ok: false, erro: "Prazo em dias: de 0 a 90." };
  const linha = { categoria: e.categoria, titulo, descricao: limpar(e.descricao, 500) || null, preco_base: preco, unidade: preco == null ? null : unidade, prazo_dias: prazo, ativo: e.ativo !== false };
  if (e.id) {
    if (!ehUuid(e.id)) return { ok: false, erro: "Serviço inválido." };
    const { error } = await m.admin.from("parceiro_servicos").update(linha).eq("id", e.id).eq("parceiro_id", m.p.id);
    if (error) return { ok: false, erro: "Não foi possível salvar." };
  } else {
    const { count } = await m.admin.from("parceiro_servicos").select("id", { count: "exact", head: true }).eq("parceiro_id", m.p.id);
    if ((count ?? 0) >= 20) return { ok: false, erro: "Até 20 serviços." };
    const { error } = await m.admin.from("parceiro_servicos").insert({ ...linha, parceiro_id: m.p.id });
    if (error) return { ok: false, erro: "Não foi possível salvar." };
  }
  atualizarTelas(m.p.slug as string);
  return { ok: true, valor: null };
}

export async function removerServico(id: string): Promise<Res> {
  if (!ehUuid(id)) return { ok: false, erro: "Serviço inválido." };
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  await m.admin.from("parceiro_servicos").delete().eq("id", id).eq("parceiro_id", m.p.id);
  atualizarTelas(m.p.slug as string);
  return { ok: true, valor: null };
}

/** Cidades atendidas, CEP base e raio. O CEP base vira um ponto (com o mapa ligado) para a busca por raio. */
export async function salvarAtendimento(e: { cidades: string[]; cepBase?: string; raioKm?: string | number | null }): Promise<Res> {
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  const vistas = new Set<string>();
  const cidades: string[] = [];
  for (const c of e.cidades ?? []) {
    const l = limpar(c, 80).replace(/\s+/g, " ");
    const k = chaveCidade(l);
    if (!k || vistas.has(k)) continue;
    vistas.add(k);
    cidades.push(l);
  }
  if (!cidades.length) return { ok: false, erro: "Informe pelo menos uma cidade." };
  if (cidades.length > CIDADES_MAX) return { ok: false, erro: `Até ${CIDADES_MAX} cidades.` };
  const cepTxt = String(e.cepBase ?? "").trim();
  const cep = cepTxt ? normalizarCep(cepTxt) : null;
  if (cepTxt && !cep) return { ok: false, erro: "CEP inválido." };
  const raio = String(e.raioKm ?? "").trim() ? Number(e.raioKm) : null;
  if (raio != null && !(Number.isInteger(raio) && raio >= 1 && raio <= 200)) return { ok: false, erro: "Raio de 1 a 200 km." };
  let lat: number | null = null;
  let lng: number | null = null;
  if (cep && cep !== m.p.cep_base) {
    const d = await cidadeDoCep(cep);
    if (!d) return { ok: false, erro: "Não encontramos esse CEP." };
    const g = await geocodeForSave({ city: `${d.cidade} - ${d.uf}` });
    if (!g.approximate) ({ lat, lng } = g);
  } else if (cep) {
    lat = (m.p.lat as number | null) ?? null;
    lng = (m.p.lng as number | null) ?? null;
  }
  const { error } = await m.admin.from("parceiros").update({ cidades, cep_base: cep, raio_km: raio, lat, lng, atualizado_em: new Date().toISOString() }).eq("id", m.p.id);
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  atualizarTelas(m.p.slug as string);
  return { ok: true, valor: null };
}

export async function adicionarAgenda(e: { tipo: "janela"; diaSemana: number; inicio: string; fim: string } | { tipo: "bloqueio"; dataInicio: string; dataFim: string }): Promise<Res> {
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
  const data = /^\d{4}-\d{2}-\d{2}$/;
  let linha: Record<string, unknown>;
  if (e.tipo === "janela") {
    if (!(Number.isInteger(e.diaSemana) && e.diaSemana >= 0 && e.diaSemana <= 6) || !hora.test(e.inicio) || !hora.test(e.fim) || e.fim <= e.inicio) return { ok: false, erro: "Escolha o dia e um horário de início antes do fim." };
    linha = { tipo: "janela", dia_semana: e.diaSemana, inicio: e.inicio, fim: e.fim };
  } else {
    if (!data.test(e.dataInicio) || !data.test(e.dataFim) || e.dataFim < e.dataInicio) return { ok: false, erro: "Escolha as datas do bloqueio (a final depois da inicial)." };
    linha = { tipo: "bloqueio", data_inicio: e.dataInicio, data_fim: e.dataFim };
  }
  const { count } = await m.admin.from("parceiro_agenda").select("id", { count: "exact", head: true }).eq("parceiro_id", m.p.id);
  if ((count ?? 0) >= 60) return { ok: false, erro: "Agenda cheia (até 60 itens)." };
  const { error } = await m.admin.from("parceiro_agenda").insert({ ...linha, parceiro_id: m.p.id });
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  return { ok: true, valor: null };
}

export async function removerAgenda(id: string): Promise<Res> {
  if (!ehUuid(id)) return { ok: false, erro: "Item inválido." };
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  await m.admin.from("parceiro_agenda").delete().eq("id", id).eq("parceiro_id", m.p.id);
  return { ok: true, valor: null };
}

/** Recebimento (restrito): guarda a chave Pix; a tela mostra só os 4 finais. Pagamento pela plataforma ainda não está ativo. */
export async function salvarRecebimento(chave: string): Promise<Res<string>> {
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  const c = limpar(chave, 120).replace(/\s+/g, "");
  if (c.length < 5) return { ok: false, erro: "Informe a chave Pix." };
  const { error } = await m.admin.from("parceiros").update({ dados_recebimento: { tipo: "pix", chave: c, atualizado_em: new Date().toISOString() } }).eq("id", m.p.id);
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  return { ok: true, valor: finalRecebimento(c) };
}

export async function publicarPagina(): Promise<Res> {
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  const falta = faltaDe(m.p, await contar(m.admin, m.p.id as string));
  if (falta.length) return { ok: false, erro: `Falta: ${falta.join("; ")}.` };
  const { error } = await m.admin
    .from("parceiros")
    .update({ status: "publicado", publicado_em: (m.p.publicado_em as string | null) ?? new Date().toISOString(), atualizado_em: new Date().toISOString() })
    .eq("id", m.p.id);
  if (error) return { ok: false, erro: "Não foi possível publicar." };
  atualizarTelas(m.p.slug as string);
  return { ok: true, valor: null };
}

export async function pausarPagina(): Promise<Res> {
  const m = await editavel();
  if ("erro" in m) return { ok: false, erro: m.erro };
  if (m.p.status !== "publicado") return { ok: false, erro: "A página não está publicada." };
  await m.admin.from("parceiros").update({ status: "pausado", atualizado_em: new Date().toISOString() }).eq("id", m.p.id);
  atualizarTelas(m.p.slug as string);
  return { ok: true, valor: null };
}

/** O menu "Parceiro" aparece quando a conta tem o papel (a linha em parceiros) ou um pedido de parceria. */
export async function temPapelParceiro(): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const [{ count: p }, { count: s }] = await Promise.all([
    supabase.from("parceiros").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("parceiro_solicitacoes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  return (p ?? 0) + (s ?? 0) > 0;
}
