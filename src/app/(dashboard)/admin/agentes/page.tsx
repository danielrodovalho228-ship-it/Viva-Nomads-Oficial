import type { Metadata } from "next";
import { carregarCentral, chamadosEmVermelho, postarRetornosDoMoacir } from "@/lib/data/agentes-actions";
import { dispararEncaminhamentosDaSessao } from "@/lib/agentes/servidor";
import { CentralAgentes } from "./central-client";
import { abaDaUrl } from "@/lib/admin/agentes-abas";
import { adminDaPagina, contadoresAgentes } from "@/lib/data/admin-indicadores";
import { AGENTES_DEFINICOES } from "@/lib/admin/indicadores";
import { tituloDoAdmin } from "@/config/menu-admin";

export const metadata: Metadata = { title: tituloDoAdmin("/admin/agentes") };

/** Central de Agentes (admin). O layout de /admin já exige papel admin. */
export default async function AgentesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  // Achado P0/P1 encaminhado a outro agente (0087) dispara a rotina dele na hora.
  await dispararEncaminhamentosDaSessao().catch(() => null);
  // Execuções que o Moacir disparou e já terminaram viram mensagem na conversa dele.
  await postarRetornosDoMoacir().catch(() => 0);
  const admin = await adminDaPagina();
  const [dados, vermelhos, contadores] = await Promise.all([
    carregarCentral(),
    chamadosEmVermelho().catch(() => []),
    admin ? contadoresAgentes(admin).catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <div>
      {/* Prompt 29, item 10: os três números com nome. O selo da barra lateral mostra só "Aguardando o seu OK". */}
      {contadores && (
        <ul className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="agentes-contadores">
          {(["aguardandoOk", "ordensPendentes", "ordensLidas"] as const).map((k) => (
            <li key={k} className="rounded-lg border border-line bg-white p-3" title={AGENTES_DEFINICOES[k].formula} data-testid={`agentes-${k}`}>
              <p className="font-title text-2xl font-semibold text-forest" data-valor>
                {contadores[k]}
              </p>
              <p className="text-sm text-ink">{AGENTES_DEFINICOES[k].rotulo}</p>
              <p className="text-xs text-muted">{AGENTES_DEFINICOES[k].formula}</p>
            </li>
          ))}
        </ul>
      )}
      <CentralAgentes dados={dados} vermelhos={vermelhos} abaInicial={abaDaUrl(typeof sp.aba === "string" ? sp.aba : null)} />
    </div>
  );
}
