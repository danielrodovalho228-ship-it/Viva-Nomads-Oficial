import { soLeituraNaTela } from "@/lib/qa/observador";
import { SoLeituraQa } from "@/components/admin/so-leitura-qa";
import { Percent } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { dataBRT } from "@/lib/datas-brasilia";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";
import { ROTULO_ESTADO, estadosDasFixacoes, pctDaTaxa, type LinhaFixacao } from "@/lib/cobranca/fixacao-admin";
import { FormTaxaFixada } from "./form";

export const metadata = { title: tituloDoAdmin("/admin/taxas-fixadas"), robots: { index: false, follow: false } };

type Linha = LinhaFixacao & { criado_por: string | null };

/** Lido com o cliente de serviço, depois do portão do admin (layout). null = a leitura falhou (a tela diz). */
async function fixacoes(): Promise<{ linhas: Linha[]; nomes: Map<string, { nome: string; email: string }> } | null> {
  const admin = createAdminClient();
  if (!admin) return { linhas: [], nomes: new Map() };
  const { data, error } = await admin.from("comissao_fixada_admin").select("id, owner_id, taxa, motivo, valido_ate, criado_em, criado_por").order("criado_em", { ascending: false }).limit(200);
  if (error) return null;
  const linhas = (data ?? []) as Linha[];
  const ids = [...new Set(linhas.flatMap((l) => [l.owner_id, l.criado_por].filter((x): x is string => !!x)))];
  const nomes = new Map<string, { nome: string; email: string }>();
  if (ids.length) {
    const { data: ps } = await admin.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of (ps ?? []) as { id: string; full_name: string | null; email: string | null }[]) nomes.set(p.id, { nome: p.full_name ?? "—", email: p.email ?? "" });
  }
  return { linhas, nomes };
}

/**
 * E977 (Família 8): a taxa fixada pelo admin — condição caso a caso (carteira grande, administradora, acordo), com motivo e
 * validade. Antes só por SQL. A cobrança usa, por proprietário, a mais recente ainda dentro da validade.
 */
export default async function TaxasFixadasPage() {
  const agora = new Date();
  const lidas = await fixacoes();
  const soLeitura = (await soLeituraNaTela([{ id: "configuracao" }])).length > 0;
  const hoje = new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  const linhas = lidas ? estadosDasFixacoes(lidas.linhas, agora) : [];
  return (
    <div className="space-y-6">
      <PageTitle title={rotuloDoAdmin("/admin/taxas-fixadas")} subtitle="Condição caso a caso, com motivo e validade. Vale nos contratos assinados dentro da validade; vencida, volta a faixa." />
      <Panel title="Registrar taxa fixada" id="registrar">
        {soLeitura ? <SoLeituraQa /> : <FormTaxaFixada hoje={hoje} />}
      </Panel>
      <Panel title="Histórico" id="historico">
        {!lidas ? (
          <p role="alert" className="text-sm text-red-600" data-testid="taxas-fixadas-erro-leitura">Não foi possível ler as taxas fixadas agora.</p>
        ) : linhas.length === 0 ? (
          <EmptyState icon={Percent} title="Nenhuma taxa fixada" text="Quando você registrar uma, ela aparece aqui com o motivo e a validade." action={<a href="#registrar" className="alvo-toque font-semibold text-forest underline">Registrar a primeira</a>} />
        ) : (
          <ul className="divide-y divide-sage-200" data-testid="taxas-fixadas-lista">
            {linhas.map((l) => {
              const dono = lidas.nomes.get(l.owner_id);
              const por = l.criado_por ? lidas.nomes.get(l.criado_por) : null;
              return (
                <li key={l.id} className="py-3 text-sm" data-testid="taxa-fixada-linha" data-estado={l.estado}>
                  <p className="font-semibold text-ink">
                    {dono?.nome ?? "Conta removida"} · {pctDaTaxa(l.taxa)} · <span className={l.estado === "vigente" ? "text-forest" : "text-muted"}>{ROTULO_ESTADO[l.estado]}</span>
                  </p>
                  <p className="text-muted">{dono?.email} · vale até {dataBRT(l.valido_ate)} · registrada em {dataBRT(l.criado_em)}{por ? ` por ${por.nome}` : ""}</p>
                  <p className="mt-1 text-ink">{l.motivo}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
