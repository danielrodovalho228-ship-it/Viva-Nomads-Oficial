import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { MSG_OBSERVADOR, recusaComDeps, type AlvoObservador, type DepsObservador } from "./observador-regras";

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
