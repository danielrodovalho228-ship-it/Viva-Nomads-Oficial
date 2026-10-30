import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, MessageSquareText } from "lucide-react";
import { PerguntasDaCentral } from "@/components/ajuda/central-ajuda";
import { JsonLd } from "@/components/seo/json-ld";
import { HREF_FALE_COM_A_VIVA } from "@/lib/ajuda/rotas";
import { TEMAS_AJUDA, hrefDoTema, temaAjuda } from "@/lib/ajuda/temas";
import { faqPage } from "@/lib/seo/estruturados";

export const dynamicParams = false;

export function generateStaticParams() {
  return TEMAS_AJUDA.map((t) => ({ tema: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ tema: string }> }): Promise<Metadata> {
  const t = temaAjuda((await params).tema);
  if (!t) return {};
  return { title: `${t.titulo} · Central de ajuda`, description: `${t.resumo}. Respostas curtas da Central de ajuda da Viva Nomads.`, alternates: { canonical: hrefDoTema(t.id) } };
}

/**
 * E84 — página própria de cada tema da Central de ajuda (QA de 29/10): o hub só mostra os cartões; as perguntas do
 * tema moram aqui, com a busca dentro do tema. Títulos em português; a promessa de atendimento fica no hub e no Fale
 * com a Viva (aqui, só o link).
 */
export default async function TemaAjudaPage({ params }: { params: Promise<{ tema: string }> }) {
  const tema = temaAjuda((await params).tema);
  if (!tema) notFound();
  const outros = TEMAS_AJUDA.filter((t) => t.id !== tema.id);
  return (
    <div className="container-page py-12" data-testid="ajuda-tema-pagina" data-tema={tema.id}>
      <div className="mx-auto grid max-w-5xl gap-12">
        <header>
          <Link href="/ajuda" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest underline" data-testid="ajuda-voltar-central">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Central de ajuda
          </Link>
          <h1 className="mt-2 font-title text-[28px] font-semibold text-ink">{tema.titulo}</h1>
          <p className="mt-2 text-base text-muted">{tema.resumo}.</p>
        </header>

        <PerguntasDaCentral ids={tema.perguntas} titulo="Perguntas deste tema" />

        <section aria-labelledby="ajuda-outros-temas">
          <h2 id="ajuda-outros-temas" className="font-title text-xl font-semibold text-ink">
            Outros temas
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {outros.map((t) => (
              <li key={t.id}>
                <Link href={hrefDoTema(t.id)} className="flex h-full min-h-16 items-center gap-2 rounded-xl border border-line bg-white p-4 font-semibold text-ink hover:border-forest" data-testid={`ajuda-outro-tema-${t.id}`}>
                  <span className="min-w-0 flex-1">{t.titulo}</span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-center text-sm text-muted">
          Não achou a resposta?{" "}
          <Link href={HREF_FALE_COM_A_VIVA} className="inline-flex items-center gap-1 font-semibold text-forest underline" data-testid="ajuda-tema-fale">
            <MessageSquareText className="h-4 w-4" aria-hidden /> Fale com a Viva
          </Link>
        </p>
      </div>
      <JsonLd dados={faqPage(tema.perguntas)} />
    </div>
  );
}
