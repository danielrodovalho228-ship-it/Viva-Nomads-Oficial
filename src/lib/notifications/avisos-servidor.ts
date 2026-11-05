import { createAdminClient } from "@/lib/supabase/admin";
import { TEMPLATES, type NotificationEvent } from "./eventos-email";
import { chaveDoAvisoPendente, prioridadeDoAviso, textoDoAviso, tituloComImovel, tituloDoAviso, urlDoAviso, type PapelAviso, type PrioridadeAviso } from "./avisos";
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
  // Fonte única: o assunto do catálogo (ou o título já montado), mais o nome do imóvel quando o evento tem imóvel.
  let titulo = p.titulo ? tituloDoAviso(guardContactInfo(p.titulo).text) : tituloDoAviso(base.subject);
  // E482: também com título montado (a mensagem nova nomeia o imóvel); tituloComImovel não repete um nome já presente.
  if (p.imovelId && UUID_RE.test(p.imovelId)) {
    const { data: im } = await admin.from("properties").select("title").eq("id", p.imovelId).maybeSingle();
    const nome = (im?.title as string | null) ?? null;
    if (nome) titulo = tituloComImovel(titulo, guardContactInfo(nome).text);
  }
  const texto = p.texto ? textoDoAviso(guardContactInfo(p.texto).text) : null;
  const refId = p.refId && REF_RE.test(p.refId) ? p.refId : null;
  const url = urlDoAviso(p.url ?? base.path);
  // E550: o mesmo aviso pendente (não lido, não resolvido) é renovado, não repetido.
  const chave = chaveDoAvisoPendente({ evento: p.evento, refId, titulo });
  let pendente = admin.from("avisos").select("id").eq("usuario_id", p.usuarioId).eq("evento", chave.evento).is("lido_em", null).is("resolvido_em", null);
  pendente = "refId" in chave ? pendente.eq("ref_id", chave.refId) : pendente.is("ref_id", null).eq("titulo", chave.titulo);
  const { data: jaExiste } = await pendente.order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (jaExiste?.id) {
    let { error: e2 } = await admin.from("avisos").update({ criado_em: new Date().toISOString(), titulo, url, texto }).eq("id", jaExiste.id);
    // Sem a 0298 aplicada (coluna texto), o aviso sai só com o título.
    if (e2?.code === SEM_COLUNA) ({ error: e2 } = await admin.from("avisos").update({ criado_em: new Date().toISOString(), titulo, url }).eq("id", jaExiste.id));
    if (e2) console.error("[avisos] não renovou:", e2.code, e2.message);
    return !e2;
  }
  const linha = {
    usuario_id: p.usuarioId,
    evento: p.evento,
    prioridade: p.prioridade ?? prioridadeDoAviso(p.evento, p.papel),
    titulo,
    url,
    ref_id: refId,
  };
  let { error } = await admin.from("avisos").insert({ ...linha, texto });
  if (error?.code === SEM_COLUNA) ({ error } = await admin.from("avisos").insert(linha));
  if (error) console.error("[avisos] não gravou:", error.code, error.message);
  return !error;
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
