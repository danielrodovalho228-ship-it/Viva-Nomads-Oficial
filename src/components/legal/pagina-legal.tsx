import { MessageSquareText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { HREF_FALE_COM_A_VIVA } from "@/lib/ajuda/rotas";
import { IndiceLegal } from "./indice-legal";

/**
 * E84 — moldura dos Termos e da Privacidade (mockups ajuda-termos e ajuda-privacidade): título centralizado, índice das
 * seções ao lado (no celular, recolhido no topo) e o cartão "Ficou alguma dúvida? Fale com a Viva." no fim. O texto de
 * cada página continua o mesmo — só mudou de moldura (o vocabulário dos Termos segue congelado até o parecer jurídico).
 */
export function PaginaLegal({ titulo, linhaData, children }: { titulo: string; linhaData: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="container-page py-12 md:py-16" data-testid="pagina-legal">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="font-title text-[28px] font-semibold text-ink">{titulo}</h1>
        <p className="mt-3 text-muted">{linhaData}</p>
      </header>

      <div className="mx-auto mt-12 grid max-w-5xl gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <IndiceLegal />
        <article data-legal-corpo className="min-w-0">
          {children}
        </article>
      </div>

      <section className="mx-auto mt-12 flex max-w-xl flex-col items-center gap-3 rounded-xl border border-line bg-white p-6 text-center" data-testid="legal-duvida">
        <p className="flex items-center gap-2 font-title text-lg font-semibold text-ink">
          <MessageSquareText className="h-5 w-5 text-forest" aria-hidden /> Ficou alguma dúvida? Fale com a Viva.
        </p>
        <ButtonLink href={HREF_FALE_COM_A_VIVA} variant="secondary">
          Falar com a Viva
        </ButtonLink>
      </section>
    </div>
  );
}
