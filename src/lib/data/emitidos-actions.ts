"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirAdminAal2 } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { consumirLimite } from "@/lib/limites";
import { reenviarEmailDoDocumento } from "@/lib/fiscal/emitir";
import { PREFIXOS, type Prefixo } from "@/lib/fiscal/prefixos";
import {
  EMITIDOS_MAX,
  ERRO_LIMITE_REENVIO,
  LIMITE_REENVIO_ADMIN,
  LIMITE_REENVIO_DOCUMENTO,
  mascararEmail,
  periodoEmInstantes,
  resultadoParaRegistro,
  situacaoEnvio,
  type FiltrosEmitidos,
  type SituacaoEnvio,
} from "@/lib/fiscal/emitidos";

/*
  L2-B item 14 — Admin › Documentos › aba "Emitidos". Lista os documentos do registro (documentos_registro) com o
  status do envio (documentos_fiscais.envio, por papel, sem endereço) e o destinatário mascarado. "Reenviar e-mail":
  só admin com 2FA, com limite (consumir_limite) e registro em documentos_reenvios (0241). Nada é reemitido.
*/

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

export interface DocumentoEmitido {
  id: string;
  numero: string;
  versao: number;
  prefixo: string;
  tipoRotulo: string;
  destinatarios: string[];
  emitidoEm: string;
  status: string;
  envio: SituacaoEnvio;
  reenvios: number;
  teste: boolean;
}

export async function listarEmitidos(f: FiltrosEmitidos): Promise<DocumentoEmitido[]> {
  const c = await contexto();
  if (!c) return [];
  let q = c.admin
    .from("documentos_registro")
    .select("id, prefixo, numero, versao, tipo, ref_tabela, ref_id, status, emitido_em, partes, is_teste")
    .order("emitido_em", { ascending: false })
    .limit(EMITIDOS_MAX);
  if (f.tipo) q = q.eq("prefixo", f.tipo);
  const { desde, antes } = periodoEmInstantes(f);
  if (desde) q = q.gte("emitido_em", desde);
  if (antes) q = q.lt("emitido_em", antes);
  const { data } = await q;
  const linhas = (data ?? []) as { id: string; prefixo: string; numero: string; versao: number; tipo: string; ref_tabela: string; ref_id: string; status: string; emitido_em: string; partes: string[] | null; is_teste: boolean }[];
  if (!linhas.length) return [];
  const fiscais = linhas.filter((l) => l.ref_tabela === "documentos_fiscais").map((l) => l.ref_id);
  const pessoas = [...new Set(linhas.flatMap((l) => l.partes ?? []))];
  const [envios, perfis, reenvios] = await Promise.all([
    fiscais.length ? c.admin.from("documentos_fiscais").select("id, envio").in("id", fiscais) : Promise.resolve({ data: [] }),
    pessoas.length ? c.admin.from("profiles").select("id, email").in("id", pessoas) : Promise.resolve({ data: [] }),
    c.admin.from("documentos_reenvios").select("registro_id").in("registro_id", linhas.map((l) => l.id)),
  ]);
  const envioPorDoc = new Map(((envios.data ?? []) as { id: string; envio: { papel: string; status: string }[] | null }[]).map((d) => [d.id, d.envio]));
  const emailPorPessoa = new Map(((perfis.data ?? []) as { id: string; email: string | null }[]).map((p) => [p.id, p.email]));
  const contagem = new Map<string, number>();
  for (const r of (reenvios.data ?? []) as { registro_id: string }[]) contagem.set(r.registro_id, (contagem.get(r.registro_id) ?? 0) + 1);
  return linhas.map((l) => ({
    id: l.id,
    numero: l.numero,
    versao: l.versao,
    prefixo: l.prefixo,
    tipoRotulo: PREFIXOS[l.prefixo as Prefixo]?.rotulo ?? l.tipo,
    destinatarios: (l.partes ?? []).map((p) => mascararEmail(emailPorPessoa.get(p)) ?? "sem e-mail no cadastro"),
    emitidoEm: l.emitido_em,
    status: l.status,
    envio: situacaoEnvio(l.ref_tabela, envioPorDoc.get(l.ref_id) ?? null, l.status),
    reenvios: contagem.get(l.id) ?? 0,
    teste: l.is_teste,
  }));
}

/**
 * "Reenviar e-mail" (com confirmação na tela): o MESMO documento às duas partes. Limite por documento e por admin
 * (falha fechada); cada reenvio vira uma linha em documentos_reenvios com o resultado por papel.
 */
export async function reenviarEmitido(registroId: string): Promise<Res<{ numero: string; enviados: number; total: number }>> {
  if (!UUID.test(String(registroId))) return { ok: false, error: "Documento inválido." };
  const c = await contexto();
  if (!c) return { ok: false, error: "Só admin." };
  const { data: reg } = await c.admin.from("documentos_registro").select("id, numero, ref_tabela, ref_id, status").eq("id", registroId).maybeSingle();
  if (!reg) return { ok: false, error: "Documento não encontrado." };
  const situacao = situacaoEnvio(reg.ref_tabela as string, null, reg.status as string);
  if (!situacao.podeReenviar) return { ok: false, error: reg.status === "anulado" ? "Documento anulado: não se reenvia." : "Este tipo de documento não sai por e-mail." };
  const porDocumento = await consumirLimite(`reenvio_documento:${registroId}`, LIMITE_REENVIO_DOCUMENTO.maximo, LIMITE_REENVIO_DOCUMENTO.janelaSegundos);
  const porAdmin = porDocumento && (await consumirLimite(`reenvio_documento_admin:${c.userId}`, LIMITE_REENVIO_ADMIN.maximo, LIMITE_REENVIO_ADMIN.janelaSegundos));
  if (!porDocumento || !porAdmin) return { ok: false, error: ERRO_LIMITE_REENVIO };
  const r = await reenviarEmailDoDocumento(reg.ref_id as string, { todos: true });
  await c.admin.from("documentos_reenvios").insert({
    registro_id: reg.id,
    documento_id: reg.ref_id,
    numero: reg.numero,
    admin_id: c.userId,
    resultado: r.ok ? resultadoParaRegistro(r.envio) : [{ papel: "todos", status: "erro", em: new Date().toISOString() }],
  });
  const erro = r.ok ? (r.envio.find((e) => e.status === "erro")?.erro ?? null) : r.motivo;
  await logModeracao(c.admin, c.userId, erro ? "documento_reenvio_falhou" : "documento_reenviado", "documento", reg.id as string, erro ?? (reg.numero as string));
  revalidatePath("/admin/documentos");
  if (!r.ok) return { ok: false, error: `Não saiu: ${r.motivo}` };
  const enviados = r.envio.filter((e) => e.status === "enviado").length;
  if (erro) return { ok: false, error: `E-mail não enviado a todos: ${erro}` };
  return { ok: true, numero: r.numero, enviados, total: r.envio.length };
}
