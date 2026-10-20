import type { Metadata } from "next";
import { CentralAjuda } from "@/components/ajuda/central-ajuda";
import { VivaChatBloco } from "@/components/ajuda/viva-chat";
import { PROMESSA_ATENDIMENTO } from "@/config/atendimento";
import Link from "next/link";
import { SUPORTE_EMAIL } from "@/lib/site";
import { RedesOficiais } from "@/components/layout/redes-oficiais";
import { JsonLd } from "@/components/seo/json-ld";
import { faqPage } from "@/lib/seo/estruturados";

export const metadata: Metadata = {
  title: "Central de Ajuda",
  description: "Fale com a Viva, nossa assistente virtual, veja as perguntas frequentes e abra um chamado no Viva Nomads.",
  alternates: { canonical: "/ajuda" },
};

export default function AjudaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="font-title text-3xl font-bold text-ink">Central de Ajuda</h1>
      <p className="mt-2 text-muted">
        {PROMESSA_ATENDIMENTO}. E-mail:{" "}
        <a href={`mailto:${SUPORTE_EMAIL}`} className="font-semibold text-forest underline">
          {SUPORTE_EMAIL}
        </a>
      </p>
      <div className="mt-6">
        <h2 className="mb-2 font-title text-lg font-bold text-ink">Fale com a Viva</h2>
        <VivaChatBloco />
        {/* Redes oficiais (src/config/redes.ts — Prompt 35A, item 4). */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span>Siga a Viva Nomads:</span>
          <RedesOficiais comTexto linkClassName="font-semibold text-forest underline" />
        </div>
      </div>
      <div className="mt-8">
        <CentralAjuda canal="site" />
      </div>
      <p className="mt-8 text-sm text-muted">
        Prefere ler com calma? Veja os{" "}
        <Link href="/guias" className="font-semibold text-forest underline">Guias da Viva</Link>.
      </p>
      <JsonLd dados={faqPage()} />
    </div>
  );
}
