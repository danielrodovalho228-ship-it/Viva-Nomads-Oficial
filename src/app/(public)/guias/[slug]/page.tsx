import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { trilha } from "@/lib/seo/estruturados";
import { GUIAS, artigoGuia, guiaPorSlug } from "@/lib/guias/guias";
import { SITE_URL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIAS.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = guiaPorSlug((await params).slug);
  if (!g) return {};
  return { title: g.titulo, description: g.descricao, alternates: { canonical: `/guias/${g.slug}` } };
}

export default async function GuiaPage({ params }: { params: Promise<{ slug: string }> }) {
  const g = guiaPorSlug((await params).slug);
  if (!g) notFound();
  const outros = GUIAS.filter((x) => x.slug !== g.slug).slice(0, 3);
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <JsonLd dados={artigoGuia(SITE_URL, g)} />
      <JsonLd dados={trilha(SITE_URL, [{ nome: "Guias", caminho: "/guias" }, { nome: g.titulo, caminho: `/guias/${g.slug}` }])} />
      <p className="text-sm">
        <Link href="/guias" className="font-semibold text-forest underline">← Guias</Link>
      </p>
      <h1 className="mt-3 font-title text-[28px] font-semibold text-ink">{g.titulo}</h1>
      <p className="mt-2 text-muted">{g.descricao}</p>
      {g.secoes.map((s) => (
        <section key={s.titulo} className="mt-8">
          <h2 className="font-title text-xl font-semibold text-ink">{s.titulo}</h2>
          {s.paragrafos.map((p) => (
            <p key={p} className="mt-2 leading-relaxed text-ink/90">{p}</p>
          ))}
        </section>
      ))}
      <div className="mt-10 flex flex-col gap-3 rounded-xl border border-line bg-white p-5 sm:flex-row">
        <Link href="/buscar" className="font-semibold text-forest underline">Buscar imóveis mobiliados</Link>
        <Link href="/para-proprietarios" className="font-semibold text-forest underline">Anunciar o meu imóvel</Link>
      </div>
      <h2 className="mt-10 font-title text-lg font-semibold text-ink">Outros guias</h2>
      <ul className="mt-2 list-disc pl-5">
        {outros.map((o) => (
          <li key={o.slug}>
            <Link href={`/guias/${o.slug}`} className="text-forest underline">{o.titulo}</Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
