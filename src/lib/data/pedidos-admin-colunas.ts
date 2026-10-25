import type { createAdminClient } from "@/lib/supabase/admin";
import { primeiroNome } from "@/lib/display-name";
import { estadosIdentidade } from "@/lib/identidade/estado-servidor";
import { selosDoPedido, type SeloPedido } from "@/lib/pedidos/confirmacao";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export interface ColunasPedidoAdmin {
  nome: string;
  selos: SeloPedido[];
  respostas: number;
}

/**
 * Colunas da lista da equipe (Prompt 30, item 7): nome curto do inquilino, selos (e-mail, identidade, telefone) e
 * quantas respostas de donos o pedido recebeu. Server-only; nunca contato.
 */
export async function colunasPedidosAdmin(admin: Admin, pedidos: { id: string; inquilino_id: string }[]): Promise<Map<string, ColunasPedidoAdmin>> {
  const out = new Map<string, ColunasPedidoAdmin>();
  if (!pedidos.length) return out;
  const inqIds = [...new Set(pedidos.map((p) => p.inquilino_id))];
  const [{ data: perfis }, { data: resps }, { data: tvs }, identidades] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", inqIds),
    admin.from("respostas_pedido").select("pedido_id").in("pedido_id", pedidos.map((p) => p.id)),
    admin.from("telefone_verificacao").select("user_id, verificado_em").in("user_id", inqIds),
    estadosIdentidade(admin, inqIds).catch(() => new Map()),
  ]);
  const nome = new Map(((perfis ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, primeiroNome(p.full_name) || "—"]));
  const nResp = new Map<string, number>();
  for (const r of (resps ?? []) as { pedido_id: string }[]) nResp.set(r.pedido_id, (nResp.get(r.pedido_id) ?? 0) + 1);
  const verificado = new Set(((tvs ?? []) as { user_id: string; verificado_em: string | null }[]).filter((t) => t.verificado_em).map((t) => t.user_id));
  // E-mail e telefone confirmados vêm do auth (um por pessoa; listas da equipe são curtas).
  const contatos = new Map<string, { email: boolean; telefone: boolean }>();
  await Promise.all(
    inqIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id).catch(() => ({ data: null }));
      const u = data?.user;
      contatos.set(id, { email: !!u?.email_confirmed_at, telefone: !!u?.phone_confirmed_at && verificado.has(id) });
    }),
  );
  for (const p of pedidos) {
    const c = contatos.get(p.inquilino_id) ?? { email: false, telefone: false };
    out.set(p.id, {
      nome: nome.get(p.inquilino_id) ?? "—",
      selos: selosDoPedido({ emailConfirmado: c.email, telefoneConfirmado: c.telefone, identidadeConfirmada: identidades.get(p.inquilino_id)?.estado === "confirmada" }),
      respostas: nResp.get(p.id) ?? 0,
    });
  }
  return out;
}
