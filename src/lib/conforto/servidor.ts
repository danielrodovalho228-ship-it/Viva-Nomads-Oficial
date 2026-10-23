/*
  Prompt 59, Parte A — servidor do padrão mínimo de conforto. Só do servidor (cliente de serviço DEPOIS de conferir quem
  age). As regras são as de ./regras.ts; aqui só leitura e gravação.
*/
import { recalcularNivel } from "@/lib/niveis/servidor";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gravarDeclaracoes } from "./gravacao";
import { estadoConfortoMinimo, itensFaltantes, pendenciaFechada, pendenciaVencida, type EstadoConforto, type PendenciaConforto } from "./regras";

type Db = SupabaseClient;

/**
 * Grava a confirmação do dono (os marcados viram confirmados na versão atual; os desmarcados deixam de valer).
 * Quem chama já conferiu que `donoId` é o dono do imóvel. Falhou: devolve a causa (código do banco), já registrada no log.
 */
export async function salvarDeclaracoesConforto(
  db: Db,
  propertyId: string,
  donoId: string,
  marcados: readonly unknown[],
  agora = new Date(),
): Promise<{ ok: true } | { ok: false; erro: { code: string | null; message: string | null } }> {
  const r = await gravarDeclaracoes(db, propertyId, donoId, marcados, agora);
  if (!r.ok) {
    console.error("[salvarDeclaracoesConforto]", propertyId, r.code, r.message);
    return { ok: false, erro: { code: r.code, message: r.message } };
  }
  await voltarSeCompleto(db, propertyId);
  // Adendo 59.1: o Essencial é o padrão mínimo — confirmar/desmarcar muda o nível.
  await recalcularNivel(db, propertyId, agora);
  return { ok: true };
}

/** Pausado por conforto e agora completo: volta para a busca (D4). */
export async function voltarSeCompleto(db: Db, propertyId: string): Promise<boolean> {
  const { data: adq } = await db.from("conforto_adequacao").select("pausado_em").eq("property_id", propertyId).maybeSingle();
  if (!adq?.pausado_em) return false;
  const { data: decl } = await db.from("conforto_declaracoes").select("chave, confirmado, versao_lista").eq("property_id", propertyId);
  if (itensFaltantes((decl ?? []) as { chave: string; confirmado: boolean; versao_lista?: number | null }[]).length) return false;
  const { error } = await db.from("properties").update({ status: "active" }).eq("id", propertyId).eq("status", "paused");
  if (error) {
    console.error("[voltarSeCompleto]", error.code, error.message);
    return false;
  }
  await db.from("conforto_adequacao").update({ pausado_em: null }).eq("property_id", propertyId);
  return true;
}

/** estadoConfortoMinimo(property): itens, faltantes e prazo de adequação (painel do dono e exibição do 59-A). */
export async function estadoConfortoDoImovel(db: Db, propertyId: string, agora = new Date()): Promise<EstadoConforto & { pausado: boolean }> {
  const [{ data: decl }, { data: adq }] = await Promise.all([
    db.from("conforto_declaracoes").select("chave, confirmado, versao_lista").eq("property_id", propertyId),
    db.from("conforto_adequacao").select("prazo_ate, pausado_em").eq("property_id", propertyId).maybeSingle(),
  ]);
  const e = estadoConfortoMinimo((decl ?? []) as { chave: string; confirmado: boolean; versao_lista?: number | null }[], (adq?.prazo_ate as string | null) ?? null, agora);
  return { ...e, pausado: !!adq?.pausado_em };
}

export interface PendenciaParaTela extends PendenciaConforto {
  id: string;
  property_id: string;
  contrato_id: string | null;
  texto_morador: string | null;
  foto_morador: string | null;
  foto_dono: string | null;
  motivo_contestacao: string | null;
  fechada: boolean;
  vencida: boolean;
}

const COLUNAS_PENDENCIA =
  "id, property_id, contrato_id, chave, status, aberta_em, prazo_ate, texto_morador, foto_morador, corrigida_em, foto_dono, confirmada_em, reaberta_em, contestada_em, motivo_contestacao, decidido_em";

/** pendenciasConforto(contrato) — com "fechada" e "vencida" já decididas pela regra pura. */
export async function pendenciasConforto(db: Db, contratoId: string, agora = new Date()): Promise<PendenciaParaTela[]> {
  const { data, error } = await db.from("conforto_pendencias").select(COLUNAS_PENDENCIA).eq("contrato_id", contratoId).order("aberta_em");
  if (error) return [];
  return ((data ?? []) as unknown as Omit<PendenciaParaTela, "fechada" | "vencida">[]).map((p) => ({ ...p, fechada: pendenciaFechada(p, agora), vencida: pendenciaVencida(p, agora) }));
}
