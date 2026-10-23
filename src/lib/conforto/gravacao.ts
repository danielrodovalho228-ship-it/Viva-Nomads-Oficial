/*
  59-C1 — gravação do checklist do padrão mínimo, sem imports @/ (testável com node --test).

  O que deu errado em produção (rascunho 9f18c108, 23/10): o checklist não entrava no autosave; depois de recarregar a
  página, o estado da tela voltava vazio e o "Salvar como rascunho" mandou confortoConfirmados = [], que DESMARCOU os 12
  itens no servidor. Daqui em diante:
  - a lista só é gravada quando o dono mexeu no checklist nesta sessão (depois de carregar o que já estava salvo);
  - ausente ou sem a marca de "mexido" = não mexe em nada.
*/
import { CHAVES_CONFORTO } from "../../config/conforto-minimo.ts";
import { linhasConfirmacao } from "./regras.ts";

/** O que gravar do checklist vindo do editor; null = não mexe no que está salvo. */
export function confortoParaGravar(lista: unknown, mexido: unknown): string[] | null {
  if (mexido !== true || !Array.isArray(lista)) return null;
  return lista.filter((k): k is string => typeof k === "string");
}

type Resposta = { error: { code?: string | null; message?: string | null } | null };
// Cliente Supabase do servidor, tipado frouxo de propósito (o mesmo padrão de rascunho-dono.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any;

export type ResultadoGravacao = { ok: true } | { ok: false; code: string | null; message: string | null };

/**
 * Grava a confirmação: os marcados viram confirmados na versão atual; os outros itens da lista deixam de valer.
 * Quem chama já conferiu que `donoId` é o dono do imóvel e que a lista é uma decisão explícita dele.
 */
export async function gravarDeclaracoes(db: Cliente, propertyId: string, donoId: string, marcados: readonly unknown[], agora: Date): Promise<ResultadoGravacao> {
  const linhas = linhasConfirmacao(propertyId, marcados, donoId, agora);
  const desmarcados = CHAVES_CONFORTO.filter((k) => !linhas.some((l) => l.chave === k));
  if (linhas.length) {
    const { error }: Resposta = await db.from("conforto_declaracoes").upsert(linhas, { onConflict: "property_id,chave" });
    if (error) return { ok: false, code: error.code ?? null, message: error.message ?? null };
  }
  if (desmarcados.length) {
    const { error }: Resposta = await db.from("conforto_declaracoes").update({ confirmado: false }).eq("property_id", propertyId).in("chave", desmarcados);
    if (error) return { ok: false, code: error.code ?? null, message: error.message ?? null };
  }
  return { ok: true };
}
