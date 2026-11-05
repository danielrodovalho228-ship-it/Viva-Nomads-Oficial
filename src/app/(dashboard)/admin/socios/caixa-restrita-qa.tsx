import Link from "next/link";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { rotuloDoAdmin } from "@/config/menu-admin";
import { TEXTO_CAIXA_RESTRITA_QA } from "@/lib/qa/observador-regras";

/**
 * E591: o que a observadora da QA vê em /admin/socios — o motivo (correspondência dos sócios, fechada) e o caminho das
 * premissas do modelo de custos (E559) em leitura. Não lê nada da Caixa.
 */
export function CaixaRestritaQa() {
  return (
    <>
      <PageTitle title={rotuloDoAdmin("/admin/socios")} />
      <Panel>
        <div className="space-y-3 text-sm text-ink" data-testid="caixa-restrita-qa">
          <p>{TEXTO_CAIXA_RESTRITA_QA.motivo}</p>
          <p>{TEXTO_CAIXA_RESTRITA_QA.caminho}</p>
          <Link href="/admin/premissas" className="inline-flex min-h-11 items-center font-semibold text-forest underline underline-offset-4">
            Abrir as premissas (leitura)
          </Link>
        </div>
      </Panel>
    </>
  );
}
