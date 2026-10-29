import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { chaveDono, linhasSoLeitura, MSG_OBSERVADOR, recusaComDeps, type AlvoObservador, type DepsObservador, type LinhaDaTela } from "./observador-regras";

/*
  QA-LOGIN-B v2 — admin observador da QA (profiles.qa_admin). Ele é admin (role admin + 2FA próprio, aal2), mas:
    • nunca: chaves da plataforma, tipo/marca de teste de conta, Caixa dos Sócios (também na RLS), backup;
    • sobre dados REAIS (conta, imóvel, documento, pedido, parceiro de quem não é is_teste): só leitura;
    • filas e ações sobre dados de TESTE continuam liberadas.
  Uso nas server actions do admin, logo depois do ehAdmin:
    const recusaQa = await recusaObservador(user.id, { imoveis: [id] });   // ou sem alvo: ação proibida sempre
    if (recusaQa) return { ok: false, error: recusaQa };
  A regra está em ./observador-regras.ts (testada com dependências falsas). Quem não é observador nunca é afetado.
*/

export { MSG_OBSERVADOR };

const COLUNA_DONO = { properties: "owner_id", pedidos_moradia: "inquilino_id", qualification_checklists: "owner_id" } as const;

function deps(admin: NonNullable<ReturnType<typeof createAdminClient>>): DepsObservador {
  return {
    async qaAdmin(userId) {
      const { data } = await admin.from("profiles").select("qa_admin").eq("id", userId).maybeSingle();
      return (data as { qa_admin?: boolean } | null)?.qa_admin === true;
    },
    async donos(tabela, ids) {
      const col = COLUNA_DONO[tabela];
      const { data } = await admin.from(tabela).select(`id, ${col}`).in("id", ids);
      return ((data ?? []) as unknown as Record<string, unknown>[]).map((l) => l[col]).filter((x): x is string => typeof x === "string");
    },
    async perfisTeste(ids) {
      const { data } = await admin.from("profiles").select("id, is_teste").in("id", ids);
      return new Set(((data ?? []) as { id: string; is_teste: boolean | null }[]).filter((p) => p.is_teste === true).map((p) => p.id));
    },
  };
}

/** A conta é o admin observador da QA? Sem o cliente de serviço → false (quem decide o admin é o ehAdmin). */
export async function ehObservadorQa(userId: string | null | undefined): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin || !userId) return false;
  return deps(admin).qaAdmin(userId);
}

/** Mensagem de recusa para o admin observador, ou null (pode seguir). Sem `alvo`: proibida para ele sempre. */
export async function recusaObservador(userId: string | null | undefined, alvo?: AlvoObservador): Promise<string | null> {
  if (!userId) return null;
  const admin = createAdminClient();
  // Sem o cliente de serviço não há como ler qa_admin; as ações do admin também não gravam sem ele.
  if (!admin) return null;
  return recusaComDeps(deps(admin), userId, alvo);
}

/**
 * Na tela: os ids das linhas em que a sessão atual (se for o admin observador da QA) só pode ler — o servidor recusaria
 * a ação. Quem não é observador: [] (uma leitura só, sem tocar nas linhas). Os botões dessas linhas saem da tela.
 */
export async function soLeituraNaTela(linhas: readonly LinhaDaTela[]): Promise<string[]> {
  const admin = createAdminClient();
  const supabase = await createClient();
  if (!admin || !supabase || !linhas.length) return [];
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid || !(await deps(admin).qaAdmin(uid))) return [];
  const donoDe = new Map<string, string>();
  for (const [tabela, chave] of [
    ["properties", "imoveis"],
    ["pedidos_moradia", "pedidosMoradia"],
    ["qualification_checklists", "documentos"],
  ] as const) {
    const ids = [...new Set(linhas.flatMap((l) => l.alvo?.[chave] ?? []).filter((x): x is string => !!x))];
    if (!ids.length) continue;
    const col = COLUNA_DONO[tabela];
    const { data } = await admin.from(tabela).select(`id, ${col}`).in("id", ids);
    for (const l of (data ?? []) as unknown as Record<string, unknown>[]) {
      if (typeof l[col] === "string") donoDe.set(chaveDono(tabela, String(l.id)), l[col] as string);
    }
  }
  const perfis = [...new Set([...linhas.flatMap((l) => l.alvo?.perfis ?? []), ...donoDe.values()].filter((x): x is string => !!x))];
  const teste = perfis.length ? await deps(admin).perfisTeste(perfis) : new Set<string>();
  return linhasSoLeitura(true, linhas, donoDe, teste);
}
