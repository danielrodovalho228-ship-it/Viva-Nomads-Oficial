import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { numeroPublicoContrato } from "@/lib/contrato-ref";
import { sha256 } from "@/lib/fiscal/pdf";
import { conteudoCorrecao, conteudoFechamento, semResposta, type EstadoParaFechar, type MotivoFechamento } from "@/lib/fiscal/fechamento";
import { registrarDocumento } from "@/lib/fiscal/registro";
import { aoFecharConferencia } from "@/lib/automacao/servidor";

const BUCKET_CONFERENCIA = "conferencia";

/**
 * Fecha a conferência (Prompt 56, D5): lê itens, respostas e laudo, calcula o hash de cada foto e do laudo, grava o
 * hash de fechamento UMA vez (fechar_conferencia) e registra o documento CND com esse mesmo hash. Já fechada: nada.
 * Nunca lança (quem chama segue o fluxo dele).
 */
export async function fecharConferencia(admin: SupabaseClient, conferenciaId: string, motivo: MotivoFechamento): Promise<{ fechou: boolean; numero?: string }> {
  try {
    const { data: c } = await admin
      .from("conferencias")
      .select("id, tipo, contrato_id, fechada_em, contratos(tenant_id, properties(owner_id))")
      .eq("id", conferenciaId)
      .maybeSingle();
    if (!c || c.fechada_em) return { fechou: false };
    const [{ data: itens }, { data: respostas }, { data: laudo }] = await Promise.all([
      admin.from("conferencia_itens").select("parte, comodo, descricao, foto_path, criado_em, precisa_reparo").eq("conferencia_id", conferenciaId),
      admin.from("conferencia_respostas").select("parte, decisao, motivo, decidido_em").eq("conferencia_id", conferenciaId),
      admin.from("conferencia_laudos").select("path, parte, criado_em").eq("conferencia_id", conferenciaId).maybeSingle(),
    ]);
    const estado: EstadoParaFechar = {
      conferenciaId,
      contrato: numeroPublicoContrato(c.contrato_id as string),
      tipo: c.tipo as "entrada" | "saida",
      itens: ((itens ?? []) as { parte: "proprietario" | "inquilino"; comodo: string; descricao: string; foto_path: string | null; criado_em: string; precisa_reparo: boolean | null }[]).map((i) => ({
        parte: i.parte,
        comodo: i.comodo,
        descricao: i.descricao,
        fotoPath: i.foto_path,
        criadoEm: i.criado_em,
        precisaReparo: i.precisa_reparo === true,
      })),
      respostas: ((respostas ?? []) as { parte: "proprietario" | "inquilino"; decisao: string; motivo: string | null; decidido_em: string }[]).map((r) => ({
        parte: r.parte,
        decisao: r.decisao,
        motivo: r.motivo,
        decididoEm: r.decidido_em,
      })),
      laudo: laudo ? { path: laudo.path as string, parte: laudo.parte as "proprietario" | "inquilino", criadoEm: laudo.criado_em as string } : null,
      hashes: {},
    };
    // O hash de cada ARQUIVO (foto e laudo): trocar a foto depois muda o hash de fechamento.
    const caminhos = [...estado.itens.map((i) => i.fotoPath), estado.laudo?.path].filter((p): p is string => !!p);
    for (const p of caminhos) {
      const { data: arq } = await admin.storage.from(BUCKET_CONFERENCIA).download(p);
      if (arq) estado.hashes[p] = sha256(new Uint8Array(await arq.arrayBuffer()));
    }
    const texto = conteudoFechamento(estado, motivo);
    const hash = sha256(new TextEncoder().encode(texto));
    const { data: fechou } = await admin.rpc("fechar_conferencia", { p_id: conferenciaId, p_hash: hash, p_motivo: motivo, p_sem_resposta: semResposta(estado) });
    if (fechou !== true) return { fechou: false };
    const k = c.contratos as unknown as { tenant_id: string; properties: { owner_id: string } | null } | null;
    // CND com o mesmo hash do fechamento (o conteúdo não leva número nem código: é o retrato do que fechou).
    const reg = await registrarDocumento(admin, {
      prefixo: "CND",
      tipo: `conferencia_${estado.tipo}`,
      ref: { tabela: "conferencias", id: conferenciaId },
      partes: [k?.properties?.owner_id, k?.tenant_id],
      conteudo: () => texto,
    });
    // Prompt 38: na SAÍDA, os itens do dono marcados "precisa de reparo" viram o pedido de manutenção (modo confirmar).
    await aoFecharConferencia(admin, conferenciaId);
    return { fechou: true, numero: reg.numero };
  } catch (e) {
    console.error("[conferência] fechamento:", e instanceof Error ? e.message : e);
    return { fechou: false };
  }
}

/** Correção depois do fechamento: versão nova do CND (mesmo número, v2, v3…) com motivo; o fechamento não muda. */
export async function corrigirConferenciaFechada(admin: SupabaseClient, conferenciaId: string, motivo: string, texto: string, autorId: string): Promise<{ ok: true; versao: number } | { ok: false; erro: string }> {
  if (motivo.trim().length < 5) return { ok: false, erro: "Escreva o motivo da correção." };
  if (!texto.trim()) return { ok: false, erro: "Escreva a correção." };
  const { data: c } = await admin.from("conferencias").select("fechamento_hash, contratos(tenant_id, properties(owner_id))").eq("id", conferenciaId).maybeSingle();
  if (!c?.fechamento_hash) return { ok: false, erro: "A conferência ainda não foi fechada: corrija direto nela." };
  const { data: ultima } = await admin.from("conferencia_correcoes").select("versao").eq("conferencia_id", conferenciaId).order("versao", { ascending: false }).limit(1).maybeSingle();
  const versao = Number(ultima?.versao ?? 1) + 1;
  const conteudo = conteudoCorrecao({ fechamentoHash: c.fechamento_hash as string, versao, motivo, texto });
  const hash = sha256(new TextEncoder().encode(conteudo));
  const { error } = await admin.from("conferencia_correcoes").insert({ conferencia_id: conferenciaId, versao, motivo: motivo.trim(), texto: texto.trim(), hash, criado_por: autorId });
  if (error) return { ok: false, erro: "Não foi possível registrar a correção." };
  const k = c.contratos as unknown as { tenant_id: string; properties: { owner_id: string } | null } | null;
  await registrarDocumento(admin, {
    prefixo: "CND",
    tipo: "conferencia_correcao",
    ref: { tabela: "conferencias", id: conferenciaId },
    partes: [k?.properties?.owner_id, k?.tenant_id],
    emitidoPor: autorId,
    novaVersao: true,
    versao,
    conteudo: () => conteudo,
  });
  return { ok: true, versao };
}
