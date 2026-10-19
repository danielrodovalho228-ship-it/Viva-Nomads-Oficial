import type { Metadata } from "next";
import localFont from "next/font/local";
import { carregarCentral, chamadosEmVermelho, postarRetornosDoMoacir } from "@/lib/data/agentes-actions";
import { dispararEncaminhamentosDaSessao } from "@/lib/agentes/servidor";
import { CentralAgentes } from "./central-client";
import { adminDaPagina, contadoresAgentes } from "@/lib/data/admin-indicadores";
import { AGENTES_DEFINICOES } from "@/lib/admin/indicadores";

export const metadata: Metadata = { title: "Agentes" };

const jakarta = localFont({ variable: "--font-jakarta", src: [
    { path: "../../../fonts/plus-jakarta-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../../fonts/plus-jakarta-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../../fonts/plus-jakarta-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../../fonts/plus-jakarta-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ], display: "swap" });
const mono = localFont({ variable: "--font-mono-agentes", src: [
    { path: "../../../fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../../fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../../fonts/jetbrains-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ], display: "swap" });
const unbounded = localFont({ variable: "--font-display-agentes", src: [
    { path: "../../../fonts/unbounded-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../../fonts/unbounded-latin-700-normal.woff2", weight: "700", style: "normal" },
  ], display: "swap" });

/** Central de Agentes (admin). O layout de /admin já exige papel admin. */
export default async function AgentesPage() {
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
    <div className={`${jakarta.variable} ${mono.variable} ${unbounded.variable}`}>
      {/* Prompt 29, item 10: os três números com nome. O selo da barra lateral mostra só "Aguardando o seu OK". */}
      {contadores && (
        <ul className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="agentes-contadores">
          {(["aguardandoOk", "ordensPendentes", "ordensLidas"] as const).map((k) => (
            <li key={k} className="rounded-xl border border-sage-200 bg-white p-3" title={AGENTES_DEFINICOES[k].formula} data-testid={`agentes-${k}`}>
              <p className="font-title text-2xl font-bold text-forest" data-valor>
                {contadores[k]}
              </p>
              <p className="text-sm text-ink">{AGENTES_DEFINICOES[k].rotulo}</p>
              <p className="text-xs text-muted">{AGENTES_DEFINICOES[k].formula}</p>
            </li>
          ))}
        </ul>
      )}
      <CentralAgentes dados={dados} vermelhos={vermelhos} />
    </div>
  );
}
