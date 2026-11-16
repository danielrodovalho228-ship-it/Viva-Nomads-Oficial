/*
  E953 — excluir rascunho em "Meus imóveis". A ordem das leituras e das recusas, com o cliente injetado (testável sem
  banco; quem chama é deleteProperty, em actions.ts, com o cliente da SESSÃO do dono).
  Causa do defeito (E705, commit 21c7b1687): a função lia `draft_data` por SELECT de coluna com a sessão do usuário.
  Desde o C4 essa coluna está fora do SELECT por coluna do papel `authenticated` (só chega pela RPC
  property_private_details, escopada ao dono): a leitura dava erro e a exclusão parava ANTES de apagar — para todo dono.
  Agora:
   • a linha é lida SEM draft_data, com owner_id = usuário na consulta (só o dono);
   • só RASCUNHO é excluído aqui (publicado sai do ar pela pausa) — recusa no servidor, não só na tela;
   • draft_data vem pela RPC; se a RPC ou a lista das fotos falhar, PARA antes de apagar (sem a lista, as fotos ficariam
     no bucket sem nada que aponte para elas);
   • nunca o cliente admin para ler o rascunho.
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { urlsDeFotosDoRascunho } from "../minimizacao/fotos-rascunho.ts";

export const ERRO_EXCLUIR_RASCUNHO = "Não foi possível excluir o rascunho agora. Tente de novo.";
export const ERRO_SO_RASCUNHO = "Só rascunho pode ser excluído aqui. Um anúncio publicado sai do ar pela pausa.";
export const ERRO_RASCUNHO_NAO_ENCONTRADO = "Não encontramos este rascunho. Ele pode já ter sido excluído.";

/** O cliente da SESSÃO do dono (nunca o admin). Nos testes, um falso que registra as chamadas. */
export type ClienteExclusao = SupabaseClient;

export type ResultadoExclusao = { ok: true; urlsFotos: string[] } | { ok: false; error: string; erroBanco?: unknown };

export async function excluirRascunhoDoDono(db: ClienteExclusao, userId: string, id: string): Promise<ResultadoExclusao> {
  // A conferência de dono: owner_id na consulta, e a linha sem draft_data (coluna fora do SELECT da sessão, C4).
  const { data: linha, error: erroLinha } = (await db.from("properties").select("id, status").eq("id", id).eq("owner_id", userId).maybeSingle()) as { data: { id: string; status: string } | null; error: unknown };
  if (erroLinha) return { ok: false, error: ERRO_EXCLUIR_RASCUNHO };
  if (!linha) return { ok: false, error: ERRO_RASCUNHO_NAO_ENCONTRADO };
  if (linha.status !== "draft") return { ok: false, error: ERRO_SO_RASCUNHO };

  // C4: draft_data pela RPC escopada ao dono; as fotos do anúncio pela tabela. Sem as duas listas, não apaga nada.
  const [privado, fotos] = await Promise.all([db.rpc("property_private_details", { prop_id: id }), db.from("property_photos").select("url").eq("property_id", id)]);
  if (privado.error || fotos.error) return { ok: false, error: ERRO_EXCLUIR_RASCUNHO };
  const linhaPrivada = (Array.isArray(privado.data) ? privado.data[0] : privado.data) as { draft_data?: unknown } | null | undefined;

  for (const tabela of ["property_photos", "property_amenities", "property_proximities"]) {
    try {
      await db.from(tabela).delete().eq("property_id", id);
    } catch {
      /* tabela ausente — ignora */
    }
  }
  // Mesmo filtro de dono E de rascunho no DELETE: um publicado nunca sai por aqui, nem numa corrida.
  const { error: erroApagar } = await db.from("properties").delete().eq("id", id).eq("owner_id", userId).eq("status", "draft");
  if (erroApagar) return { ok: false, error: ERRO_EXCLUIR_RASCUNHO, erroBanco: erroApagar };
  const urlsFotos = [...((fotos.data ?? []) as { url: string }[]).map((f) => f.url), ...urlsDeFotosDoRascunho(linhaPrivada?.draft_data)];
  return { ok: true, urlsFotos };
}
