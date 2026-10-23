import type { Metadata } from "next";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { minhasRespostas } from "@/lib/data/respostas-actions";
import { LIMITE_RESPOSTAS } from "@/lib/respostas/regras";
import { RespostasTela } from "./respostas-tela";

export const metadata: Metadata = { title: "Respostas rápidas", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Prompt 55-E2 — respostas salvas do dono (até 20), inseridas na conversa com 1 toque. */
export default async function RespostasRapidasPage() {
  const respostas = await minhasRespostas();
  return (
    <div className="space-y-4" data-testid="pagina-respostas-rapidas">
      <PageTitle title="Respostas rápidas" subtitle={`Até ${LIMITE_RESPOSTAS} respostas para usar nas conversas com 1 toque.`} />
      <Panel>
        <p className="text-sm text-ink">
          Na conversa, toque em <strong>Respostas rápidas</strong> e escolha uma: o texto entra no campo da mensagem e você confere antes de enviar. A mensagem para quem vai
          pedir, do seu anúncio, aparece sempre como a primeira.
        </p>
        <p className="mt-1 text-sm text-muted">Telefone, e-mail, link de WhatsApp, rede social ou documento não podem ir no texto: a conversa fica registrada na Viva.</p>
      </Panel>
      <RespostasTela inicial={respostas} />
    </div>
  );
}
