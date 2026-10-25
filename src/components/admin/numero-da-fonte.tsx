import { createAdminClient } from "@/lib/supabase/admin";
import { contarAnunciosPublicados, contarChamadosAbertos, contarEstadiasAtivas, contarPedidosNoAr, contarUsuarios } from "@/lib/data/admin-contagens";
import { ROTULOS_NUMEROS, textoRealTeste, type Contagem } from "@/lib/admin/contagens";

const FONTE = {
  estadias: contarEstadiasAtivas,
  anuncios: contarAnunciosPublicados,
  pedidos: contarPedidosNoAr,
  chamados: contarChamadosAbertos,
  usuarios: contarUsuarios,
} as const;
const ROTULO = { ...Object.fromEntries(Object.entries(ROTULOS_NUMEROS).map(([k, v]) => [k, v.rotulo])), usuarios: "Usuários" } as Record<keyof typeof FONTE, string>;

/**
 * ADMIN-4 — o número da página de destino, pela MESMA função da inicial do /admin ("N reais · M de teste"). Assim o
 * número da inicial e o da página nunca divergem. O layout de /admin já exige admin.
 */
export async function NumeroDaFonte({ chave }: { chave: keyof typeof FONTE }) {
  const admin = createAdminClient();
  const c: Contagem | null = admin ? await FONTE[chave](admin).catch(() => null) : null;
  if (!c) return null;
  return (
    <p className="mb-4 text-sm text-ink" data-testid={`numero-fonte-${chave}`} data-reais={c.reais} data-teste={c.teste}>
      <span className="font-semibold">{ROTULO[chave]}:</span> {textoRealTeste(c)}
    </p>
  );
}
