"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, HORA } from "@/lib/limites";
import {
  decidirResposta,
  estadoConferencia,
  fonteDaConferencia,
  type ItemTela,
  podeEditarItens,
  prazoEntrada,
  validarFotoConferencia,
  validarItem,
  validarLaudo,
  type ParteConferencia,
  type RespostaConferencia,
  type RespostaTela,
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

type Resultado = { ok: true; id?: string; item?: ItemTela; resposta?: RespostaTela } | { ok: false; error: string };
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
    .select("id, criado_em")
    .single();
  if (error) return erro("Não foi possível salvar o item. Tente de novo.");
  revalidatePath("/dashboard/locacoes");
  revalidatePath("/dashboard/contratos");
  const fotoUrl = input.fotoPath ? ((await admin.storage.from(BUCKET).createSignedUrl(input.fotoPath, URL_SEGUNDOS)).data?.signedUrl ?? null) : null;
  const item: ItemTela = { id: data.id as string, parte: ctx.parte, comodo: input.comodo.trim(), descricao: input.descricao.trim(), fotoUrl, criadoEm: String(data.criado_em) };
  return { ok: true, id: item.id, item };
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
  revalidatePath("/dashboard/contratos");
  return { ok: true, resposta: { parte: ctx.parte, decisao: input.decisao, motivo: d.motivo, decididoEm: new Date().toISOString() } };
}

export interface ConferenciaView {
  id: string;
  tipo: TipoConferencia;
  estado: ReturnType<typeof estadoConferencia>;
  itens: { id: string; parte: ParteConferencia; comodo: string; descricao: string; fotoUrl: string | null; criadoEm: string }[];
  respostas: (RespostaConferencia & { decididoEm: string })[];
  /** Laudo de parceiro independente (PDF); quando existe, prevalece sobre as fotos. */
  laudo: { url: string | null; parte: ParteConferencia; criadoEm: string } | null;
  fonte: ReturnType<typeof fonteDaConferencia>;
}

export interface ConferenciasContrato {
  /** Quem está olhando: "inquilino", "proprietario" ou null (equipe/leitura). */
  minhaParte: ParteConferencia | null;
  prazoEntradaEm: string | null;
  conferencias: ConferenciaView[];
}

const BUCKET = "conferencia";
const URL_SEGUNDOS = 600;

type EnvioArquivo = { ok: true; path: string } | { ok: false; error: string };

/** Lê o arquivo do formulário, confere no servidor e sobe ao bucket privado na pasta de quem enviou. */
async function subirArquivo(
  uid: string,
  file: FormDataEntryValue | null,
  validar: typeof validarLaudo,
): Promise<EnvioArquivo> {
  if (!(file instanceof File)) return { ok: false, error: "Arquivo ausente." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const v = validar({ bytes, tamanho: file.size });
  if (!v.ok) return { ok: false, error: v.erro };
  const admin = createAdminClient()!;
  const path = `${uid}/${crypto.randomUUID()}.${v.ext}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: v.tipo, upsert: false });
  if (error) return { ok: false, error: "Não foi possível salvar o arquivo. Tente de novo." };
  return { ok: true, path };
}

/** Sobe a foto de um cômodo; devolve o caminho para passar a `registrarItemConferencia`. */
export async function enviarFotoConferencia(formData: FormData): Promise<Resultado & { path?: string }> {
  const contratoId = String(formData.get("contratoId") ?? "");
  const ctx = await parteDoContrato(contratoId);
  if (!ctx) return erro("Você não faz parte deste contrato.");
  if (!(await consumirLimite(`conferencia-arquivo:${ctx.uid}`, 60, HORA))) return erro("Muitos envios em pouco tempo. Tente de novo em instantes.");
  const r = await subirArquivo(ctx.uid, formData.get("arquivo"), validarFotoConferencia);
  if (!r.ok) return erro(r.error);
  return { ok: true, path: r.path };
}

/** Anexa o laudo de parceiro independente (PDF, até 15 MB) à conferência. Um por conferência; imutável. */
export async function anexarLaudoConferencia(formData: FormData): Promise<Resultado> {
  const contratoId = String(formData.get("contratoId") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoConferencia;
  if (tipo !== "entrada" && tipo !== "saida") return erro("Tipo de conferência inválido.");
  const ctx = await parteDoContrato(contratoId);
  if (!ctx) return erro("Você não faz parte deste contrato.");
  if (!(await consumirLimite(`conferencia-arquivo:${ctx.uid}`, 60, HORA))) return erro("Muitos envios em pouco tempo. Tente de novo em instantes.");

  const admin = createAdminClient()!;
  await admin
    .from("conferencias")
    .upsert({ contrato_id: contratoId, tipo, aberta_por: ctx.uid }, { onConflict: "contrato_id,tipo", ignoreDuplicates: true });
  const { data: conf } = await admin.from("conferencias").select("id").eq("contrato_id", contratoId).eq("tipo", tipo).maybeSingle();
  if (!conf) return erro("Não foi possível abrir a conferência. Tente de novo.");
  const { data: ja } = await admin.from("conferencia_laudos").select("conferencia_id").eq("conferencia_id", conf.id).maybeSingle();
  if (ja) return erro("Esta conferência já tem um laudo independente anexado.");

  const file = formData.get("arquivo");
  const r = await subirArquivo(ctx.uid, file, validarLaudo);
  if (!r.ok) return erro(r.error);
  const { error } = await admin
    .from("conferencia_laudos")
    .insert({ conferencia_id: conf.id, path: r.path, tamanho: (file as File).size, enviado_por: ctx.uid, parte: ctx.parte });
  if (error) {
    await admin.storage.from(BUCKET).remove([r.path]);
    return erro("Não foi possível anexar o laudo. Ele pode já ter sido anexado.");
  }
  revalidatePath("/dashboard/locacoes");
  revalidatePath("/dashboard/contratos");
  return { ok: true };
}

/** As conferências do contrato, lidas pelo RLS (só as partes e a equipe enxergam). */
export async function conferenciasDoContrato(contratoId: string): Promise<ConferenciasContrato> {
  const vazio: ConferenciasContrato = { minhaParte: null, prazoEntradaEm: null, conferencias: [] };
  const supabase = await createClient();
  if (!supabase || !UUID_RE.test(contratoId)) return vazio;
  const ctx = await parteDoContrato(contratoId);
  const prazoEntradaEm = ctx?.inicio ? prazoEntrada(ctx.inicio).toISOString() : null;
  const { data: confs } = await supabase.from("conferencias").select("id, tipo").eq("contrato_id", contratoId);
  if (!confs?.length) return { minhaParte: ctx?.parte ?? null, prazoEntradaEm, conferencias: [] };
  const ids = confs.map((c) => c.id as string);
  const [{ data: itens }, { data: respostas }, { data: laudos }] = await Promise.all([
    supabase.from("conferencia_itens").select("id, conferencia_id, parte, comodo, descricao, foto_path, criado_em").in("conferencia_id", ids).order("criado_em"),
    supabase.from("conferencia_respostas").select("conferencia_id, parte, decisao, motivo, decidido_em").in("conferencia_id", ids),
    supabase.from("conferencia_laudos").select("conferencia_id, path, parte, criado_em").in("conferencia_id", ids),
  ]);
  // Links temporários (10 min) só para quem já passou pelo RLS acima.
  const admin = createAdminClient();
  const assinar = async (path: string | null) =>
    path && admin ? ((await admin.storage.from(BUCKET).createSignedUrl(path, URL_SEGUNDOS)).data?.signedUrl ?? null) : null;
  const conferencias = await Promise.all(
    confs.map(async (c) => {
      const rs = (respostas ?? []).filter((r) => r.conferencia_id === c.id) as unknown as (RespostaConferencia & { decidido_em: string })[];
      const laudo = (laudos ?? []).find((l) => l.conferencia_id === c.id);
      return {
        id: c.id as string,
        tipo: c.tipo as TipoConferencia,
        estado: estadoConferencia(rs),
        itens: await Promise.all(
          (itens ?? [])
            .filter((i) => i.conferencia_id === c.id)
            .map(async (i) => ({ id: i.id as string, parte: i.parte as ParteConferencia, comodo: i.comodo as string, descricao: i.descricao as string, fotoUrl: await assinar((i.foto_path as string) ?? null), criadoEm: i.criado_em as string })),
        ),
        respostas: rs.map((r) => ({ parte: r.parte, decisao: r.decisao, motivo: r.motivo, decididoEm: r.decidido_em })),
        laudo: laudo ? { url: await assinar(laudo.path as string), parte: laudo.parte as ParteConferencia, criadoEm: laudo.criado_em as string } : null,
        fonte: fonteDaConferencia(!!laudo),
      } satisfies ConferenciaView;
    }),
  );
  return { minhaParte: ctx?.parte ?? null, prazoEntradaEm, conferencias };
}
