import type { SupabaseClient } from "@supabase/supabase-js";
import { FAIXAS_COMISSAO_PADRAO, taxaNaAssinatura, type FaixaComissao, type TaxaAplicada } from "./regra.ts";
import { ativosDeVerdade } from "./carteira-ativa.ts";
import { statusPorImovel } from "../documento/vigente.ts";

/**
 * A taxa do dono AGORA, com a regra inteira de src/lib/cobranca/regra.ts (especificação de testes da taxa, 19/10):
 *  • R2 faixa pelos imóveis ATIVOS DE VERDADE (E565: publicado + documento aprovado + calendário confirmado nos
 *    últimos 30 dias — carteira-ativa.ts), lida de faixas_comissao;
 *  • R3 queda de faixa: a taxa anterior vale por mais 30 dias (faixa_dono, mantida por gatilho — migração 0172);
 *  • R4 fixação do admin com motivo e validade (comissao_fixada_admin) prevalece.
 * Fonte única do servidor para o aceite da candidatura, o envio e o aceite da proposta. Só o servidor chama
 * (cliente admin); nunca vai para a tela do morador.
 */
export interface TaxaDoDono extends TaxaAplicada {
  imoveisAtivos: number;
}

type Admin = SupabaseClient;

/** Achado 83: a taxa do dono não pôde ser lida — nada que congela a taxa segue com um valor de outra fonte. */
export const MSG_TAXA_SEM_LEITURA = "Não foi possível conferir a sua taxa agora. Tente de novo em instantes.";

export async function faixasVigentes(admin: Admin): Promise<readonly FaixaComissao[]> {
  {
    const { data, error } = await admin.from("faixas_comissao").select("min_imoveis, max_imoveis, taxa").order("min_imoveis");
    // Achado 83: falha de leitura não vira as faixas PADRÃO (a taxa congelada no aceite sairia de outra tabela).
    // Tabela sem linhas (nada configurado) segue no padrão.
    if (error) throw new Error(MSG_TAXA_SEM_LEITURA);
    const linhas = (data ?? []) as { min_imoveis: number; max_imoveis: number | null; taxa: number | string }[];
    if (!linhas.length) return FAIXAS_COMISSAO_PADRAO;
    return linhas.map((l) => ({
      minImoveis: Number(l.min_imoveis),
      maxImoveis: l.max_imoveis == null ? null : Number(l.max_imoveis),
      taxa: Number(l.taxa),
      // E564: a faixa sem teto é a do Plano Gestor (4%); a antiga faixa negociável saiu.
      ...(l.max_imoveis == null ? { gestor: true } : {}),
    }));
  }
}

type LinhaPublicado = { id: string; status: string; disponibilidade_confirmada_em: string | null };

/**
 * E565: quantos imóveis publicados contam para a faixa — documento VIGENTE aprovado e calendário em dia
 * (carteira-ativa.ts). A leitura que falha LANÇA (nunca uma contagem parcial que mudaria a taxa).
 */
export async function contarAtivosDeVerdade(client: Admin, publicados: readonly LinhaPublicado[], agora: Date = new Date()): Promise<number> {
  if (!publicados.length) return 0;
  const { data: qc, error } = await client
    .from("qualification_checklists")
    .select("property_id, document_status, created_at")
    .in("property_id", publicados.map((l) => l.id))
    .order("created_at", { ascending: false });
  if (error) throw new Error(MSG_TAXA_SEM_LEITURA);
  const docs = statusPorImovel((qc ?? []) as { property_id: string; document_status: string | null }[]);
  return ativosDeVerdade(
    publicados.map((l) => ({ status: l.status, documento: docs.get(l.id) ?? "none", calendarioConfirmadoEm: l.disponibilidade_confirmada_em })),
    agora,
  );
}

/** As colunas de properties que a contagem da faixa lê (use com .eq("status", "active")). */
export const COLUNAS_FAIXA = "id, status, disponibilidade_confirmada_em";

export async function taxaDoDonoAgora(admin: Admin, ownerId: string, agora: Date = new Date()): Promise<TaxaDoDono> {
  const [{ data: publicados, error: e1 }, faixas, { data: fix, error: e2 }, { data: fd, error: e3 }] = await Promise.all([
    admin.from("properties").select("id, status, disponibilidade_confirmada_em").eq("owner_id", ownerId).eq("status", "active"),
    faixasVigentes(admin),
    admin
      .from("comissao_fixada_admin")
      .select("taxa, motivo, valido_ate")
      .eq("owner_id", ownerId)
      .gte("valido_ate", agora.toISOString())
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("faixa_dono").select("taxa_anterior, queda_em").eq("owner_id", ownerId).maybeSingle(),
  ]);
  // E564: conta de administradora é Plano Gestor (4%) qualquer que seja a carteira.
  const { data: perfil, error: e5 } = await admin.from("profiles").select("account_type").eq("id", ownerId).maybeSingle();
  // Achado 83: sem ler os imóveis ativos, a fixação do admin ou a queda de 30 dias, a taxa não é calculada (lança).
  if (e1 || e2 || e3 || e5) throw new Error(MSG_TAXA_SEM_LEITURA);
  const imoveisAtivos = await contarAtivosDeVerdade(admin, (publicados ?? []) as LinhaPublicado[], agora);
  const f = fix as { taxa: number | string; motivo: string; valido_ate: string } | null;
  const q = fd as { taxa_anterior: number | string | null; queda_em: string | null } | null;
  const t = taxaNaAssinatura({
    tipo: "novo",
    imoveisAtivos,
    assinadoEm: agora,
    faixas,
    fixadaPeloAdmin: f ? { taxa: Number(f.taxa), motivo: String(f.motivo ?? ""), validoAte: new Date(f.valido_ate) } : null,
    queda: q?.taxa_anterior != null && q.queda_em ? { taxaAnterior: Number(q.taxa_anterior), em: new Date(q.queda_em) } : null,
    administradora: (perfil as { account_type?: string | null } | null)?.account_type === "gestor",
  });
  return { ...t, imoveisAtivos };
}
