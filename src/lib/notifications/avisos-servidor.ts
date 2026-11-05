import { createAdminClient } from "@/lib/supabase/admin";
import { TEMPLATES, type NotificationEvent } from "./eventos-email";
import { prioridadeDoAviso, tituloDoAviso, urlDoAviso, type PapelAviso, type PrioridadeAviso } from "./avisos";
import { guardContactInfo } from "@/lib/messages/contact-guard";

/*
  E444 — gravação e resolução dos avisos do sino (servidor, service role). Best-effort: nunca derruba o envio do e-mail
  nem a ação da pessoa. Sem a migração 0286 aplicada, a gravação falha em silêncio (só registra no log).
*/
const REF_RE = /^[\w-]{1,80}$/;

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
}): Promise<boolean> {
  const admin = createAdminClient();
  const base = TEMPLATES[p.evento];
  if (!admin || !base || !p.usuarioId) return false;
  const { error } = await admin.from("avisos").insert({
    usuario_id: p.usuarioId,
    evento: p.evento,
    prioridade: p.prioridade ?? prioridadeDoAviso(p.evento, p.papel),
    // Fonte única: o assunto do catálogo — nunca o assunto montado com título de imóvel, nome, contato ou valor.
    titulo: p.titulo ? tituloDoAviso(guardContactInfo(p.titulo).text) : tituloDoAviso(base.subject),
    url: urlDoAviso(p.url ?? base.path),
    ref_id: p.refId && REF_RE.test(p.refId) ? p.refId : null,
  });
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
