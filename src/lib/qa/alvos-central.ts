import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { LinhaCentral } from "@/lib/admin/central-pendencias";
import type { LinhaDaTela } from "./observador-regras";

/*
  E477 — o alvo das ações em um toque da Central de Pendências, o MESMO que a ação do servidor passa a recusaObservador:
    • fotos_nivel → o imóvel (analisarFotoNivel);
    • conforto_contestacoes → o imóvel da pendência (agirNaPendencia "decidir");
    • avaliacoes_contestadas → o autor e o avaliado (decidirRevisaoAvaliacao).
  Linhas sem ação na tela ficam de fora. Leitura que falha deixa a linha sem alvo → só leitura para o observador (falha
  fechada; quem não é observador nunca é afetado).
*/
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export const chaveDaLinha = (l: Pick<LinhaCentral, "filtro" | "id">) => `${l.filtro}:${l.id}`;

/**
 * `semAlvo` (E477, resíduo): a Central é só leitura para a observadora em TODA linha — de dado real ou de teste. As linhas com
 * ação entram sem alvo (a regra do observador trata como "proibida sempre") e nenhuma leitura de dono é feita.
 */
const TEM_ACAO = (l: LinhaCentral) =>
  (l.filtro === "fotos_nivel" && !!l.ref?.imovel) || (l.filtro === "conforto_contestacoes" && !!l.ref?.pendencia) || (l.filtro === "avaliacoes_contestadas" && !!l.ref?.revisao);

export async function alvosDaCentral(admin: Admin | null, linhas: readonly LinhaCentral[], semAlvo = false): Promise<LinhaDaTela[]> {
  if (semAlvo) return linhas.filter(TEM_ACAO).map((l) => ({ id: chaveDaLinha(l) }));
  const pendencias = linhas.filter((l) => l.filtro === "conforto_contestacoes" && l.ref?.pendencia);
  const revisoes = linhas.filter((l) => l.filtro === "avaliacoes_contestadas" && l.ref?.revisao);
  const imovelDaPendencia = new Map<string, string>();
  const perfisDaRevisao = new Map<string, string[]>();
  if (admin && pendencias.length) {
    const { data } = await admin.from("conforto_pendencias").select("id, property_id").in("id", pendencias.map((l) => l.ref!.pendencia));
    for (const p of (data ?? []) as { id: string; property_id: string | null }[]) if (p.property_id) imovelDaPendencia.set(p.id, p.property_id);
  }
  if (admin && revisoes.length) {
    const { data: cs } = await admin.from("avaliacao_contestacoes").select("id, avaliacao_id").in("id", revisoes.map((l) => l.ref!.revisao));
    const contestacoes = (cs ?? []) as { id: string; avaliacao_id: string }[];
    const { data: avs } = contestacoes.length ? await admin.from("avaliacoes").select("id, autor_id, alvo_id").in("id", contestacoes.map((c) => c.avaliacao_id)) : { data: [] };
    const porAvaliacao = new Map(((avs ?? []) as { id: string; autor_id: string; alvo_id: string }[]).map((a) => [a.id, [a.autor_id, a.alvo_id]]));
    for (const c of contestacoes) {
      const perfis = porAvaliacao.get(c.avaliacao_id);
      if (perfis) perfisDaRevisao.set(c.id, perfis);
    }
  }
  const alvos: LinhaDaTela[] = [];
  for (const l of linhas) {
    const id = chaveDaLinha(l);
    if (l.filtro === "fotos_nivel" && l.ref?.imovel) alvos.push({ id, alvo: { imoveis: [l.ref.imovel] } });
    else if (l.filtro === "conforto_contestacoes" && l.ref?.pendencia) {
      const imovel = imovelDaPendencia.get(l.ref.pendencia);
      alvos.push(imovel ? { id, alvo: { imoveis: [imovel] } } : { id });
    } else if (l.filtro === "avaliacoes_contestadas" && l.ref?.revisao) {
      const perfis = perfisDaRevisao.get(l.ref.revisao);
      alvos.push(perfis ? { id, alvo: { perfis } } : { id });
    }
  }
  return alvos;
}
