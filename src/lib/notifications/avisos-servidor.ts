import { createAdminClient } from "@/lib/supabase/admin";
import { TEMPLATES, type NotificationEvent } from "./eventos-email";
import { chaveDoAvisoPendente, duplicatasDoPendente, prioridadeDoAviso, textoDoAviso, tituloAvisoAssinar, tituloComImovel, tituloDoAviso, urlDoAviso, type PapelAviso, type PrioridadeAviso } from "./avisos";
import { numeroPublicoContrato } from "@/lib/contrato-ref";
import { dataDeSaida } from "@/lib/contrato-periodo";
import { guardContactInfo } from "@/lib/messages/contact-guard";

/*
  E444 — gravação e resolução dos avisos do sino (servidor, service role). Best-effort: nunca derruba o envio do e-mail
  nem a ação da pessoa. Sem a migração 0286 aplicada, a gravação falha em silêncio (só registra no log).
*/
const REF_RE = /^[\w-]{1,80}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres: coluna inexistente (a 0298 ainda não aplicada). */
const SEM_COLUNA = "42703";

export async function gravarAviso(p: {
  usuarioId: string;
  evento: NotificationEvent;
  papel?: PapelAviso | null;
  url?: string | null;
  refId?: string | null;
  prioridade?: PrioridadeAviso | null;
  /** E570: título específico já montado por uma função pura de avisos.ts (ex.: tituloAvisoCandidatura). Passa pelo
   *  filtro de contato; sem ele, o assunto do catálogo. */
  titulo?: string | null;
  /** E550: o imóvel do evento — o título do aviso passa a nomeá-lo ("Documento aprovado · Casa no Centro"). */
  imovelId?: string | null;
  /** E482: a linha de texto do aviso (ex.: a prévia da mensagem). Passa pelo filtro de contato. */
  texto?: string | null;
}): Promise<boolean> {
  const admin = createAdminClient();
  const base = TEMPLATES[p.evento];
  if (!admin || !base || !p.usuarioId) return false;
  // E1228: o aviso crítico de assinatura pendente (contract_status de um contrato) diz QUAL estadia — as datas dos
  // blocos do contrato, ou o VN-CT se a leitura falhar — e leva o VN-CT no corpo. Os avisos já gravados não mudam.
  const assinatura = !p.titulo && p.evento === "contract_status" && (p.prioridade ?? prioridadeDoAviso(p.evento, p.papel)) === "critico" && p.refId && UUID_RE.test(p.refId) ? { contratoId: p.refId, ...(await estadiaDoContrato(admin, p.refId)) } : null;
  if (assinatura) p = { ...p, texto: `Contrato ${numeroPublicoContrato(assinatura.contratoId)}` };
  // Fonte única: o assunto do catálogo (ou o título já montado), mais o nome do imóvel quando o evento tem imóvel.
  let titulo = p.titulo ? tituloDoAviso(guardContactInfo(p.titulo).text) : tituloDoAviso(base.subject);
  let nomeDoImovel: string | null = null;
  // E482: também com título montado (a mensagem nova nomeia o imóvel); tituloComImovel não repete um nome já presente.
  if (p.imovelId && UUID_RE.test(p.imovelId)) {
    const { data: im } = await admin.from("properties").select("title").eq("id", p.imovelId).maybeSingle();
    const nome = (im?.title as string | null) ?? null;
    if (nome) titulo = tituloComImovel(titulo, guardContactInfo(nome).text);
    nomeDoImovel = nome ? guardContactInfo(nome).text : null;
  }
  if (assinatura) titulo = tituloAvisoAssinar({ imovel: nomeDoImovel, entrada: assinatura.entrada, saida: assinatura.saida, contratoId: assinatura.contratoId });
  const texto = p.texto ? textoDoAviso(guardContactInfo(p.texto).text) : null;
  const refId = p.refId && REF_RE.test(p.refId) ? p.refId : null;
  const url = urlDoAviso(p.url ?? base.path);
  // E1251 (ESPEC-E1251 v3; ORDEM-DUET 1267): a prioridade calcula-se UMA vez — a da chamada; na falta, a da tabela por
  // evento e papel — e entra nas duas gravações da renovação, na linha nova e no juntar dos repetidos.
  const prioridade = p.prioridade ?? prioridadeDoAviso(p.evento, p.papel);
  // E550: o mesmo aviso pendente (não lido, não resolvido) é renovado, não repetido. O já LIDO não se renova: nasce outro.
  const chave = chaveDoAvisoPendente({ evento: p.evento, refId, titulo });
  let pendente = admin.from("avisos").select("id").eq("usuario_id", p.usuarioId).eq("evento", chave.evento).is("lido_em", null).is("resolvido_em", null);
  pendente = "refId" in chave ? pendente.eq("ref_id", chave.refId) : pendente.is("ref_id", null).eq("titulo", chave.titulo);
  const { data: jaExiste } = await pendente.order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (jaExiste?.id) {
    let { error: e2 } = await admin.from("avisos").update({ criado_em: new Date().toISOString(), titulo, url, texto, prioridade }).eq("id", jaExiste.id);
    // Sem a 0298 aplicada (coluna texto), o aviso sai só com o título — e com a prioridade nova.
    if (e2?.code === SEM_COLUNA) ({ error: e2 } = await admin.from("avisos").update({ criado_em: new Date().toISOString(), titulo, url, prioridade }).eq("id", jaExiste.id));
    if (e2) console.error("[avisos] não renovou:", e2.code, e2.message);
    return !e2;
  }
  const linha = {
    usuario_id: p.usuarioId,
    evento: p.evento,
    prioridade,
    titulo,
    url,
    ref_id: refId,
  };
  let { error } = await admin.from("avisos").insert({ ...linha, texto });
  if (error?.code === SEM_COLUNA) ({ error } = await admin.from("avisos").insert(linha));
  if (error) console.error("[avisos] não gravou:", error.code, error.message);
  // E586: dois avisos quase simultâneos passam os dois pela leitura acima; depois de gravar, junta num só.
  else await juntarPendentes(admin, p.usuarioId, chave, prioridade);
  return !error;
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * E1228: a estadia do contrato — o início do 1.º bloco e a saída. Falha de leitura: sem datas (o VN-CT no lugar).
 * E1239 (ORDEM-DUET-1200): a SAÍDA é a regra da casa (E599/E1089) — entrada + prazo_total_dias (dataDeSaida), a data
 * que a página do contrato mostra; nunca o fim do último bloco, que é a última NOITE (um dia antes). Sem o prazo lido,
 * nenhuma saída (ORDEM-DUET-1203): o título degrada para o VN-CT — uma data errada num aviso crítico é pior que nenhuma.
 */
async function estadiaDoContrato(admin: Admin, contratoId: string): Promise<{ entrada: string | null; saida: string | null }> {
  try {
    const { data, error } = await admin.from("contrato_blocos").select("numero_bloco, inicio, fim").eq("contrato_id", contratoId);
    const blocos = ((data ?? []) as { numero_bloco: number; inicio: string | null; fim: string | null }[]).slice().sort((a, b) => Number(a.numero_bloco) - Number(b.numero_bloco));
    if (error || !blocos.length) return { entrada: null, saida: null };
    const entrada = blocos[0].inicio ?? null;
    const { data: c } = await admin.from("contratos").select("prazo_total_dias").eq("id", contratoId).maybeSingle();
    const prazo = Number((c as { prazo_total_dias?: number | string | null } | null)?.prazo_total_dias);
    if (entrada && Number.isFinite(prazo) && prazo > 0) return { entrada, saida: dataDeSaida(entrada, prazo) };
    return { entrada, saida: null };
  } catch {
    return { entrada: null, saida: null };
  }
}

/**
 * E586: os pendentes repetidos da mesma chave viram um só (o mais antigo, com a hora renovada). Nunca lança.
 * E1251: a linha que fica leva também a prioridade de quem acabou de gravar (a do último).
 */
async function juntarPendentes(admin: Admin, usuarioId: string, chave: ReturnType<typeof chaveDoAvisoPendente>, prioridade: PrioridadeAviso): Promise<void> {
  try {
    let q = admin.from("avisos").select("id, criado_em").eq("usuario_id", usuarioId).eq("evento", chave.evento).is("lido_em", null).is("resolvido_em", null);
    q = "refId" in chave ? q.eq("ref_id", chave.refId) : q.is("ref_id", null).eq("titulo", chave.titulo);
    const { data, error } = await q.limit(20);
    if (error) return;
    const d = duplicatasDoPendente((data ?? []) as { id: string; criado_em: string }[]);
    if (!d || !d.apagar.length) return;
    const { error: e1 } = await admin.from("avisos").delete().in("id", d.apagar).eq("usuario_id", usuarioId).is("lido_em", null);
    if (e1) return console.error("[avisos] não juntou:", e1.code, e1.message);
    await admin.from("avisos").update({ criado_em: new Date().toISOString(), prioridade }).eq("id", d.manter);
  } catch {
    /* juntar é melhoria: o aviso já foi gravado */
  }
}

/** A ação do evento foi feita (assinou, respondeu, confirmou): marca "resolvido" nos avisos pendentes daquele objeto. */
export async function resolverAvisos(p: { usuarioId: string; eventos: NotificationEvent[]; refId: string }): Promise<void> {
  const admin = createAdminClient();
  if (!admin || !p.usuarioId || !REF_RE.test(p.refId) || !p.eventos.length) return;
  const { error } = await admin
    .from("avisos")
    .update({ resolvido_em: new Date().toISOString() })
    .eq("usuario_id", p.usuarioId)
    .eq("ref_id", p.refId)
    .in("evento", p.eventos)
    .is("resolvido_em", null);
  if (error) console.error("[avisos] não resolveu:", error.code, error.message);
}

/**
 * E1128: o sino conferiu o estado atual e estes avisos da pessoa já não valem (a visita de avaliação deixou de estar por
 * acontecer): grava "resolvido" para todas as telas concordarem. Só os avisos da própria pessoa. Nunca lança.
 */
export async function gravarResolucaoConferida(p: { usuarioId: string; ids: readonly string[] }): Promise<void> {
  try {
    const admin = createAdminClient();
    const ids = p.ids.filter((id) => UUID_RE.test(id)).slice(0, 60);
    if (!admin || !p.usuarioId || !ids.length) return;
    const { error } = await admin.from("avisos").update({ resolvido_em: new Date().toISOString() }).eq("usuario_id", p.usuarioId).in("id", ids).is("resolvido_em", null);
    if (error) console.error("[avisos] não gravou a resolução conferida:", error.code, error.message);
  } catch {
    /* gravar é melhoria: o sino já mostra o estado conferido */
  }
}
