import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehObservadorQa } from "@/lib/qa/observador";
import { ModeloFinanceiro } from "@/components/financeiro/modelo-financeiro";

export const metadata = { title: "Premissas (leitura) · Admin" };

/**
 * E591 — as premissas do modelo de custos (E559) para a observadora da QA, SÓ LEITURA: o MESMO modelo do /simulacao no
 * modo do investidor (cálculo no navegador, sem gravar nada; fonte única em src/config/premissas-financeiras.ts). A
 * Caixa dos Sócios (correspondência) segue fechada para ela. Admin comum continua pela porta dos sócios (/simulacao
 * com o código): a regra "sem exceção para admin" das páginas internas não muda. Checagem que falha → error.tsx.
 */
export default async function PremissasLeituraPage() {
  const supabase = await createClient();
  const uid = supabase ? (await supabase.auth.getUser()).data.user?.id : null;
  if (!(await ehObservadorQa(uid))) redirect("/simulacao");
  return (
    <div data-testid="premissas-leitura">
      <ModeloFinanceiro pagina="simulacao" leitura />
    </div>
  );
}
