/**
 * Prompt 36, item 2 — o admin marca/desmarca uma conta como "de teste" pela tela (/admin/usuarios), sem migração.
 * Regra pura com as dependências injetadas (a server action em src/lib/data/conta-teste-actions.ts liga o Supabase):
 *  - só admin com 2FA (ehAdmin) muda; qualquer outra sessão recebe "Sem permissão." e nada é gravado;
 *  - grava pelo cliente de SERVIÇO (o gatilho da 0135 só deixa o servidor mudar profiles.is_teste);
 *  - registra no moderacao_log ("marcar_teste" | "desmarcar_teste", alvo "perfil");
 *  - revalida as vitrines de parceiros (a conta de teste sai da busca), a página do parceiro e o admin.
 */

export const AVISO_CONTA_TESTE = "Contas de teste ficam fora dos números reais, das buscas públicas e recebem e-mails na caixa de teste.";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResContaTeste = { ok: true; isTeste: boolean } | { ok: false; erro: string };

export type DepsContaTeste = {
  /** Id de quem está logado (null = sem sessão). */
  usuarioId: () => Promise<string | null>;
  /** Papel admin + AAL2, lido pela sessão da pessoa. */
  ehAdmin: (userId: string) => Promise<boolean>;
  /** Cliente de serviço; null quando a chave de serviço não está configurada. */
  servico: {
    /** Grava is_teste; devolve se alguma linha foi atualizada. */
    gravarIsTeste: (perfilId: string, valor: boolean) => Promise<boolean>;
    /** Slug do parceiro dessa conta (null se a conta não é parceira). */
    slugParceiro: (perfilId: string) => Promise<string | null>;
  } | null;
  log: (adminId: string, acao: "marcar_teste" | "desmarcar_teste", perfilId: string) => Promise<void>;
  revalidar: (caminho: string, tipo?: "layout" | "page") => void;
};

/** Caminhos revalidados depois de marcar/desmarcar (a página do parceiro só quando a conta tem uma). */
export function caminhosParaRevalidar(slug: string | null): { caminho: string; tipo?: "layout" | "page" }[] {
  const out: { caminho: string; tipo?: "layout" | "page" }[] = [
    { caminho: "/parceiros" },
    { caminho: "/parceiros/buscar" },
    { caminho: "/parceiros/fotografos" },
  ];
  if (slug && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) out.push({ caminho: `/parceiros/${slug}` });
  out.push({ caminho: "/admin", tipo: "layout" });
  return out;
}

export async function mudarContaTeste(deps: DepsContaTeste, perfilId: unknown, marcar: unknown): Promise<ResContaTeste> {
  if (typeof perfilId !== "string" || !UUID_RE.test(perfilId)) return { ok: false, erro: "Conta inválida." };
  if (typeof marcar !== "boolean") return { ok: false, erro: "Pedido inválido." };
  const userId = await deps.usuarioId();
  if (!userId || !(await deps.ehAdmin(userId))) return { ok: false, erro: "Sem permissão." };
  if (!deps.servico) return { ok: false, erro: "Indisponível agora." };
  const gravou = await deps.servico.gravarIsTeste(perfilId, marcar);
  if (!gravou) return { ok: false, erro: "Não foi possível salvar. Tente de novo." };
  await deps.log(userId, marcar ? "marcar_teste" : "desmarcar_teste", perfilId);
  const slug = await deps.servico.slugParceiro(perfilId).catch(() => null);
  for (const r of caminhosParaRevalidar(slug)) deps.revalidar(r.caminho, r.tipo);
  return { ok: true, isTeste: marcar };
}
