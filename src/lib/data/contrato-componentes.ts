import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { componentesDosBlocos, contasDoContrato, fatorDoBloco, type ComponentesBloco } from "@/lib/pagamento-componentes";

/*
  E1072 — o que o CONTRATO diz que cada bloco custa (aluguel, contas do período e limpeza de preparação), lido no
  servidor. Sem "use server": função interna, recebe o cliente de serviço de quem já provou que o contrato é dele.
  Fonte: a proposta acordada quando o contrato nasceu de uma (o Total do contrato que as partes aceitaram); sem
  proposta, as parcelas do mês congeladas no contrato na 1ª assinatura e a limpeza de preparação do anúncio.
*/
export interface BlocoDoContrato {
  numero: number;
  meses: number;
  inicio: string | null;
  fim: string | null;
  valor: number;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

/** As parcelas do mês congeladas no contrato (condomínio + contas fixas + pacote de limpeza pago). */
function extrasMesCongelados(congeladas: unknown): number {
  if (!congeladas || typeof congeladas !== "object") return 0;
  const c = congeladas as { outrosCustosMes?: unknown; limpezaEstadia?: { valorMes?: unknown } | null };
  return num(c.outrosCustosMes) + num(c.limpezaEstadia?.valorMes);
}

/** contratoId → (número do bloco → componentes). Falha de leitura LANÇA: quem chama decide se derruba a tela. */
export async function componentesDosContratos(
  admin: SupabaseClient,
  contratos: { id: string; prazoTotalDias: number; blocos: BlocoDoContrato[] }[],
): Promise<Map<string, Map<number, ComponentesBloco>>> {
  const out = new Map<string, Map<number, ComponentesBloco>>();
  if (contratos.length === 0) return out;
  const { data: linhas, error } = await admin.from("contratos").select("id, proposta_id, property_id, pets_regras_congeladas").in("id", contratos.map((c) => c.id));
  if (error) throw new Error(`componentes do contrato: ${error.message}`);
  const porId = new Map(((linhas ?? []) as { id: string; proposta_id: string | null; property_id: string | null; pets_regras_congeladas: unknown }[]).map((l) => [l.id, l]));

  const propostaIds = [...new Set([...porId.values()].map((l) => l.proposta_id).filter((x): x is string => !!x))];
  const versaoDaProposta = new Map<string, { total_contrato: number; limpeza_unica: number }>();
  if (propostaIds.length) {
    const [{ data: ps, error: e1 }, { data: vs, error: e2 }] = await Promise.all([
      admin.from("propostas").select("id, versao_atual").in("id", propostaIds),
      admin.from("proposta_versoes").select("proposta_id, versao, total_contrato, limpeza_unica").in("proposta_id", propostaIds),
    ]);
    if (e1 || e2) throw new Error(`componentes do contrato (proposta): ${(e1 ?? e2)!.message}`);
    for (const p of (ps ?? []) as { id: string; versao_atual: number }[]) {
      const v = ((vs ?? []) as { proposta_id: string; versao: number; total_contrato: number | string; limpeza_unica: number | string }[]).find((x) => x.proposta_id === p.id && Number(x.versao) === Number(p.versao_atual));
      if (v) versaoDaProposta.set(p.id, { total_contrato: num(v.total_contrato), limpeza_unica: num(v.limpeza_unica) });
    }
  }

  const semProposta = [...porId.values()].filter((l) => !l.proposta_id || !versaoDaProposta.has(l.proposta_id));
  const imovelIds = [...new Set(semProposta.map((l) => l.property_id).filter((x): x is string => !!x))];
  const preparacaoDoImovel = new Map<string, number>();
  if (imovelIds.length) {
    const { data: ims, error: e3 } = await admin.from("properties").select("id, prep_fee").in("id", imovelIds);
    if (e3) throw new Error(`componentes do contrato (imóvel): ${e3.message}`);
    for (const i of (ims ?? []) as { id: string; prep_fee: number | string | null }[]) preparacaoDoImovel.set(i.id, num(i.prep_fee));
  }

  for (const c of contratos) {
    const linha = porId.get(c.id);
    const blocos = c.blocos.map((b) => ({ numero: b.numero, valor: b.valor, fator: fatorDoBloco(b, c.prazoTotalDias) }));
    const versao = linha?.proposta_id ? versaoDaProposta.get(linha.proposta_id) : undefined;
    const limpezaPreparacao = versao ? versao.limpeza_unica : (linha?.property_id ? (preparacaoDoImovel.get(linha.property_id) ?? 0) : 0);
    const contas = contasDoContrato({
      totalContratoDaProposta: versao ? versao.total_contrato : null,
      aluguelDosBlocos: blocos.reduce((s, b) => s + b.valor, 0),
      limpezaPreparacao,
      extrasMesCongelados: extrasMesCongelados(linha?.pets_regras_congeladas),
      fatorDaEstadia: blocos.reduce((s, b) => s + b.fator, 0),
    });
    out.set(c.id, componentesDosBlocos({ blocos, contasDoContrato: contas, limpezaPreparacao }));
  }
  return out;
}
