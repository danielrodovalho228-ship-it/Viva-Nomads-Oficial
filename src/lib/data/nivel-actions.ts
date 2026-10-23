"use server";

/*
  Adendo 59.1 — ações do nível (Essencial / Conforto / Premium), do ruído e dos extras. O dono declara cada item com
  UMA foto (enviada por /api/upload/foto: re-codificada sem EXIF, na pasta do próprio dono); o atendimento da Viva
  aceita ou recusa a foto com motivo. Toda gravação passa pelo cliente de serviço DEPOIS de conferir quem age, e todo
  passo recalcula o nível (elo mais fraco). Nada financeiro (D7).
*/
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { CHAVES_NIVEL_FOTO, ehChaveNivel, itemNivel, type ChaveExtra, type ChaveNivel, type PontoMedicao } from "@/config/niveis";
import { classeRuido, medidaPorPonto, nivelDoImovel, validarExtras, validarRespostasRuido, type ResultadoNivel, type RespostasRuido, type StatusFoto } from "@/lib/niveis/regras";
import { entradaDoNivel, recalcularNivel } from "@/lib/niveis/servidor";
import { avisarFotoRecusada } from "@/lib/niveis/avisos";

export type ResultadoNivelAcao = { ok: true; mensagem?: string } | { ok: false; erro: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOTO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i;

async function sessao() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, uid: user.id } : null;
}

async function donoDoImovel(propertyId: string) {
  if (!UUID.test(propertyId ?? "")) return null;
  const s = await sessao();
  const admin = createAdminClient();
  if (!s || !admin) return null;
  const { data } = await s.supabase.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();
  return data?.owner_id === s.uid ? { ...s, admin } : null;
}

function revalidar(propertyId: string) {
  revalidatePath(`/dashboard/imoveis/${propertyId}/nivel`);
  revalidatePath("/dashboard");
  revalidatePath("/buscar");
  revalidatePath(`/imoveis/${propertyId}`);
}

export interface ItemNivelTela {
  chave: ChaveNivel;
  declarado: boolean;
  fotoUrl: string | null;
  fotoStatus: StatusFoto;
  motivoRecusa: string | null;
}

export interface NivelDoImovelTela {
  resultado: ResultadoNivel;
  itens: ItemNivelTela[];
  ruido: RespostasRuido | null;
  extras: ChaveExtra[];
  medidas: { ponto: PontoMedicao; downloadMbps: number; uploadMbps: number }[];
}

/** Página do dono: nível atual, por área, itens com foto, ruído, extras e as medidas por ponto. */
export async function nivelDoMeuImovel(propertyId: string): Promise<NivelDoImovelTela | null> {
  const c = await donoDoImovel(propertyId);
  if (!c) return null;
  const agora = new Date();
  const [entrada, itens, extras] = await Promise.all([
    entradaDoNivel(c.admin, propertyId, agora),
    c.admin.from("nivel_itens").select("chave, declarado, foto_path, foto_status, motivo_recusa").eq("property_id", propertyId),
    c.admin.from("imovel_extras").select("chave").eq("property_id", propertyId),
  ]);
  const rec = await recalcularNivel(c.admin, propertyId, agora);
  const porChave = new Map(((itens.data ?? []) as { chave: string; declarado: boolean; foto_path: string | null; foto_status: StatusFoto; motivo_recusa: string | null }[]).map((i) => [i.chave, i]));
  return {
    resultado: rec?.resultado ?? nivelDoImovel(entrada),
    itens: CHAVES_NIVEL_FOTO.map((chave) => {
      const i = porChave.get(chave);
      return {
        chave,
        declarado: !!i?.declarado,
        fotoUrl: i?.foto_path ? c.admin.storage.from("property-photos").getPublicUrl(i.foto_path).data.publicUrl : null,
        fotoStatus: i?.foto_status ?? "pendente",
        motivoRecusa: i?.motivo_recusa ?? null,
      };
    }),
    ruido: entrada.ruido,
    extras: validarExtras(((extras.data ?? []) as { chave: string }[]).map((e) => e.chave)),
    medidas: [...medidaPorPonto(entrada.medidas, agora).entries()].map(([ponto, m]) => ({ ponto, downloadMbps: m.downloadMbps, uploadMbps: m.uploadMbps })),
  };
}

/**
 * O dono declara (ou retira) um item de Conforto/Premium. Declarar exige a foto do item (uma por item, sem pessoas);
 * foto nova volta para "em análise". Sem foto, o item não conta para o nível.
 */
export async function salvarItemNivel(propertyId: string, chave: string, declarado: boolean, fotoPath?: string | null): Promise<ResultadoNivelAcao> {
  const c = await donoDoImovel(propertyId);
  if (!c) return { ok: false, erro: "Sem permissão." };
  if (!ehChaveNivel(chave) || itemNivel(chave).prova !== "foto") return { ok: false, erro: "Item inválido." };
  const { data: atual } = await c.admin.from("nivel_itens").select("foto_path").eq("property_id", propertyId).eq("chave", chave).maybeSingle();
  const novaFoto = typeof fotoPath === "string" && fotoPath ? fotoPath : null;
  if (novaFoto && (!FOTO_PATH.test(novaFoto) || !novaFoto.startsWith(`${c.uid}/`))) return { ok: false, erro: "Foto inválida." };
  const foto = novaFoto ?? ((atual?.foto_path as string | null) ?? null);
  if (declarado && !foto) return { ok: false, erro: `Envie a foto de "${itemNivel(chave).rotulo}" para o item contar.` };
  const agora = new Date().toISOString();
  const { error } = await c.admin.from("nivel_itens").upsert(
    {
      property_id: propertyId,
      chave,
      declarado,
      foto_path: foto,
      ...(novaFoto ? { foto_status: "pendente", motivo_recusa: null, analisado_por: null, analisado_em: null } : {}),
      declarado_por: c.uid,
      declarado_em: agora,
    },
    { onConflict: "property_id,chave" },
  );
  if (error) {
    console.error("[salvarItemNivel]", error.code, error.message);
    return { ok: false, erro: "Não foi possível salvar agora." };
  }
  const r = await recalcularNivel(c.admin, propertyId);
  revalidar(propertyId);
  return { ok: true, mensagem: r ? `Salvo. Nível do imóvel: ${rotuloNivel(r.resultado.nivel)}.` : "Salvo." };
}

/** As 4 perguntas de ruído (cadastro). A classe é calculada aqui, por exposição. */
export async function salvarRuido(propertyId: string, respostas: unknown): Promise<ResultadoNivelAcao> {
  const c = await donoDoImovel(propertyId);
  if (!c) return { ok: false, erro: "Sem permissão." };
  const v = validarRespostasRuido(respostas);
  if (!v.ok) return { ok: false, erro: v.erro };
  const { error } = await c.admin
    .from("imovel_ruido")
    .upsert({ property_id: propertyId, ...v.respostas, classe: classeRuido(v.respostas), origem: "proprietario", respondido_em: new Date().toISOString() }, { onConflict: "property_id" });
  if (error) return { ok: false, erro: "Não foi possível salvar agora." };
  await recalcularNivel(c.admin, propertyId);
  revalidar(propertyId);
  return { ok: true, mensagem: `Ruído: ${classeRuido(v.respostas) === "medio" ? "médio" : classeRuido(v.respostas)} — informado pelo proprietário.` };
}

/** Extras (lista fechada): fato da ficha; nunca mudam o nível. */
export async function salvarExtras(propertyId: string, extras: unknown): Promise<ResultadoNivelAcao> {
  const c = await donoDoImovel(propertyId);
  if (!c) return { ok: false, erro: "Sem permissão." };
  const lista = validarExtras(extras);
  const { error: eDel } = await c.admin.from("imovel_extras").delete().eq("property_id", propertyId);
  if (eDel) return { ok: false, erro: "Não foi possível salvar agora." };
  if (lista.length) {
    const { error } = await c.admin.from("imovel_extras").insert(lista.map((chave) => ({ property_id: propertyId, chave })));
    if (error) return { ok: false, erro: "Não foi possível salvar agora." };
  }
  revalidar(propertyId);
  return { ok: true, mensagem: lista.length ? `${lista.length} ${lista.length === 1 ? "extra salvo" : "extras salvos"}.` : "Sem extras." };
}

/** Atendimento da Viva (admin com 2 etapas): aceita ou recusa a foto de um item, com motivo. Recusada, o item não conta. */
export async function analisarFotoNivel(propertyId: string, chave: string, decisao: "aceita" | "recusada", motivo?: string): Promise<ResultadoNivelAcao> {
  const s = await sessao();
  const admin = createAdminClient();
  if (!s || !admin || !UUID.test(propertyId ?? "")) return { ok: false, erro: "Sem permissão." };
  if (!(await ehAdmin(s.supabase, s.uid))) return { ok: false, erro: "Só o atendimento da Viva analisa as fotos." };
  if (!ehChaveNivel(chave) || (decisao !== "aceita" && decisao !== "recusada")) return { ok: false, erro: "Pedido inválido." };
  const m = (motivo ?? "").trim().slice(0, 300);
  if (decisao === "recusada" && m.length < 5) return { ok: false, erro: "Diga em poucas palavras por que a foto não serve (ex.: não mostra o item)." };
  const { data, error } = await admin
    .from("nivel_itens")
    .update({ foto_status: decisao, motivo_recusa: decisao === "recusada" ? m : null, analisado_por: s.uid, analisado_em: new Date().toISOString() })
    .eq("property_id", propertyId)
    .eq("chave", chave)
    .not("foto_path", "is", null)
    .select("chave");
  if (error || !data?.length) return { ok: false, erro: "Foto não encontrada." };
  await logModeracao(s.supabase, s.uid, decisao === "recusada" ? "recusar_foto_nivel" : "aceitar_foto_nivel", "imovel", propertyId, decisao === "recusada" ? m : null);
  if (decisao === "recusada") await avisarFotoRecusada(admin, propertyId, itemNivel(chave).rotulo, m).catch(() => null);
  await recalcularNivel(admin, propertyId);
  revalidar(propertyId);
  revalidatePath("/admin/pendencias");
  return { ok: true, mensagem: decisao === "recusada" ? "Foto recusada; o item não conta até uma foto nova." : "Foto aceita." };
}

function rotuloNivel(n: string): string {
  return n === "premium" ? "Premium" : n === "conforto" ? "Conforto" : n === "essencial" ? "Essencial" : "em adequação";
}
