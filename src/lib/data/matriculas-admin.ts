"use server";

import { revalidatePath } from "next/cache";
import { revalidarAnuncio } from "@/lib/anuncio/revalidar";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { erroConflitoInteresse } from "@/lib/moderacao/conflito-interesse";
import { motivoBloqueioAprovacao } from "@/lib/documento-pessoa";
import { lerDocumento } from "@/lib/data/documento-servidor";
import { montarDecisaoDocumento } from "./decisao-documento";
import { avisarDecisoesDoImovel } from "@/lib/data/aviso-decisao-documento";
import { primeiroNome } from "@/lib/display-name";
import { tipoVisualizacaoDoc, type VisualizacaoDoc } from "@/lib/moderacao-doc";
import { CASOS_DONO } from "@/lib/documento/conferencia-matricula";
import { contarMatriculas, proprietariosParaAdmin, ROTULO_MOTIVO, ROTULO_ONUS, ROTULO_RESULTADO, type ContadoresMatricula } from "@/lib/documento/fila-matricula";

type ActionResult = { ok: boolean; demo?: boolean; error?: string };
const BUCKET = "property-docs";
const SIGNED_TTL = 60 * 10;

export interface MatriculaNaFila {
  id: string;
  ownerNome: string;
  tituloImovel: string | null;
  criadaEm: string;
  resultado: string;
  resultadoRotulo: string;
  motivoRotulo: string | null;
  arquivoUrl: string | null;
  arquivoTipo: VisualizacaoDoc;
  /** Resumo do que foi lido: endereço, unidade, áreas, vaga, último ato. */
  resumo: string[];
  proprietarios: string[];
  onus: string[];
  /** Laudo CAF: só os booleanos (nunca o OCR). null = sem laudo válido. */
  caf: { identidade: boolean; documento: boolean; provaDeVida: boolean; simulado: boolean } | null;
  caso: string | null;
  casoUrl: string | null;
  casoTipo: VisualizacaoDoc;
}

async function soAdmin() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return null;
  const admin = createAdminClient();
  return admin ? { supabase, admin, user } : null;
}

const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Matrículas para a equipe (prompt 19): em revisão e prováveis ainda sem decisão (amostra), a mais antiga primeiro.
 * A matrícula abre por URL assinada curta (bucket privado); do laudo CAF só os booleanos.
 */
export async function listMatriculasFila(limite = 40): Promise<MatriculaNaFila[]> {
  const ctx = await soAdmin();
  if (!ctx) return [];
  const { admin } = ctx;
  const { data } = await admin
    .from("property_ownership_checks")
    .select("id, user_id, property_id, arquivo_path, resultado, motivo, campos_extraidos, onus, caf_ok, caf_simulado, caso, caso_documento_path, criada_em")
    .in("resultado", ["em_revisao", "provavel"])
    .is("revisado_em", null)
    .order("criada_em", { ascending: true })
    .limit(Math.min(100, Math.max(1, limite)));
  const out: MatriculaNaFila[] = [];
  for (const r of data ?? []) {
    const [{ data: perfil }, prop, arq, casoArq, laudo] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", r.user_id as string).maybeSingle(),
      r.property_id ? admin.from("properties").select("title").eq("id", r.property_id as string).maybeSingle() : Promise.resolve({ data: null }),
      admin.storage.from(BUCKET).createSignedUrl(r.arquivo_path as string, SIGNED_TTL),
      r.caso_documento_path ? admin.storage.from(BUCKET).createSignedUrl(r.caso_documento_path as string, SIGNED_TTL) : Promise.resolve({ data: null }),
      admin
        .from("tenant_verifications")
        .select("caf_result")
        .eq("tenant_id", r.user_id as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const c = (r.campos_extraidos ?? {}) as Record<string, unknown>;
    const end = (c.endereco && typeof c.endereco === "object" ? c.endereco : {}) as Record<string, unknown>;
    const resumo = [
      [end.rua, end.numero, end.bairro, end.cidade].map(txt).filter(Boolean).join(", "),
      txt(c.unidade) ? `Unidade: ${c.unidade}` : null,
      typeof c.area_privativa === "number" ? `Área privativa: ${c.area_privativa} m²` : null,
      typeof c.area_total === "number" ? `Área total: ${c.area_total} m²` : null,
      txt(c.vaga) ? `Vaga: ${c.vaga}` : null,
      txt(c.data_ultimo_ato) ? `Último ato: ${new Date(`${c.data_ultimo_ato}T12:00:00Z`).toLocaleDateString("pt-BR")}` : null,
    ].filter((x): x is string => !!x);
    const onus = (Array.isArray(r.onus) ? r.onus : [])
      .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
      .map((o) => [ROTULO_ONUS[String(o.tipo)] ?? "Ônus", txt(o.credor), o.emFavorDeTerceiro === true ? "em favor de terceiro" : null].filter(Boolean).join(" · "));
    const cr = ((laudo as { data: { caf_result?: Record<string, unknown> } | null }).data?.caf_result ?? null) as Record<string, unknown> | null;
    out.push({
      id: r.id as string,
      ownerNome: primeiroNome(perfil?.full_name as string | undefined) || "Proprietário",
      tituloImovel: ((prop as { data: { title?: string } | null }).data?.title as string | undefined) ?? null,
      criadaEm: r.criada_em as string,
      resultado: r.resultado as string,
      resultadoRotulo: ROTULO_RESULTADO[r.resultado as string] ?? (r.resultado as string),
      motivoRotulo: r.motivo ? (ROTULO_MOTIVO[r.motivo as string] ?? (r.motivo as string)) : null,
      arquivoUrl: (arq as { data: { signedUrl?: string } | null }).data?.signedUrl ?? null,
      arquivoTipo: tipoVisualizacaoDoc(r.arquivo_path as string),
      resumo,
      proprietarios: proprietariosParaAdmin(c),
      onus,
      caf: cr ? { identidade: cr.identity === true, documento: cr.document === true, provaDeVida: cr.liveness === true, simulado: cr.simulado === true } : null,
      caso: r.caso ? (CASOS_DONO.find((x) => x.valor === r.caso)?.rotulo ?? (r.caso as string)) : null,
      casoUrl: (casoArq as { data: { signedUrl?: string } | null }).data?.signedUrl ?? null,
      casoTipo: tipoVisualizacaoDoc((r.caso_documento_path as string | null) ?? null),
    });
  }
  return out;
}

/** Contadores dos últimos 30 dias: conferidos automático / prováveis / em revisão / tempo médio da equipe. */
export async function contadoresMatriculas(): Promise<ContadoresMatricula> {
  const zero: ContadoresMatricula = { conferidos: 0, provaveis: 0, emRevisao: 0, tempoMedioHoras: null };
  const ctx = await soAdmin();
  if (!ctx) return zero;
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await ctx.admin.from("property_ownership_checks").select("resultado, criada_em, revisado_em").gte("criada_em", desde).limit(5000);
  return contarMatriculas((data ?? []) as { resultado: string; criada_em: string; revisado_em: string | null }[]);
}

/**
 * Decisão da equipe sobre uma matrícula: Aprovar (selo e publicação), Pedir documento (motivo da tabela — o dono
 * vê "Corrija" e reenvia) ou Recusar. Vale também para as "prováveis" já aprovadas (amostra). Só admin, nunca a
 * própria conta. A qualificação ligada (mesmo arquivo) recebe a mesma decisão.
 */
export async function decidirMatriculaAdmin(id: string, acao: "aprovar" | "pedir" | "recusar", motivo?: string): Promise<ActionResult> {
  const ctx = await soAdmin();
  if (!ctx) return { ok: false, error: "Sem permissão." };
  const { supabase, admin, user } = ctx;
  const motivoLimpo = (motivo ?? "").trim().slice(0, 500);
  if (acao !== "aprovar" && !motivoLimpo) return { ok: false, error: "Escolha o motivo." };

  const { data: alvo } = await admin
    .from("property_ownership_checks")
    .select("id, user_id, property_id, arquivo_path, resultado")
    .eq("id", id)
    .maybeSingle();
  if (!alvo) return { ok: false, error: "Matrícula não encontrada." };
  const conflito = erroConflitoInteresse(alvo.user_id as string, user.id);
  if (conflito) return { ok: false, error: conflito };
  if (acao === "aprovar") {
    const bloqueio = motivoBloqueioAprovacao(await lerDocumento(admin, alvo.user_id as string));
    if (bloqueio) return { ok: false, error: bloqueio };
  }

  const agora = new Date();
  const { error } = await admin
    .from("property_ownership_checks")
    .update({
      resultado: acao === "aprovar" ? "conferido" : acao === "recusar" ? "recusado" : "em_revisao",
      revisao_motivo: acao === "aprovar" ? null : motivoLimpo,
      revisado_por: user.id,
      revisado_em: agora.toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Não foi possível salvar a decisão." };

  const decisao = montarDecisaoDocumento(acao === "aprovar", motivoLimpo, user.id, agora);
  await admin
    .from("qualification_checklists")
    .update({ ...decisao, conferido_por: acao === "aprovar" ? "equipe" : null, revisao_ate: null })
    .eq("owner_id", alvo.user_id as string)
    .eq("document_path", alvo.arquivo_path as string)
    .neq("owner_id", user.id);
  revalidarAnuncio(alvo.property_id as string | null, revalidatePath);
  revalidatePath("/admin/documentos");
  await logModeracao(supabase, user.id, `matricula_${acao}`, "matricula", id, acao === "aprovar" ? null : motivoLimpo);

  // Aviso agrupado por imóvel (rota rápida dos e-mails, item 3b): sai quando o último documento do imóvel é decidido.
  await avisarDecisoesDoImovel(admin, alvo.user_id as string, (alvo.property_id as string | null) ?? null);
  return { ok: true };
}

