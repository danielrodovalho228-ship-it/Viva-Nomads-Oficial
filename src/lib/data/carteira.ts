import { createAdminClient } from "@/lib/supabase/admin";
import { listMyProperties } from "@/lib/data/properties";
import { getMeusContratos } from "@/lib/data/contratos-actions";
import { montarCarteira, type ItemCarteira } from "@/lib/carteira-dono";
import { nomeCurto } from "@/lib/perfil/perfil-publico";
import { hojeBR } from "@/lib/utils";

/**
 * Análise da carteira do proprietário (complemento do prompt 27, item 8), lida do BANCO: os imóveis ativos do dono
 * e os contratos dele pelas mesmas leituras de "Meus imóveis" e "Contratos & blocos" (sessão do dono → RLS).
 * O nome curto do morador só existe porque há contrato (depois do aceite); é lido no servidor.
 * Conta de teste (is_teste) vê os próprios dados de teste normalmente — só as métricas do admin as deixam de fora.
 */
export async function getCarteiraDoDono(hojeISO = hojeBR()): Promise<ItemCarteira[]> {
  const [props, contratos] = await Promise.all([listMyProperties(), getMeusContratos()]);
  const ativos = props.filter((p) => p.status === "active");
  if (ativos.length === 0) return [];
  const idsInquilinos = [...new Set(contratos.filter((c) => c.status === "ativo").map((c) => c.tenantId).filter(Boolean))];
  const admin = createAdminClient();
  const { data: perfis } =
    admin && idsInquilinos.length ? await admin.from("profiles").select("id, full_name").in("id", idsInquilinos) : { data: null };
  const nomes = new Map(((perfis ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, nomeCurto(p.full_name)]));
  return montarCarteira(
    ativos.map((p) => ({ id: p.id, titulo: p.title, bairro: p.neighborhood })),
    contratos.map((c) => ({
      id: c.id,
      propertyId: c.propertyId,
      status: c.status,
      etapa: c.etapa,
      selo: c.estado.selo,
      valorMensal: c.aluguelMensal,
      blocos: c.blocos.map((b) => ({ inicio: b.inicio, fim: b.fim })),
      morador: nomes.get(c.tenantId) ?? null,
    })),
    hojeISO,
  );
}
