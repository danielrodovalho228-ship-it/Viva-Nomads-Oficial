import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { ALVO_VIDEO, ERRO_LINK_FORMATO, ERRO_LINK_SEM_CONEXAO, linkAprovado, oembedDoLink, resultadoOembed, statusOembedLab, type ResultadoLink } from "@/lib/fotos/conteudo";

/*
  E133 (d) — o link do YouTube/Vimeo. Conferir: só formato da plataforma e vídeo que existe e pode ser incorporado
  (oEmbed do provedor; no laboratório, resposta fixa sem rede). Mostrar: só o link que o admin aprovou (moderacao_log,
  que só o admin grava — o dono não consegue se aprovar). Sem migração.
*/
export async function verificarLinkVideo(url: string): Promise<ResultadoLink> {
  const o = oembedDoLink(url);
  if (!o) return { ok: false, erro: ERRO_LINK_FORMATO };
  if (integracoesSimuladas()) return resultadoOembed(statusOembedLab(o.id), o.provedor);
  try {
    const r = await fetch(o.endereco, { signal: AbortSignal.timeout(6_000), cache: "no-store" });
    return resultadoOembed(r.status, o.provedor);
  } catch {
    return { ok: false, erro: ERRO_LINK_SEM_CONEXAO };
  }
}

/** O link deste anúncio foi aprovado pelo admin? (a última decisão sobre ESTE link). */
export async function linkDeVideoAprovado(propertyId: string, url: string | null | undefined): Promise<boolean> {
  if (!url) return false;
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin.from("moderacao_log").select("acao, motivo, criado_em").eq("alvo_tipo", ALVO_VIDEO).eq("alvo_id", propertyId);
  return linkAprovado(url, (data ?? []) as { acao: string; motivo: string | null; criado_em: string }[]);
}
