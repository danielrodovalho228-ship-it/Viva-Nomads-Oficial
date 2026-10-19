"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirAdminAal2 } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { emitirDoPagamentoComRegistro, emitirTermoDevolucaoComRegistro, pagamentosConfirmadosSemDocumento, reenviarEmailDoDocumento } from "@/lib/fiscal/emitir";

/*
  Admin › Documentos › "Documentos com falha" (complemento da jornada de assinatura, 19/10): a fila das emissões
  que não saíram, com o motivo, o botão "Emitir de novo" e o retroativo "Emitir os pendentes" (pagamentos já
  confirmados pelo inquilino que ficaram sem recibo — os 2 da jornada de teste de 18 e 19/10).
*/

export interface FalhaDocumento {
  id: string;
  pagamentoId: string | null;
  acertoId: string | null;
  /** "emissao" → "Emitir de novo"; "envio" → "Reenviar e-mail" (o documento já existe). */
  etapa: "emissao" | "envio";
  documentoId: string | null;
  motivo: string;
  tentativas: number;
  criadoEm: string;
  atualizadoEm: string;
}

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function contexto() {
  const sessao = await createClient();
  const admin = createAdminClient();
  if (!sessao || !admin) return null;
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user || !(await exigirAdminAal2(sessao, user.id))) return null;
  return { admin, userId: user.id };
}

export async function listarFalhasDocumentos(): Promise<{ falhas: FalhaDocumento[]; pendentes: number }> {
  const c = await contexto();
  if (!c) return { falhas: [], pendentes: 0 };
  const [{ data }, pendentes] = await Promise.all([
    c.admin
      .from("documentos_falhas")
      .select("id, pagamento_id, acerto_id, etapa, documento_id, motivo, tentativas, criado_em, atualizado_em")
      .is("resolvido_em", null)
      .order("criado_em", { ascending: false })
      .limit(100),
    pagamentosConfirmadosSemDocumento(c.admin),
  ]);
  const falhas = ((data ?? []) as Record<string, unknown>[]).map((f) => ({
    id: String(f.id),
    pagamentoId: (f.pagamento_id as string | null) ?? null,
    acertoId: (f.acerto_id as string | null) ?? null,
    etapa: (f.etapa === "envio" ? "envio" : "emissao") as FalhaDocumento["etapa"],
    documentoId: (f.documento_id as string | null) ?? null,
    motivo: String(f.motivo),
    tentativas: Number(f.tentativas ?? 1),
    criadoEm: String(f.criado_em),
    atualizadoEm: String(f.atualizado_em),
  }));
  return { falhas, pendentes: pendentes.length };
}

/** "Emitir de novo" de uma linha da fila. */
export async function emitirDeNovo(falhaId: string): Promise<Res<{ numero: string }>> {
  if (!UUID.test(String(falhaId))) return { ok: false, error: "Item inválido." };
  const c = await contexto();
  if (!c) return { ok: false, error: "Só admin." };
  const { data: f } = await c.admin.from("documentos_falhas").select("pagamento_id, acerto_id, etapa").eq("id", falhaId).maybeSingle();
  if (!f) return { ok: false, error: "Item não encontrado." };
  // O documento já existe: emitir de novo devolveria o mesmo, sem mandar o e-mail. O caminho é "Reenviar e-mail".
  if (f.etapa === "envio") return { ok: false, error: "O documento já foi emitido: use “Reenviar e-mail”." };
  const r = f.pagamento_id ? await emitirDoPagamentoComRegistro(f.pagamento_id as string) : await emitirTermoDevolucaoComRegistro(f.acerto_id as string);
  await logModeracao(c.admin, c.userId, r.ok ? "documento_emitido_de_novo" : "documento_falhou_de_novo", "documento", falhaId, r.ok ? r.numero : r.motivo);
  revalidatePath("/admin/documentos");
  return r.ok ? { ok: true, numero: r.numero } : { ok: false, error: `Não saiu de novo: ${r.motivo}` };
}

/**
 * "Reenviar e-mail" de uma falha de ENVIO: manda de novo o mesmo PDF (mesmo número, mesmo código de conferência) a
 * quem ainda não recebeu. Não emite documento novo.
 */
export async function reenviarEmail(falhaId: string): Promise<Res<{ numero: string; enviados: number; total: number }>> {
  if (!UUID.test(String(falhaId))) return { ok: false, error: "Item inválido." };
  const c = await contexto();
  if (!c) return { ok: false, error: "Só admin." };
  const { data: f } = await c.admin.from("documentos_falhas").select("documento_id, etapa").eq("id", falhaId).maybeSingle();
  if (!f || f.etapa !== "envio" || !f.documento_id) return { ok: false, error: "Item não encontrado." };
  const r = await reenviarEmailDoDocumento(f.documento_id as string);
  const enviados = r.ok ? r.envio.filter((e) => e.status === "enviado").length : 0;
  const erro = r.ok ? r.envio.find((e) => e.status === "erro")?.erro ?? null : r.motivo;
  await logModeracao(c.admin, c.userId, erro ? "documento_email_falhou_de_novo" : "documento_email_reenviado", "documento", f.documento_id as string, erro ?? (r.ok ? r.numero : ""));
  revalidatePath("/admin/documentos");
  if (!r.ok) return { ok: false, error: `Não saiu de novo: ${r.motivo}` };
  if (erro) return { ok: false, error: `E-mail não enviado: ${erro}` };
  return { ok: true, numero: r.numero, enviados, total: r.envio.length };
}

/** Retroativo: emite os recibos dos pagamentos confirmados que ficaram sem documento. */
export async function emitirPendentes(): Promise<Res<{ emitidos: number; falharam: number }>> {
  const c = await contexto();
  if (!c) return { ok: false, error: "Só admin." };
  const ids = await pagamentosConfirmadosSemDocumento(c.admin);
  let emitidos = 0;
  let falharam = 0;
  for (const id of ids) {
    const r = await emitirDoPagamentoComRegistro(id);
    if (r.ok) emitidos++;
    else falharam++;
  }
  await logModeracao(c.admin, c.userId, "documentos_pendentes_emitidos", "documento", c.userId, `${emitidos} emitidos, ${falharam} com falha`);
  revalidatePath("/admin/documentos");
  return { ok: true, emitidos, falharam };
}
