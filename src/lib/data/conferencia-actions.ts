"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, HORA } from "@/lib/limites";
import { fecharConferencia } from "@/lib/fiscal/conferencia-fechamento";
import { prontaParaFechar } from "@/lib/fiscal/fechamento";
import { semMetadados } from "@/lib/foto-reconversao";
import {
  decidirResposta,
  estadoConferencia,
  fonteDaConferencia,
  janelaEncerrada,
  type ItemTela,
  type LaudoTela,
  podeEditarItens,
  prazoConferenciaEntrada,
  prazoConferenciaSaida,
  ERRO_ANTES_DA_OUTRA_PARTE,
  type EntradaDoContrato,
  validarFotoConferencia,
  validarItem,
  validarLaudo,
  type ParteConferencia,
  type RespostaConferencia,
  type RespostaTela,
  type TipoConferencia,
} from "@/lib/conferencia";
import { pendenciasDaConferencia, validarSecaoConforto } from "@/lib/conforto/regras";
import { avisarPendenciaConforto } from "@/lib/conforto/avisos";

/*
  Conferência de entrada e de saída (ordem 404cd213, item 1). Toda escrita passa por aqui,
  com o cliente de serviço, DEPOIS de conferir no servidor que quem age é o inquilino do
  contrato ou o dono do imóvel. O banco repete a regra de imutabilidade (migração 0110).
*/

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_ENTRADA = ["ativo"];
const STATUS_SAIDA = ["ativo", "concluido", "encerrado_sem_renovacao"];

type Resultado = { ok: true; id?: string; item?: ItemTela; resposta?: RespostaTela; laudo?: LaudoTela } | { ok: false; error: string };
const erro = (error: string): Resultado => ({ ok: false, error });

/** Prompt 56 (D5): depois do fechamento nada muda — o banco recusa; aqui a pessoa recebe o motivo em português. */
const ERRO_FECHADA = "Esta conferência já foi fechada: nada muda depois do fechamento. Uma correção vira uma versão nova, pela equipe.";
async function estaFechada(admin: NonNullable<ReturnType<typeof createAdminClient>>, contratoId: string, tipo: TipoConferencia): Promise<boolean> {
  const { data } = await admin.from("conferencias").select("fechada_em").eq("contrato_id", contratoId).eq("tipo", tipo).maybeSingle();
  return !!data?.fechada_em;
}

/** Quem é a pessoa neste contrato: "inquilino", "proprietario" ou null (não é parte). */
async function parteDoContrato(contratoId: string): Promise<{ uid: string; parte: ParteConferencia; status: string; propertyId: string | null; entrada: EntradaDoContrato } | null> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin || !UUID_RE.test(contratoId)) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: c } = await admin
    .from("contratos")
    .select("tenant_id, status, property_id, properties(owner_id, checkin_after, checkout_before), contrato_blocos(inicio, fim, status)")
    .eq("id", contratoId)
    .maybeSingle();
  if (!c) return null;
  const prop = c.properties as unknown as { owner_id?: string; checkin_after?: string | null; checkout_before?: string | null } | null;
  const donoId = prop?.owner_id;
  const parte: ParteConferencia | null = c.tenant_id === user.id ? "inquilino" : donoId === user.id ? "proprietario" : null;
  if (!parte) return null;
  const blocos = ((c.contrato_blocos ?? []) as { inicio: string; fim: string; status: string | null }[]).filter((b) => b.status !== "nao_aceito");
  const inicios = blocos.map((b) => b.inicio).sort();
  const fins = blocos.map((b) => b.fim).sort();
  // F2: o prazo da entrada sai do dia de início + horário de entrada do imóvel (prazoConferenciaEntrada); o da saída, do
  // último dia + horário de saída (prazoConferenciaSaida, Prompt 56).
  return {
    uid: user.id,
    parte,
    status: String(c.status),
    propertyId: (c.property_id as string | null) ?? null,
    entrada: { inicio: inicios[0] ?? null, checkinAfter: prop?.checkin_after ?? null, fim: fins.at(-1) ?? null, checkoutBefore: prop?.checkout_before ?? null },
  };
}

/** Registra um item (cômodo + descrição + foto opcional) na conferência; cria a conferência na primeira vez. */
export async function registrarItemConferencia(input: {
  contratoId: string;
  tipo: TipoConferencia;
  comodo: string;
  descricao: string;
  fotoPath?: string | null;
  precisaReparo?: boolean;
}): Promise<Resultado> {
  if (input.tipo !== "entrada" && input.tipo !== "saida") return erro("Tipo de conferência inválido.");
  const ctx = await parteDoContrato(input.contratoId);
  if (!ctx) return erro("Você não faz parte deste contrato.");
  if (!(input.tipo === "entrada" ? STATUS_ENTRADA : STATUS_SAIDA).includes(ctx.status)) return erro("Este contrato não está em um momento de conferência.");
  if (input.fotoPath && !input.fotoPath.startsWith(`${ctx.uid}/`)) return erro("Foto inválida.");
  const v = validarItem({ comodo: input.comodo, descricao: input.descricao, fotoPath: input.fotoPath ?? null });
  if (!v.ok) return erro(v.erro);
  if (janelaEncerrada(input.tipo, ctx.entrada)) {
    return erro(`O prazo de 48 horas para a conferência de ${input.tipo === "entrada" ? "entrada" : "saída"} já passou.`);
  }
  if (!(await consumirLimite(`conferencia-item:${ctx.uid}`, 200, HORA))) return erro("Muitos registros em pouco tempo. Tente de novo em instantes.");

  const admin = createAdminClient()!;
  if (await estaFechada(admin, input.contratoId, input.tipo)) return erro(ERRO_FECHADA);
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
  if (!podeEditarItens((respostas ?? []) as RespostaConferencia[], ctx.parte)) return erro("Você já respondeu esta conferência e ela não pode mais ser alterada.");

  const { data, error } = await admin
    .from("conferencia_itens")
    .insert({
      conferencia_id: confId,
      autor_id: ctx.uid,
      parte: ctx.parte,
      comodo: input.comodo.trim(),
      descricao: input.descricao.trim(),
      foto_path: input.fotoPath ?? null,
      // Só o dono, só na saída (Prompt 38). Depois do fechamento nada muda (a trava acima e a do banco).
      precisa_reparo: input.tipo === "saida" && ctx.parte === "proprietario" && input.precisaReparo === true,
    })
    .select("id, criado_em")
    .single();
  if (error) return erro("Não foi possível salvar o item. Tente de novo.");
  revalidatePath("/dashboard/locacoes");
  revalidatePath("/dashboard/contratos");
  const fotoUrl = input.fotoPath ? ((await admin.storage.from(BUCKET).createSignedUrl(input.fotoPath, URL_SEGUNDOS)).data?.signedUrl ?? null) : null;
  const item: ItemTela = { id: data.id as string, parte: ctx.parte, comodo: input.comodo.trim(), descricao: input.descricao.trim(), fotoUrl, criadoEm: String(data.criado_em), precisaReparo: input.tipo === "saida" && ctx.parte === "proprietario" && input.precisaReparo === true };
  return { ok: true, id: item.id, item };
}

/**
 * Prompt 59: o MORADOR responde a seção "Padrão mínimo" da conferência de ENTRADA (uma vez; cada item confere / não
 * confere, com texto curto e foto opcional). Cada "não confere" vira pendência do dono (72 h). Entra no hash de fechamento.
 */
export async function responderConfortoEntrada(input: { contratoId: string; respostas: unknown }): Promise<Resultado & { pendencias?: number }> {
  const ctx = await parteDoContrato(input.contratoId);
  if (!ctx) return erro("Você não faz parte deste contrato.");
  if (ctx.parte !== "inquilino") return erro("O padrão mínimo é conferido pelo morador.");
  if (!STATUS_ENTRADA.includes(ctx.status)) return erro("Este contrato não está em um momento de conferência.");
  if (janelaEncerrada("entrada", ctx.entrada)) return erro("O prazo de 48 horas para a conferência de entrada já passou.");
  const v = validarSecaoConforto(input.respostas);
  if (!v.ok) return erro(v.erro);
  if (v.respostas.some((r) => r.foto && !r.foto.startsWith(`${ctx.uid}/`))) return erro("Foto inválida.");
  if (!(await consumirLimite(`conferencia-conforto:${ctx.uid}`, 20, HORA))) return erro("Muitos envios em pouco tempo. Tente de novo em instantes.");

  const admin = createAdminClient()!;
  if (await estaFechada(admin, input.contratoId, "entrada")) return erro(ERRO_FECHADA);
  await admin
    .from("conferencias")
    .upsert({ contrato_id: input.contratoId, tipo: "entrada", aberta_por: ctx.uid }, { onConflict: "contrato_id,tipo", ignoreDuplicates: true });
  const { data: conf } = await admin.from("conferencias").select("id").eq("contrato_id", input.contratoId).eq("tipo", "entrada").maybeSingle();
  if (!conf) return erro("Não foi possível abrir a conferência. Tente de novo.");
  const { data: respostas } = await admin.from("conferencia_respostas").select("parte, decisao, motivo").eq("conferencia_id", conf.id);
  if (!podeEditarItens((respostas ?? []) as RespostaConferencia[], ctx.parte)) return erro("Você já respondeu esta conferência e ela não pode mais ser alterada.");
  const { count } = await admin.from("conferencia_conforto").select("chave", { count: "exact", head: true }).eq("conferencia_id", conf.id);
  if ((count ?? 0) > 0) return erro("O padrão mínimo desta entrada já foi respondido.");

  const agora = new Date();
  const { error } = await admin.from("conferencia_conforto").insert(
    v.respostas.map((r) => ({ conferencia_id: conf.id, chave: r.chave, confere: r.confere, texto: r.confere ? null : r.texto, foto_path: r.confere ? null : (r.foto ?? null), autor_id: ctx.uid, respondido_em: agora.toISOString() })),
  );
  if (error) return erro("Não foi possível salvar o padrão mínimo. Tente de novo.");
  const novas = pendenciasDaConferencia(v.respostas, agora).map((p) => ({ ...p, property_id: ctx.propertyId, contrato_id: input.contratoId, conferencia_id: conf.id }));
  if (novas.length && ctx.propertyId) {
    // insert, não upsert: o índice único (conferencia_id, chave) é parcial e o ON CONFLICT não o reconhece (42P10). Um
    // envio por conferência já é garantido acima; um clique duplo esbarra no índice (23505) e as pendências já existem.
    const { data: criadas, error: ePend } = await admin.from("conforto_pendencias").insert(novas).select("id");
    if (ePend && ePend.code !== "23505") console.error("[responderConfortoEntrada] pendências", ePend.code, ePend.message);
    for (const p of (criadas ?? []) as { id: string }[]) await avisarPendenciaConforto(admin, p.id, "aberta").catch(() => null);
  }
  revalidatePath("/dashboard/locacoes");
  revalidatePath("/dashboard/contratos");
  revalidatePath("/dashboard");
  return { ok: true, pendencias: novas.length };
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
  if (await estaFechada(admin, input.contratoId, input.tipo)) return erro(ERRO_FECHADA);
  const encerrada = janelaEncerrada(input.tipo, ctx.entrada);
  let { data: conf } = await admin.from("conferencias").select("id").eq("contrato_id", input.contratoId).eq("tipo", input.tipo).maybeSingle();
  if (!conf) {
    // Sem conferência = a outra parte não registrou nada. Com o prazo da entrada encerrado, responde mesmo assim.
    if (!encerrada) return erro(ERRO_ANTES_DA_OUTRA_PARTE);
    await admin
      .from("conferencias")
      .upsert({ contrato_id: input.contratoId, tipo: input.tipo, aberta_por: ctx.uid }, { onConflict: "contrato_id,tipo", ignoreDuplicates: true });
    ({ data: conf } = await admin.from("conferencias").select("id").eq("contrato_id", input.contratoId).eq("tipo", input.tipo).maybeSingle());
    if (!conf) return erro("Não foi possível abrir a conferência. Tente de novo.");
  }

  const [{ data: respostas }, { data: itens }] = await Promise.all([
    admin.from("conferencia_respostas").select("parte, decisao, motivo").eq("conferencia_id", conf.id),
    admin.from("conferencia_itens").select("parte").eq("conferencia_id", conf.id),
  ]);
  const itensPorParte = { proprietario: 0, inquilino: 0 };
  for (const i of (itens ?? []) as { parte: ParteConferencia }[]) itensPorParte[i.parte] += 1;
  const d = decidirResposta({
    respostas: (respostas ?? []) as RespostaConferencia[],
    parte: ctx.parte,
    decisao: input.decisao,
    motivo: input.motivo ?? "",
    itensPorParte,
    janelaEncerrada: encerrada,
  });
  if (!d.ok) return erro(d.erro);

  const { error } = await admin
    .from("conferencia_respostas")
    .insert({ conferencia_id: conf.id, parte: ctx.parte, autor_id: ctx.uid, decisao: input.decisao, motivo: d.motivo });
  if (error) return erro("Não foi possível registrar sua resposta. Ela pode já ter sido enviada.");
  // As duas partes responderam: fecha (hash de fechamento + CND), depois da resposta, sem atrasar a pessoa.
  const confId = conf.id as string;
  if (prontaParaFechar([...((respostas ?? []) as RespostaConferencia[]), { parte: ctx.parte }])) after(() => fecharConferencia(admin, confId, "duas_respostas"));
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
  /** Prompt 59: seção "Padrão mínimo" do morador (só na entrada). Vazia = ainda não respondeu. */
  conforto: { chave: string; confere: boolean; texto: string | null; fotoUrl: string | null; respondidoEm: string }[];
}

export interface ConferenciasContrato {
  /** Quem está olhando: "inquilino", "proprietario" ou null (equipe/leitura). */
  minhaParte: ParteConferencia | null;
  /** Instante do prazo da entrada (ISO), pela fonte única `prazoConferenciaEntrada`. */
  prazoEntradaEm: string | null;
  /** O prazo da entrada já passou (calculado no servidor): libera responder sem itens da outra parte. */
  janelaEntradaEncerrada: boolean;
  /** Instante do prazo da saída (ISO), pela fonte única `prazoConferenciaSaida` (Prompt 56). */
  prazoSaidaEm: string | null;
  janelaSaidaEncerrada: boolean;
  /** Imóvel do contrato (Prompt 57: o morador mede a internet na conferência de entrada). */
  propertyId: string | null;
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
  // Prompt 58: foto sem EXIF/GPS (re-codificada no servidor, mesmo formato); o laudo em PDF vai como veio.
  const limpo = await semMetadados(bytes, v.tipo);
  if (!limpo) return { ok: false, error: "Não foi possível ler a imagem. Envie outra foto." };
  const { error } = await admin.storage.from(BUCKET).upload(path, limpo, { contentType: v.tipo, upsert: false });
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
  if (await estaFechada(admin, contratoId, tipo)) return erro(ERRO_FECHADA);
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
  return { ok: true, laudo: { url: null, parte: ctx.parte, criadoEm: new Date().toISOString() } };
}

/** As conferências do contrato, lidas pelo RLS (só as partes e a equipe enxergam). */
export async function conferenciasDoContrato(contratoId: string): Promise<ConferenciasContrato> {
  const vazio: ConferenciasContrato = { minhaParte: null, prazoEntradaEm: null, janelaEntradaEncerrada: false, prazoSaidaEm: null, janelaSaidaEncerrada: false, propertyId: null, conferencias: [] };
  const supabase = await createClient();
  if (!supabase || !UUID_RE.test(contratoId)) return vazio;
  const ctx = await parteDoContrato(contratoId);
  const prazoEntradaEm = ctx ? (prazoConferenciaEntrada(ctx.entrada)?.toISOString() ?? null) : null;
  const janelaEntradaEncerrada = ctx ? janelaEncerrada("entrada", ctx.entrada) : false;
  const prazoSaidaEm = ctx ? (prazoConferenciaSaida(ctx.entrada)?.toISOString() ?? null) : null;
  const janelaSaidaEncerrada = ctx ? janelaEncerrada("saida", ctx.entrada) : false;
  const { data: confs } = await supabase.from("conferencias").select("id, tipo").eq("contrato_id", contratoId);
  if (!confs?.length) return { minhaParte: ctx?.parte ?? null, prazoEntradaEm, janelaEntradaEncerrada, prazoSaidaEm, janelaSaidaEncerrada, propertyId: ctx?.propertyId ?? null, conferencias: [] };
  const ids = confs.map((c) => c.id as string);
  const [{ data: itens }, { data: respostas }, { data: laudos }, { data: conforto }] = await Promise.all([
    supabase.from("conferencia_itens").select("id, conferencia_id, parte, comodo, descricao, foto_path, criado_em, precisa_reparo").in("conferencia_id", ids).order("criado_em"),
    supabase.from("conferencia_respostas").select("conferencia_id, parte, decisao, motivo, decidido_em").in("conferencia_id", ids),
    supabase.from("conferencia_laudos").select("conferencia_id, path, parte, criado_em").in("conferencia_id", ids),
    supabase.from("conferencia_conforto").select("conferencia_id, chave, confere, texto, foto_path, respondido_em").in("conferencia_id", ids),
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
            .map(async (i) => ({ id: i.id as string, parte: i.parte as ParteConferencia, comodo: i.comodo as string, descricao: i.descricao as string, fotoUrl: await assinar((i.foto_path as string) ?? null), criadoEm: i.criado_em as string, precisaReparo: i.precisa_reparo === true })),
        ),
        respostas: rs.map((r) => ({ parte: r.parte, decisao: r.decisao, motivo: r.motivo, decididoEm: r.decidido_em })),
        laudo: laudo ? { url: await assinar(laudo.path as string), parte: laudo.parte as ParteConferencia, criadoEm: laudo.criado_em as string } : null,
        fonte: fonteDaConferencia(!!laudo),
        conforto: await Promise.all(
          ((conforto ?? []) as { conferencia_id: string; chave: string; confere: boolean; texto: string | null; foto_path: string | null; respondido_em: string }[])
            .filter((r) => r.conferencia_id === c.id)
            .map(async (r) => ({ chave: r.chave, confere: r.confere, texto: r.texto, fotoUrl: await assinar(r.foto_path), respondidoEm: r.respondido_em })),
        ),
      } satisfies ConferenciaView;
    }),
  );
  return { minhaParte: ctx?.parte ?? null, prazoEntradaEm, janelaEntradaEncerrada, prazoSaidaEm, janelaSaidaEncerrada, propertyId: ctx?.propertyId ?? null, conferencias };
}
