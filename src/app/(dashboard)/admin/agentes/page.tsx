import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans, Unbounded } from "next/font/google";
import { carregarCentral } from "@/lib/data/agentes-actions";
import { urlFotoDono } from "@/lib/agentes/foto-dono";
import { CentralAgentes } from "./central-client";

export const metadata: Metadata = { title: "Agentes" };

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono-agentes", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const unbounded = Unbounded({ variable: "--font-display-agentes", subsets: ["latin"], weight: ["500", "700"], display: "swap" });

/** Central de Agentes (admin). O layout de /admin já exige papel admin. */
export default async function AgentesPage() {
  const [dados, fotoDono] = await Promise.all([carregarCentral(), urlFotoDono()]);
  return (
    <div className={`${jakarta.variable} ${mono.variable} ${unbounded.variable}`}>
      <CentralAgentes dados={dados} fotoDono={fotoDono} />
    </div>
  );
}
