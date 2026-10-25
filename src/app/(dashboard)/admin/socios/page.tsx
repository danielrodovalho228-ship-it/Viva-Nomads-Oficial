import { listarCaixa } from "@/lib/socios/caixa-actions";
import { CaixaSociosClient } from "./caixa-client";
import { tituloDoAdmin } from "@/config/menu-admin";

export const metadata = { title: tituloDoAdmin("/admin/socios") };
// A leitura do arquivo (transcrição do áudio, leitura do print/PDF) roda na própria ação de envio.
export const maxDuration = 60;

/** Admin → Caixa dos Sócios. O layout de /admin já exige admin; a RLS e as ações conferem de novo. */
export default async function CaixaSociosPage() {
  const { itens, aviso, uid } = await listarCaixa();
  return <CaixaSociosClient itens={itens} uid={uid} aviso={aviso} transcricaoLigada={Boolean(process.env.TRANSCRICAO_API_KEY)} />;
}
