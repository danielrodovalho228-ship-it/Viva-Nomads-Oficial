/*
  E1077-b1 (ORDEM-DUET-378/379): a lista do piloto da avaliação (vistoria_piloto, migração 0350) pela Central, em
  /admin/avaliadores, seção "Contas no teste da avaliação". PURO (node --test): a leitura do formulário e as linhas da
  tela. As ações (exigirAdmin + recusaObservador) estão em ./actions.ts. Entrar na lista não envia aviso nem convite.
*/

export const TITULO_SECAO_PILOTO = "Contas no teste da avaliação";
export const TEXTO_PILOTO_VAZIO = "Nenhuma conta no teste da avaliação.";
export const MSG_CONTA_NAO_ENCONTRADA = "Conta não encontrada";
export const NOTA_PILOTO_MAX = 200;
export const ROTULO_CONTA_TESTE = "conta de teste";

export type EntradaPiloto = { ok: true; email: string; nota: string | null } | { ok: false; erro: string };

/** O e-mail (obrigatório, minúsculo) e a nota opcional (até 200 caracteres) do formulário de adicionar. */
export function lerEntradaPiloto(email: unknown, nota: unknown): EntradaPiloto {
  const e = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, erro: "Informe o e-mail da conta." };
  const n = String(nota ?? "").replace(/\s+/g, " ").trim();
  if (n.length > NOTA_PILOTO_MAX) return { ok: false, erro: `A nota tem no máximo ${NOTA_PILOTO_MAX} caracteres.` };
  return { ok: true, email: e, nota: n || null };
}

/** Para procurar o e-mail sem diferença de maiúsculas: escapa os curingas do ilike (% e _). */
export function emailParaIlike(email: string): string {
  return email.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface LinhaPilotoTela {
  userId: string;
  nome: string;
  email: string;
  teste: boolean;
  entrouEm: string;
  nota: string | null;
}

/** As linhas da seção: cada conta da lista com o perfil (nome, e-mail, marca de teste), da entrada mais antiga à mais nova. */
export function linhasDoPiloto(
  piloto: readonly { user_id: string; nota: string | null; criado_em: string }[],
  perfis: readonly { id: string; full_name: string | null; email: string | null; is_teste: boolean | null }[],
): LinhaPilotoTela[] {
  const porId = new Map(perfis.map((p) => [p.id, p]));
  return [...piloto]
    .sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em))
    .map((l) => {
      const p = porId.get(l.user_id);
      return { userId: l.user_id, nome: p?.full_name?.trim() || "—", email: p?.email ?? "—", teste: p?.is_teste === true, entrouEm: l.criado_em, nota: l.nota };
    });
}
