import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenText, ChevronRight, FileText, MessageSquareText, ShieldCheck } from "lucide-react";
import { BannerTopo } from "@/components/institucional/banner-topo";
import { PerguntasDaCentral } from "@/components/ajuda/central-ajuda";
import { ButtonLink } from "@/components/ui/button";
import { PROMESSA_ATENDIMENTO } from "@/config/atendimento";
import { HREF_FALE_COM_A_VIVA, destinoDoAtendimento } from "@/lib/ajuda/rotas";
import { TEMAS_AJUDA, perguntasDoTema, temaAjuda } from "@/lib/ajuda/temas";
import { BRAND_BLUR } from "@/lib/media";
import { SUPORTE_EMAIL } from "@/lib/site";
import { cn } from "@/lib/utils";
import { RedesOficiais } from "@/components/layout/redes-oficiais";
import { JsonLd } from "@/components/seo/json-ld";
import { faqPage } from "@/lib/seo/estruturados";

export const metadata: Metadata = {
  title: "Central de Ajuda",
  description: "Perguntas frequentes por tema, o atendimento da Viva e os documentos da plataforma — Viva Nomads.",
  alternates: { canonical: "/ajuda" },
};

/** Os documentos, cada um com a sua página (E84). */
const DOCUMENTOS = [
  { href: "/termos", rotulo: "Termos de uso", descricao: "As regras da plataforma", Icone: FileText },
  { href: "/privacidade", rotulo: "Política de privacidade", descricao: "Seus dados, suas regras", Icone: ShieldCheck },
] as const;

/**
 * E84 — Central de ajuda (mockups ajuda-central-desktop/mobile): página inteira com a foto no topo, o cartão "Fale com a
 * Viva" (a promessa de atendimento aparece AQUI, uma vez), os quatro cartões de tema, as perguntas frequentes e os
 * documentos. O atendimento (chat, chamado, meus chamados) tem a sua página: /ajuda/fale-com-a-viva; os links antigos
 * com ?novo=1, ?chamado=… etc. continuam valendo e seguem para lá.
 */
export default async function AjudaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const destino = destinoDoAtendimento(sp);
  if (destino) redirect(destino);
  const tema = temaAjuda(typeof sp.tema === "string" ? sp.tema : null);

  return (
    <div data-testid="ajuda-hub">
      <BannerTopo
        foto="/images/unicas/cf-conversa-registrada.webp"
        alt="Pessoa conversando pelo celular na mesa da cozinha"
        titulo="Central de ajuda"
        subtitulo={<p>Respostas curtas para as dúvidas mais comuns.</p>}
        posicaoFoto="50% 40%"
      />

      <div className="container-page relative z-10 -mt-12 pb-16">
        <div className="mx-auto grid max-w-5xl gap-12">
          <section className="flex flex-col gap-4 rounded-xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:p-6" data-testid="ajuda-cartao-fale">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-forest" aria-hidden>
              <MessageSquareText className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-title text-xl font-semibold text-ink">Fale com a Viva</h2>
              <p className="mt-1 text-sm text-muted" data-testid="ajuda-promessa">
                {PROMESSA_ATENDIMENTO}
              </p>
            </div>
            <ButtonLink href={HREF_FALE_COM_A_VIVA} data-testid="ajuda-ir-fale">
              <MessageSquareText className="h-4 w-4" aria-hidden /> Falar com a Viva
            </ButtonLink>
          </section>

          <section aria-labelledby="ajuda-temas-titulo">
            <h2 id="ajuda-temas-titulo" className="font-title text-xl font-semibold text-ink">
              Temas
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {TEMAS_AJUDA.map((t) => {
                const ativo = tema?.id === t.id;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/ajuda?tema=${t.id}#perguntas`}
                      aria-current={ativo ? "true" : undefined}
                      data-testid={`ajuda-tema-${t.id}`}
                      className={cn(
                        "flex h-full items-center gap-4 rounded-xl border bg-white p-4 transition-colors hover:border-forest",
                        ativo ? "border-forest ring-1 ring-forest" : "border-line"
                      )}
                    >
                      <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-sage-100 text-forest" aria-hidden={!t.foto}>
                        {t.foto ? (
                          <Image src={t.foto} alt={t.alt} fill sizes="80px" placeholder="blur" blurDataURL={BRAND_BLUR} className="object-cover" />
                        ) : (
                          <ShieldCheck className="absolute inset-0 m-auto h-9 w-9" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-title text-lg font-semibold text-ink">{t.titulo}</span>
                        <span className="mt-1 block text-sm text-muted">{t.resumo}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <div id="perguntas" className="scroll-mt-24">
            {tema && (
              <p className="mb-3 text-sm">
                <Link href="/ajuda#perguntas" className="inline-flex min-h-11 items-center font-semibold text-forest underline" data-testid="ajuda-todas">
                  Ver todas as perguntas
                </Link>
              </p>
            )}
            <PerguntasDaCentral ids={tema ? perguntasDoTema(tema.id) : undefined} titulo={tema ? tema.titulo : "Perguntas frequentes"} />
          </div>

          <section aria-labelledby="ajuda-docs-titulo">
            <h2 id="ajuda-docs-titulo" className="font-title text-xl font-semibold text-ink">
              Documentos
            </h2>
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {DOCUMENTOS.map(({ href, rotulo, descricao, Icone }) => (
                <li key={href}>
                  <Link href={href} className="flex h-full min-h-16 items-center gap-4 rounded-xl border border-line bg-white p-4 text-ink hover:border-forest" data-testid={`ajuda-doc-${href.slice(1)}`}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sage-100 text-forest" aria-hidden>
                      <Icone className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{rotulo}</span>
                      <span className="block text-sm text-muted">{descricao}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <footer className="grid gap-2 text-center text-sm text-muted">
            <p>
              <BookOpenText className="mr-1 inline h-4 w-4 text-forest" aria-hidden />
              Prefere ler com calma? Veja os{" "}
              <Link href="/guias" className="font-semibold text-forest underline">
                Guias da Viva
              </Link>
              .
            </p>
            <p>
              Ainda precisa de ajuda? Escreva para{" "}
              <a href={`mailto:${SUPORTE_EMAIL}`} className="font-semibold text-forest underline">
                {SUPORTE_EMAIL}
              </a>
              .
            </p>
            {/* Redes oficiais (src/config/redes.ts — Prompt 35A, item 4). */}
            <div className="flex flex-wrap items-center justify-center gap-x-2">
              <span>Siga a Viva Nomads:</span>
              <RedesOficiais comTexto linkClassName="font-semibold text-forest underline" />
            </div>
          </footer>
        </div>
      </div>
      <JsonLd dados={faqPage()} />
    </div>
  );
}
