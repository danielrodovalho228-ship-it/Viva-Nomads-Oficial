import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleHelp, Mail } from "lucide-react";
import { BannerTopo } from "@/components/institucional/banner-topo";
import { CentralAjuda } from "@/components/ajuda/central-ajuda";
import { VivaChatBloco } from "@/components/ajuda/viva-chat";
import { RedesOficiais } from "@/components/layout/redes-oficiais";
import { PROMESSA_ATENDIMENTO } from "@/config/atendimento";
import { SUPORTE_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Fale com a Viva",
  description: "Converse com a assistente da Viva, abra um chamado e acompanhe seus chamados no Viva Nomads.",
  alternates: { canonical: "/ajuda/fale-com-a-viva" },
};

/**
 * E84 — Fale com a Viva (mockup pagina-fale-com-a-viva-desktop/mobile): página própria do atendimento. Foto no topo,
 * a promessa de atendimento UMA vez (no subtítulo); à esquerda, a conversa com a assistente e o chamado (abrir, meus
 * chamados, detalhe); à direita, "Antes de escrever" (Central de ajuda) e "Outros assuntos" (e-mail).
 */
export default function FaleComAVivaPage() {
  return (
    <div data-testid="fale-com-a-viva">
      <BannerTopo
        foto="/images/unicas/prop-passo-converse.webp"
        alt="Pessoa escrevendo uma mensagem pelo celular no sofá"
        titulo="Fale com a Viva"
        subtitulo={<p data-testid="fale-promessa">{PROMESSA_ATENDIMENTO}.</p>}
        posicaoFoto="50% 45%"
      />

      <div className="container-page relative z-10 -mt-12 pb-16">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid min-w-0 content-start gap-6">
            <section aria-labelledby="fale-chat-titulo" className="min-w-0">
              <h2 id="fale-chat-titulo" className="sr-only">
                Conversa com a assistente
              </h2>
              <VivaChatBloco />
            </section>
            <CentralAjuda canal="site" />
          </div>

          <aside className="grid content-start gap-4" aria-label="Outros caminhos">
            <section className="rounded-xl border border-line bg-white p-4 sm:p-6">
              <h2 className="flex items-center gap-2 font-title text-lg font-semibold text-ink">
                <CircleHelp className="h-5 w-5 text-forest" aria-hidden /> Antes de escrever
              </h2>
              <p className="mt-2 text-sm text-muted">As dúvidas mais comuns já têm resposta curta na Central de ajuda.</p>
              <Link href="/ajuda" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest underline" data-testid="fale-ir-central">
                Ir para a Central de ajuda <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </section>
            <section className="rounded-xl border border-line bg-white p-4 sm:p-6">
              <h2 className="flex items-center gap-2 font-title text-lg font-semibold text-ink">
                <Mail className="h-5 w-5 text-forest" aria-hidden /> Outros assuntos
              </h2>
              <p className="mt-2 text-sm text-muted">Parcerias, imprensa ou outro assunto:</p>
              <a href={`mailto:${SUPORTE_EMAIL}`} className="mt-2 inline-flex min-h-11 items-center break-all text-sm font-semibold text-forest underline">
                {SUPORTE_EMAIL}
              </a>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                <span>Siga a Viva Nomads:</span>
                <RedesOficiais comTexto linkClassName="font-semibold text-forest underline" />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
