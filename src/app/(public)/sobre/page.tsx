import type { Metadata } from "next";
import Link from "next/link";
import { BannerTopo } from "@/components/institucional/banner-topo";
import { JsonLd } from "@/components/seo/json-ld";
import { paginaInstitucional } from "@/lib/seo/estruturados";
import { SITE_URL, SUPORTE_EMAIL } from "@/lib/site";
import { CONTATO_NUNCA_TROCADO, PROMESSA_ESTADIA } from "@/config/textos-regulados";
import { SITUACAO_VIVA } from "@/config/situacao-viva";
import { HREF_FALE_COM_A_VIVA } from "@/lib/ajuda/rotas";

/*
  E851: /sobre dava 404. A página institucional reúne SÓ o que o site já diz em público, pelas fontes oficiais (promessa
  da estadia, situação de pré-lançamento, contato protegido, canal de contato) — nada de fato novo sobre a empresa.
*/
const DESCRICAO = `Quem é a Viva Nomads: imóveis mobiliados para profissionais em transição. ${PROMESSA_ESTADIA}.`;

export const metadata: Metadata = {
  title: "Sobre a Viva Nomads",
  description: DESCRICAO,
  alternates: { canonical: "/sobre" },
  openGraph: { url: "/sobre", title: "Sobre a Viva Nomads", description: DESCRICAO },
};

const LINKS = [
  { href: "/como-funciona", rotulo: "Como funciona" },
  { href: "/seguranca", rotulo: "Sua segurança" },
  { href: "/para-proprietarios", rotulo: "Para proprietários" },
  { href: "/empresas", rotulo: "Para empresas" },
  { href: "/termos", rotulo: "Termos de Uso" },
  { href: "/privacidade", rotulo: "Privacidade" },
];

export default function SobrePage() {
  return (
    <>
      <JsonLd dados={paginaInstitucional(SITE_URL, { caminho: "/sobre", nome: "Sobre a Viva Nomads", descricao: DESCRICAO })} />
      <BannerTopo
        foto="/images/unicas/empresas-banner.webp"
        alt="Pessoa chegando a um imóvel mobiliado com a mala"
        eyebrow="Sobre a Viva"
        titulo="Imóveis mobiliados para profissionais em transição"
        subtitulo={<p>{PROMESSA_ESTADIA}. Contrato de verdade, conversa registrada e custos organizados.</p>}
      />

      <section className="container-page section-y" data-testid="sobre-conteudo">
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h2 className="font-title text-2xl font-semibold text-ink">O que a Viva faz</h2>
            <p className="mt-3 text-base text-ink">
              A Viva Nomads liga quem precisa morar por alguns meses a proprietários de imóveis mobiliados. A conversa, a
              candidatura e o contrato ficam registrados na plataforma, e {CONTATO_NUNCA_TROCADO}.
            </p>
          </div>
          <div>
            <h2 className="font-title text-2xl font-semibold text-ink">Onde estamos</h2>
            <p className="mt-3 text-base text-ink" data-testid="sobre-fase">
              Começamos por Uberlândia (MG). {SITUACAO_VIVA.fase}
            </p>
          </div>
          <div>
            <h2 className="font-title text-2xl font-semibold text-ink">Fale com a gente</h2>
            <p className="mt-3 text-base text-ink">
              Dúvidas, sugestões ou um problema:{" "}
              <Link href={HREF_FALE_COM_A_VIVA} className="font-semibold text-forest underline underline-offset-4" data-testid="sobre-contato">
                Fale com a Viva
              </Link>{" "}
              ou escreva para{" "}
              <a href={`mailto:${SUPORTE_EMAIL}`} className="font-semibold text-forest underline underline-offset-4">
                {SUPORTE_EMAIL}
              </a>
              .
            </p>
          </div>
          <ul className="flex flex-wrap gap-3" data-testid="sobre-links">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="alvo-toque inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-medium text-ink hover:border-forest">
                  {l.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
