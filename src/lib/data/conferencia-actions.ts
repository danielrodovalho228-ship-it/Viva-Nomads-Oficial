"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, HORA } from "@/lib/limites";
import {
  decidirResposta,
  estadoConferencia,
  podeEditarItens,
  prazoEntrada,
  validarItem,
  type ParteConferencia,
  type RespostaConferencia,
  type TipoConferencia,
} from "@/lib/conferencia";

/*
  Conferência de entrada e de saída (ordem 404cd213, item 1). Toda escrita passa por aqui,
  com o cliente de serviço, DEPOIS de conferir no servidor que quem age é o inquilino do
  contrato ou o dono do imóvel. O banco repete a regra de imutabilidade (migração 0110).
*/

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_ENTRADA = ["ativo"];
const STATUS_SAIDA = ["ativo", "concluido", "encerrado_sem_renovacao"];

type Resultado = { ok: true; id?: string } | { ok: false; error: string };
const erro = (error: string): Resultado => ({ ok: false, error });

/** Quem é a pessoa neste contrato: "inquilino", "proprietario" ou null (não é parte). */
async function parteDoContrato(contratoId: string): Promise<{ uid: string; parte: ParteConferencia; status: string; inicio: string | null } | null> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin || !UUID_RE.test(contratoId)) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: c } = await admin
    .from("contratos")
    .select("tenant_id, status, properties(owner_id), contrato_blocos(inicio)")
    .eq("id", contratoId)
    .maybeSingle();
  if (!c) return null;
  const donoId = (c.properties as unknown as { owner_id?: string } | null)?.owner_id;
  const parte: ParteConferencia | null = c.tenant_id === user.id ? "inquilino" : donoId === user.id ? "proprietario" : null;
  if (!parte) return null;
  const inicios = ((c.contrato_blocos ?? []) as { inicio: string }[]).map((b) => b.inicio).sort();
  return { uid: user.id, parte, status: String(c.status), inicio: inicios[0] ?? null };
}

/** Registra um item (cômodo + descrição + foto opcional) na conferência; cria a conferência na primeira vez. */
export async function registrarItemConferencia(input: {
  contratoId: string;
  tipo: TipoConferencia;
  comodo: string;
  descricao: string;
  fotoPath?: string | null;
}): Promise<Resultado> {
  if (input.tipo !== "entrada" && input.tipo !== "saida") return erro("Tipo de conferência inválido.");
  const ctx = await parteDoContrato(input.contratoId);
  if (!ctx) return erro("Você não faz parte deste contrato.");
  if (!(input.tipo === "entrada" ? STATUS_ENTRADA : STATUS_SAIDA).includes(ctx.status)) return erro("Este contrato não está em um momento de conferência.");
  if (input.fotoPath && !input.fotoPath.startsWith(`${ctx.uid}/`)) return erro("Foto inválida.");
  const v = validarItem({ comodo: input.comodo, descricao: input.descricao, fotoPath: input.fotoPath ?? null });
  if (!v.ok) return erro(v.erro);
  if (input.tipo === "entrada" && ctx.inicio && Date.now() > prazoEntrada(ctx.inicio).getTime()) {
    return erro("O prazo de 48 horas para a conferência de entrada já passou.");
  }
  if (!(await consumirLimite(`conferencia-item:${ctx.uid}`, 200, HORA))) return erro("Muitos registros em pouco tempo. Tente de novo em instantes.");

  const admin = createAdminClient()!;
  const { data: conf } = await admin
    .from("conferencias")
    .upsert({ contrato_id: input.contratoId, tipo: input.tipo, aberta_por: ctx.uid }, { onConflict: "contrato_id,tipo", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  const confId =
    conf?.id ??
    (await admin.from("conferencias").select("id").eq("contrato_id", input.contratoId).eq("tipo", input.tipo).maybeSingle()).data?.id;
  if (!confId) return erro("Não foi possível abrir a conferência. Tente de novo.");

  const { data: respostas } = await admin.from("conferencia_respostas").select("parte, decisao, motivo").eq("conferencia_id", confId);
  if (!podeEditarItens((respostas ?? []) as RespostaConferencia[])) return erro("A conferência já foi respondida e não pode mais ser alterada.");

  const { data, error } = await admin
    .from("conferencia_itens")
    .insert({
      conferencia_id: confId,
      autor_id: ctx.uid,
      parte: ctx.parte,
      comodo: input.comodo.trim(),
      descricao: input.descricao.trim(),
      foto_path: input.fotoPath ?? null,
    })
    .select("id")
    .single();
  if (error) return erro("Não foi possível salvar o item. Tente de novo.");
  revalidatePath("/dashboard/locacoes");
  return { ok: true, id: data.id as string };
}

/** Confirma ou contesta (uma vez por parte). Depois disso a conferência fica imutável. */
export async function responderConferencia(input: {
  contratoId: string;
  tipo: TipoConferencia;
  decisao: "confirmou" | "contestou";
  motivo?: string;
}): Promise<Resultado> {
  if (input.tipo !== "entrada" && input.tipo !== "saida") return erro("Tipo de conferência inválido.");
  if (input.decisao !== "confirmou" && input.decisao !== "contestou") return erro("Resposta inválida.");
  const ctx = await parteDoContrato(input.contratoId);
  if (!ctx) return erro("Você não faz parte deste contrato.");
  const admin = createAdminClient()!;
  const { data: conf } = await admin.from("conferencias").select("id").eq("contrato_id", input.contratoId).eq("tipo", input.tipo).maybeSingle();
  if (!conf) return erro("Ainda não há itens registrados nesta conferência.");

  const [{ data: respostas }, { count }] = await Promise.all([
    admin.from("conferencia_respostas").select("parte, decisao, motivo").eq("conferencia_id", conf.id),
    admin.from("conferencia_itens").select("id", { count: "exact", head: true }).eq("conferencia_id", conf.id),
  ]);
  const d = decidirResposta({
    respostas: (respostas ?? []) as RespostaConferencia[],
    parte: ctx.parte,
    decisao: input.decisao,
    motivo: input.motivo ?? "",
    qtdItens: count ?? 0,
  });
  if (!d.ok) return erro(d.erro);

  const { error } = await admin
    .from("conferencia_respostas")
    .insert({ conferencia_id: conf.id, parte: ctx.parte, autor_id: ctx.uid, decisao: input.decisao, motivo: d.motivo });
  if (error) return erro("Não foi possível registrar sua resposta. Ela pode já ter sido enviada.");
  revalidatePath("/dashboard/locacoes");
  return { ok: true };
}

export interface ConferenciaView {
  id: string;
  tipo: TipoConferencia;
  estado: ReturnType<typeof estadoConferencia>;
  itens: { id: string; parte: ParteConferencia; comodo: string; descricao: string; fotoPath: string | null; criadoEm: string }[];
  respostas: (RespostaConferencia & { decididoEm: string })[];
}

/** As conferências do contrato, lidas pelo RLS (só as partes e a equipe enxergam). */
export async function conferenciasDoContrato(contratoId: string): Promise<ConferenciaView[]> {
  const supabase = await createClient();
  if (!supabase || !UUID_RE.test(contratoId)) return [];
  const { data: confs } = await supabase.from("conferencias").select("id, tipo").eq("contrato_id", contratoId);
  if (!confs?.length) return [];
  const ids = confs.map((c) => c.id as string);
  const [{ data: itens }, { data: respostas }] = await Promise.all([
    supabase.from("conferencia_itens").select("id, conferencia_id, parte, comodo, descricao, foto_path, criado_em").in("conferencia_id", ids).order("criado_em"),
    supabase.from("conferencia_respostas").select("conferencia_id, parte, decisao, motivo, decidido_em").in("conferencia_id", ids),
  ]);
  return confs.map((c) => {
    const rs = (respostas ?? []).filter((r) => r.conferencia_id === c.id) as unknown as (RespostaConferencia & { decidido_em: string })[];
    return {
      id: c.id as string,
      tipo: c.tipo as TipoConferencia,
      estado: estadoConferencia(rs),
      itens: (itens ?? [])
        .filter((i) => i.conferencia_id === c.id)
        .map((i) => ({ id: i.id as string, parte: i.parte as ParteConferencia, comodo: i.comodo as string, descricao: i.descricao as string, fotoPath: (i.foto_path as string) ?? null, criadoEm: i.criado_em as string })),
      respostas: rs.map((r) => ({ parte: r.parte, decisao: r.decisao, motivo: r.motivo, decididoEm: r.decidido_em })),
    };
  });
}
