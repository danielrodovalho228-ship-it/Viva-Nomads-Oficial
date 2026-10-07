import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans, Unbounded } from "next/font/google";
import { carregarCentral, chamadosEmVermelho, postarRetornosDoMoacir } from "@/lib/data/agentes-actions";
import { dispararRepassesDaSessao } from "@/lib/agentes/servidor";
import { CentralAgentes } from "./central-client";

export const metadata: Metadata = { title: "Agentes" };

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono-agentes", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const unbounded = Unbounded({ variable: "--font-display-agentes", subsets: ["latin"], weight: ["500", "700"], display: "swap" });

/** Central de Agentes (admin). O layout de /admin já exige papel admin. */
export default async function AgentesPage() {
  // Achado P0/P1 repassado a outro agente (0087) dispara a rotina dele na hora.
  await dispararRepassesDaSessao().catch(() => null);
  // Execuções que o Moacir disparou e já terminaram viram mensagem na conversa dele.
  await postarRetornosDoMoacir().catch(() => 0);
  const [dados, vermelhos] = await Promise.all([carregarCentral(), chamadosEmVermelho().catch(() => [])]);
  return (
    <div className={`${jakarta.variable} ${mono.variable} ${unbounded.variable}`}>
      <CentralAgentes dados={dados} vermelhos={vermelhos} />
    </div>
  );
}
