import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { paginaInstitucional } from "@/lib/seo/estruturados";
import { GUIAS } from "@/lib/guias/guias";
import { SITE_URL } from "@/lib/site";

const DESCRICAO = "Guias da Viva Nomads para proprietários e inquilinos de imóveis mobiliados: preço, Caução, conferência de entrada, bairro e documentos.";

export const metadata: Metadata = {
  title: "Guias",
  description: DESCRICAO,
  alternates: { canonical: "/guias" },
};

const PUBLICO = { proprietarios: "Para proprietários", inquilinos: "Para inquilinos", todos: "Para todos" } as const;

export default function GuiasPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-12">
      <JsonLd dados={paginaInstitucional(SITE_URL, { caminho: "/guias", nome: "Guias", descricao: DESCRICAO })} />
      <h1 className="font-title text-[28px] font-semibold text-ink">Guias</h1>
      <p className="mt-2 text-muted">
        Textos curtos escritos pela Viva para quem anuncia e para quem procura um imóvel mobiliado de 30 a 180 dias.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {GUIAS.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/guias/${g.slug}`}
              className="block h-full rounded-xl border border-line bg-white p-4 transition hover:border-forest "
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-forest">
                <BookOpen className="h-4 w-4" aria-hidden /> {PUBLICO[g.publico]}
              </span>
              <h2 className="mt-2 font-title text-lg font-semibold text-ink">{g.titulo}</h2>
              <p className="mt-1 text-sm text-muted">{g.descricao}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-muted">
        Não achou? Veja a <Link href="/ajuda" className="font-semibold text-forest underline">Central de Ajuda</Link>.
      </p>
    </div>
  );
}
