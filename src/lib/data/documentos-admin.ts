"use server";

import { montarDecisaoDocumento } from "./decisao-documento";
import { revalidatePath } from "next/cache";
import { revalidarAnuncio } from "@/lib/anuncio/revalidar";
import { createClient } from "@/lib/supabase/server";
import { avisarDecisoesDoImovel } from "@/lib/data/aviso-decisao-documento";
import { primeiroNome } from "@/lib/display-name";
import { tipoVisualizacaoDoc, type VisualizacaoDoc } from "@/lib/moderacao-doc";
import { ehAdmin } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { erroBancoPT } from "@/lib/erros-banco";
import { createAdminClient } from "@/lib/supabase/admin";
import { filaDocumentos } from "@/lib/data/admin-indicadores";
import { lerDocumento } from "@/lib/data/documento-servidor";
import { preConferir, type PreConferencia } from "@/lib/moderacao/pre-conferencia";
import { autorizacaoOk, exigeAutorizacao } from "@/lib/anuncio/operacao";
import { erroConflitoInteresse } from "@/lib/moderacao/conflito-interesse";
import { motivoBloqueioAprovacao } from "@/lib/documento-pessoa";
import { situacaoCnpj, titularPorOcr } from "@/lib/integrations/conferencia-doc";
import { mascararCpfParcial, REVISAO_PRAZO_HORAS } from "@/lib/documento/conferencia";

type ActionResult = { ok: boolean; demo?: boolean; error?: string };

const DOCS_BUCKET = "property-docs";
const SIGNED_TTL = 60 * 10; // 10 min — janela curta para o admin abrir o documento

export interface DocumentoPendente {
  id: string; // id da qualificação
  ownerId: string;
  ownerNome: string; // primeiro nome (exibição) — NUNCA o e-mail
  ownerNomeCompleto: string | null; // nome completo p/ conferir contra o documento
  refImovel: string | null; // endereço/imóvel do cadastro p/ comparação lado a lado
  tituloImovel: string | null; // título do anúncio, ao lado do nome do dono
  criadoEm: string | null;
  docUrl: string | null; // URL assinada curta para o admin abrir (nunca pública)
  docTipo: VisualizacaoDoc; // como exibir inline (imagem | pdf | outro)
  duplicado: number; // quantas OUTRAS contas enviaram o MESMO arquivo (sinal de fraude)
  /** Pré-conferência automática ("Parece OK" / "Atenção: …"). Só ajuda: quem decide é o admin. */
  preConferencia: PreConferencia | null;
  /** "own" | "subleased" | "managed" do imóvel ligado. */
  operacao: string | null;
  /** Autorização / contrato de administração / procuração (URL assinada curta). */
  autorizacaoUrl: string | null;
  autorizacaoTipo: VisualizacaoDoc;
  /** Nome do titular como o dono digitou. */
  titularInformado: string | null;
  /** Motivo pelo qual Aprovar fica desabilitado (dono sem CPF/CNPJ válido); null = liberado. */
  bloqueioAprovacao: string | null;
  /** Conferência automática (prompt 11): o motivo da IA e o checklist pré-marcado. null = enviado antes dela. */
  conferenciaIa: ConferenciaResumo | null;
  /** Prazo de 48 h da revisão (null = sem prazo). */
  revisaoAte: string | null;
}

export interface ConferenciaResumo {
  estado: string;
  motivos: string[];
  checklist: Record<string, boolean>;
  /** O que a IA leu, sem o CPF inteiro (só o trecho do meio, mascarado). */
  leitura: { tipo: string | null; titular: string | null; endereco: string | null; data: string | null; cpf: string | null; sinais: string[] } | null;
  conferidor: string | null;
  modelo: string | null;
}

/** Resumo seguro da trilha `conferencia` (jsonb) para a tela do admin. */
function resumoConferencia(c: unknown): ConferenciaResumo | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const l = (o.leitura && typeof o.leitura === "object" ? o.leitura : null) as Record<string, unknown> | null;
  const end = (l?.endereco && typeof l.endereco === "object" ? l.endereco : {}) as Record<string, unknown>;
  const txt = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    estado: txt(o.estado) ?? "revisao",
    motivos: Array.isArray(o.motivos)
      ? o.motivos.map((m) => (m && typeof m === "object" ? txt((m as Record<string, unknown>).texto) : txt(m))).filter((m): m is string => !!m)
      : [],
    checklist: (o.checklist && typeof o.checklist === "object" ? o.checklist : {}) as Record<string, boolean>,
    leitura: l
      ? {
          tipo: txt(l.tipo),
          titular: txt(l.titular),
          endereco: [end.rua, end.numero, end.bairro, end.cidade, end.cep].filter((x) => typeof x === "string" && x).join(", ") || null,
          data: txt(l.dataDocumento),
          cpf: txt(l.cpfCnpjParcial) ? mascararCpfParcial(l.cpfCnpjParcial as string) : null,
          sinais: Array.isArray(l.sinaisDeEdicao) ? (l.sinaisDeEdicao as unknown[]).filter((x): x is string => typeof x === "string") : [],
        }
      : null,
    conferidor: txt(o.conferidor),
    modelo: txt(o.modelo),
  };
}

/**
 * Fila de moderação (admin): documentos de imóvel aguardando verificação. A RLS
 * `is_admin()` (migration 0042) libera a leitura completa; para não-admin a
 * política devolve nada e a rota é gated pelo nav admin. Gera uma URL ASSINADA
 * curta por documento — o bucket é privado. O e-mail do dono NÃO é exposto ao
 * cliente (só o primeiro nome).
 */
export async function listDocumentosPendentes(): Promise<DocumentoPendente[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("qualification_checklists")
    .select("*")
    .eq("document_status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  // Pré-conferência lê CPF/CNPJ do dono e o documento da operação (fora do grant
  // do usuário) com o service role — SÓ depois de confirmar que quem pede é admin.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adm = user && (await ehAdmin(supabase, user.id)) ? createAdminClient() : null;

  // Um item por documento: re-salvar a qualificação repete o documento em
  // outra linha (0072) — mostra só a mais recente de cada (dono, imóvel, arquivo).
  const unicos = new Map<string, NonNullable<typeof data>[number]>();
  for (const r of data ?? []) unicos.set(`${r.owner_id}|${r.property_id ?? ""}|${r.document_path}`, r);

  const out: DocumentoPendente[] = [];
  for (const r of unicos.values()) {
    const ownerId = r.owner_id as string;
    const nomeCompleto = (
      await supabase.from("profiles").select("full_name").eq("id", ownerId).maybeSingle()
    ).data?.full_name as string | undefined;

    // Referência do imóvel (bairro/cidade do cadastro mais recente do dono) para
    // a conferência lado a lado — o admin compara com o que consta no documento.
    // O imóvel LIGADO à qualificação, quando houver; senão o mais recente do dono.
    let refImovel: string | null = null;
    const propQuery = supabase.from("properties").select("title, address, city");
    const { data: prop } = r.property_id
      ? await propQuery.eq("id", r.property_id as string).maybeSingle()
      : await propQuery
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
    if (prop) {
      // `address` é a coluna do bairro (não há coluna "neighborhood" — antes vinha vazio).
      const local = [prop.address, prop.city].filter(Boolean).join(", ");
      refImovel = [prop.title, local].filter(Boolean).join(" — ") || null;
    }

    // Reuso do MESMO arquivo em outros cadastros (impressão digital, 0044).
    let duplicado = 0;
    if (r.document_hash_sha256) {
      const { count } = await supabase
        .from("qualification_checklists")
        .select("id", { count: "exact", head: true })
        .eq("document_hash_sha256", r.document_hash_sha256 as string)
        .neq("owner_id", ownerId); // o próprio dono re-salvando (0072) não é fraude
      duplicado = count ?? 0;
    }

    let docUrl: string | null = null;
    if (r.document_path) {
      const { data: signed } = await supabase.storage
        .from(DOCS_BUCKET)
        .createSignedUrl(r.document_path as string, SIGNED_TTL);
      docUrl = signed?.signedUrl ?? null;
    }
    // ── Pré-conferência automática (só com o service role, já confirmado admin) ──
    const titular = ((r.formulario as { elig?: { titularDocumento?: unknown } } | null)?.elig?.titularDocumento ?? null) as string | null;
    let preConferencia: PreConferencia | null = null;
    let operacao: string | null = null;
    let autorizacaoUrl: string | null = null;
    let autorizacaoPath: string | null = null;
    let bloqueioAprovacao: string | null = null;
    if (adm) {
      const [docDono, { data: op }] = await Promise.all([
        lerDocumento(adm, ownerId),
        r.property_id
          ? adm.from("properties").select("owner_id, ownership_type, sublease_authorized, sublease_doc_url").eq("id", r.property_id as string).maybeSingle() // consistency-ignore: service role, só depois de ehAdmin; o caminho vira link assinado de 10 min para o admin
          : Promise.resolve({ data: null }),
      ]);
      bloqueioAprovacao = motivoBloqueioAprovacao(docDono);
      operacao = (op?.ownership_type as string | undefined) ?? null;
      if (op && exigeAutorizacao(operacao) && op.sublease_doc_url) {
        autorizacaoPath = op.sublease_doc_url as string;
        const { data: s } = await adm.storage.from(DOCS_BUCKET).createSignedUrl(autorizacaoPath, SIGNED_TTL);
        autorizacaoUrl = s?.signedUrl ?? null;
      }
      const [cnpj, ocr] = await Promise.all([
        docDono?.person_type === "pj" && docDono.cnpj ? situacaoCnpj(docDono.cnpj) : Promise.resolve({ valor: null, demo: false }),
        titularPorOcr(docUrl, titular),
      ]);
      preConferencia = preConferir({
        documentoDono: docDono,
        nomeConta: nomeCompleto ?? null,
        titularInformado: titular,
        duplicado,
        operacao,
        autorizacaoAnexada: op ? autorizacaoOk(op) : false,
        cnpjSituacao: cnpj.valor,
        ocrTitular: ocr.valor,
      });
    }
    out.push({
      id: r.id as string,
      ownerId,
      ownerNome: primeiroNome(nomeCompleto) || "Proprietário",
      ownerNomeCompleto: nomeCompleto || null,
      refImovel,
      tituloImovel: (prop?.title as string | undefined) || null,
      criadoEm: (r.created_at as string) ?? null,
      docUrl,
      docTipo: tipoVisualizacaoDoc(r.document_path as string | null),
      duplicado,
      preConferencia,
      operacao,
      autorizacaoUrl,
      autorizacaoTipo: tipoVisualizacaoDoc(autorizacaoPath),
      titularInformado: titular,
      bloqueioAprovacao,
      conferenciaIa: resumoConferencia((r as Record<string, unknown>).conferencia),
      revisaoAte: ((r as Record<string, unknown>).revisao_ate as string | null) ?? null,
    });
  }
  return out;
}

/**
 * "Na fila agora" (Prompt 29, item 9) — para o selo da barra lateral: documentos de imóvel em revisão + matrículas em
 * revisão, pela MESMA função da home e de /admin/documentos (filaDocumentos). Só admin; para os demais, 0.
 */
export async function countDocumentosPendentes(): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return 0;
  const admin = createAdminClient();
  if (!admin) return 0;
  return (await filaDocumentos(admin)).total;
}

/**
 * Admin APROVA ou RECUSA um documento (recusa exige motivo). Grava o desfecho +
 * quem/quando e NOTIFICA o proprietário por e-mail (layout-mãe) nos dois casos.
 * Só aprovado libera o botão Publicar do dono. A3: exige ADMIN aqui (antes só
 * confiava na RLS — e a regra do dono deixava ele aprovar o próprio documento) e
 * ninguém modera o PRÓPRIO documento. O banco reforça (0056).
 */
export async function moderarDocumento(
  qualId: string,
  aprovado: boolean,
  motivo?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  if (!(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };

  const motivoLimpo = (motivo ?? "").trim();
  if (!aprovado && !motivoLimpo) return { ok: false, error: "Informe o motivo da recusa." };

  // O mesmo documento pode estar em mais de uma linha "em análise": salvar a
  // qualificação de novo sem trocar o arquivo herda o documento (0072). A
  // decisão vale para TODAS essas linhas — senão a mais recente (a que o
  // editor lê) ficava pendente e o Publicar não liberava.
  const { data: alvo } = await supabase
    .from("qualification_checklists")
    .select("owner_id, property_id, document_path")
    .eq("id", qualId)
    .eq("document_status", "pending")
    .maybeSingle();
  if (!alvo?.document_path) return { ok: false, error: "Documento não encontrado na fila (ou sem permissão)." };
  const conflito = erroConflitoInteresse(alvo.owner_id as string, user.id);
  if (conflito) return { ok: false, error: conflito };
  // Aprovar exige CPF (PF) / CNPJ (PJ) válidos do dono (#39). Lê com o service
  // role — só depois de confirmado admin acima; o número não sai do servidor.
  if (aprovado) {
    const adm = createAdminClient();
    if (!adm) return { ok: false, error: "Não foi possível conferir o documento do dono agora." };
    const bloqueio = motivoBloqueioAprovacao(await lerDocumento(adm, alvo.owner_id as string));
    if (bloqueio) return { ok: false, error: bloqueio };
  }
  let upd = supabase
    .from("qualification_checklists")
    .update(montarDecisaoDocumento(aprovado, motivoLimpo, user.id, new Date()))
    .eq("owner_id", alvo.owner_id as string)
    .eq("document_path", alvo.document_path as string)
    .eq("document_status", "pending") // só modera o que está na fila
    .neq("owner_id", user.id); // ninguém aprova o próprio documento
  upd = alvo.property_id ? upd.eq("property_id", alvo.property_id as string) : upd.is("property_id", null);
  const { data: linhas, error } = await upd.select("owner_id");
  if (error) return { ok: false, error: erroBancoPT(error) };
  const qual = linhas?.[0];
  if (!qual) return { ok: false, error: "Documento não encontrado na fila (ou sem permissão)." };
  // Documento aprovado/recusado muda o que o público pode ver do anúncio (F9).
  revalidarAnuncio(alvo.property_id as string | null, revalidatePath);
  await logModeracao(
    supabase,
    user.id,
    aprovado ? "aprovar_documento" : "recusar_documento",
    "qualificacao",
    qualId,
    aprovado ? null : motivoLimpo
  );

  // Aviso ao proprietário (rota rápida dos e-mails, item 3b): um por imóvel, com o imóvel, o tipo e a decisão de
  // cada documento. Se ainda há documento do mesmo imóvel na fila, o aviso espera o último (best-effort).
  const adm = createAdminClient();
  if (adm) await avisarDecisoesDoImovel(adm, qual.owner_id as string, (alvo.property_id as string | null) ?? null);
  return { ok: true };
}

export interface ConferidoAutomatico {
  id: string;
  ownerNome: string;
  tituloImovel: string | null;
  criadoEm: string | null;
  docUrl: string | null;
  docTipo: VisualizacaoDoc;
  conferencia: ConferenciaResumo | null;
}

/**
 * Aba "Conferidos automaticamente" (prompt 11): os últimos documentos aprovados pela conferência automática, para
 * a equipe conferir por amostragem e reabrir qualquer um. Só admin.
 */
export async function listConferidosAutomaticamente(limite = 30): Promise<ConferidoAutomatico[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return [];
  const { data } = await supabase
    .from("qualification_checklists")
    .select("id, owner_id, property_id, document_path, created_at, conferencia")
    .eq("document_status", "approved")
    .eq("conferido_por", "automatico")
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limite)));
  const out: ConferidoAutomatico[] = [];
  for (const r of data ?? []) {
    const [{ data: perfil }, prop, signed] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", r.owner_id as string).maybeSingle(),
      r.property_id
        ? supabase.from("properties").select("title").eq("id", r.property_id as string).maybeSingle()
        : Promise.resolve({ data: null }),
      r.document_path ? supabase.storage.from(DOCS_BUCKET).createSignedUrl(r.document_path as string, SIGNED_TTL) : Promise.resolve({ data: null }),
    ]);
    out.push({
      id: r.id as string,
      ownerNome: primeiroNome(perfil?.full_name as string | undefined) || "Proprietário",
      tituloImovel: ((prop as { data: { title?: string } | null }).data?.title as string | undefined) ?? null,
      criadoEm: (r.created_at as string) ?? null,
      docUrl: (signed as { data: { signedUrl?: string } | null }).data?.signedUrl ?? null,
      docTipo: tipoVisualizacaoDoc(r.document_path as string | null),
      conferencia: resumoConferencia(r.conferencia),
    });
  }
  return out;
}

/** Contadores da conferência automática nos últimos 7 dias: aprovados, corrija e em revisão. Só admin. */
export async function contadoresConferencia(): Promise<{ automaticos: number; corrija: number; revisao: number }> {
  const zero = { automaticos: 0, corrija: 0, revisao: 0 };
  const supabase = await createClient();
  if (!supabase) return zero;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return zero;
  const desde = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("qualification_checklists")
    .select("conferencia")
    .not("conferencia", "is", null)
    .gte("created_at", desde)
    .limit(2000);
  const out = { ...zero };
  for (const r of data ?? []) {
    const e = (r.conferencia as { estado?: string } | null)?.estado;
    if (e === "aprovado") out.automaticos++;
    else if (e === "corrija") out.corrija++;
    else if (e === "revisao") out.revisao++;
  }
  return out;
}

/**
 * Reabre um documento aprovado automaticamente: volta para a fila ("em revisão", prazo de 48 h) e some o selo até
 * a equipe decidir. Só admin, nunca no próprio documento (o banco reforça — 0056/0072).
 */
export async function reabrirConferencia(qualId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  if (!(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };
  const { data: alvo } = await supabase
    .from("qualification_checklists")
    .select("owner_id, property_id")
    .eq("id", qualId)
    .eq("conferido_por", "automatico")
    .maybeSingle();
  if (!alvo) return { ok: false, error: "Documento não encontrado." };
  const conflito = erroConflitoInteresse(alvo.owner_id as string, user.id);
  if (conflito) return { ok: false, error: conflito };
  const { data, error } = await supabase
    .from("qualification_checklists")
    .update({
      document_status: "pending",
      document_review_reason: "Reaberto pela equipe para conferência.",
      document_reviewed_at: null,
      document_reviewed_by: null,
      conferido_por: null,
      revisao_ate: new Date(Date.now() + REVISAO_PRAZO_HORAS * 3_600_000).toISOString(),
    })
    .eq("id", qualId)
    .neq("owner_id", user.id)
    .select("id");
  if (error) return { ok: false, error: erroBancoPT(error) };
  if (!data?.length) return { ok: false, error: "Documento não encontrado." };
  revalidarAnuncio(alvo.property_id as string | null, revalidatePath);
  await logModeracao(supabase, user.id, "reabrir_documento", "qualificacao", qualId, null);
  return { ok: true };
}
