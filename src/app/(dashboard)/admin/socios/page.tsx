import { listarCaixa } from "@/lib/socios/caixa-actions";
import { CaixaSociosClient } from "./caixa-client";

export const metadata = { title: "Caixa dos Sócios — Admin" };
// A leitura do arquivo (transcrição do áudio, leitura do print/PDF) roda na própria ação de envio.
export const maxDuration = 60;

/** Admin → Caixa dos Sócios. O layout de /admin já exige admin; a RLS e as ações conferem de novo. */
export default async function CaixaSociosPage() {
  const { itens, aviso } = await listarCaixa();
  return <CaixaSociosClient itens={itens} aviso={aviso} transcricaoLigada={Boolean(process.env.TRANSCRICAO_API_KEY)} />;
}
