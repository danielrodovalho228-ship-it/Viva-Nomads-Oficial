import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, FileSignature, Receipt, ShieldCheck, Check, ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { BrandImage } from "@/components/brand-image";
import { BannerTopo } from "@/components/institucional/banner-topo";
import { PHOTOS } from "@/lib/media";
import { CAUCAO_FRASE } from "@/lib/faixas";
import { ComparativoPrecos } from "@/components/precos/comparativo-precos";
import { JsonLd } from "@/components/seo/json-ld";
import { servicoProprietarios } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";
import { CITIES } from "@/lib/constants";

export const metadata: Metadata = {
  alternates: { canonical: "/para-proprietarios" },
  title: "Para proprietários: estadias de 1 a 6 meses",
  openGraph: { type: "website", locale: "pt_BR", siteName: "Viva Nomads", url: "/para-proprietarios" },
  description:
    "Anuncie seu imóvel mobiliado para estadias de 30 a 180 dias. Menos rotatividade, menos meses parado e custos repassáveis ao inquilino conforme o contrato.",
};

export default function ForLandlordsPage() {
  return (
    <>
      <JsonLd dados={servicoProprietarios(SITE_URL, CITIES)} />
      <BannerTopo
        foto="/media/hero-proprietarios.webp"
        alt="Proprietária segurando as chaves em uma sala mobiliada e iluminada"
        eyebrow="Para proprietários"
        titulo={
          <>
            Mais <span className="text-green-300">margem</span> que a locação de curta duração
          </>
        }
        subtitulo={
          <>
            <p>
              Locação mobiliada de média duração (30 a 180 dias), com contrato formal e a
              negociação registrada na plataforma. Menos entra-e-sai, menos meses com o imóvel parado e com água, luz,
              condomínio e IPTU que podem ser transferidos ao inquilino conforme o contrato.
            </p>
            <p className="mt-4 text-base text-white/90">
              <strong>Anuncie de graça.</strong> A Viva cobra 12% sobre o valor total do contrato fechado. Quanto mais imóveis, menor a taxa (de 12% a 6%; acima de 30 imóveis, condições negociadas). Sem mensalidade —{" "}
              <Link href="/precos" className="font-medium text-green-300 underline-offset-2 hover:underline">
                ver os preços
              </Link>
              .
            </p>
          </>
        }
      >
        <ButtonLink href="/dashboard/imoveis/novo" variant="inverse" size="lg">
          Anunciar meu imóvel <ArrowRight className="h-4 w-4" />
        </ButtonLink>
        <ButtonLink href="/precos" variant="inverseSecondary" size="lg">
          Ver preços
        </ButtonLink>
      </BannerTopo>

      {/* Quanto custa, em reais, contra o Airbnb (versão curta; a completa fica em /precos). */}
      <section className="container-page pt-12">
        <div className="mx-auto max-w-2xl">
          <ComparativoPrecos variante="curto" />
        </div>
      </section>

      {/* Como funciona para o proprietário — fluxo com imagens. */}
      <section className="bg-surface-2 section-y mt-12" data-testid="proprietarios-fluxo">
        <div className="container-page">
          <h2 className="text-center font-title text-3xl font-bold text-ink md:text-4xl">Do anúncio às chaves, em 3 passos</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { foto: "/images/como-funciona/07-anuncie.webp", alt: "Proprietário fotografando a sala para o anúncio", t: "Anuncie de graça", d: "Fotos, valor e regras da casa. A qualificação ajuda a ganhar o selo Pronto para Morar." },
              { foto: "/images/como-funciona/02-converse.webp", alt: "Conversa com o inquilino pelo celular", t: "Converse e escolha", d: "Os interessados falam com você pela plataforma; o contato fica protegido até o aceite." },
              { foto: "/images/como-funciona/08-feche.webp", alt: "Entrega das chaves ao inquilino", t: "Feche com contrato", d: "Contrato digital de 30 a 180 dias, caução combinada e o valor mensal direto na sua conta." },
            ].map((p, i) => (
              <li key={p.t} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                <BrandImage src={p.foto} alt={p.alt} rounded="rounded-none" sizes="(max-width: 768px) 100vw, 33vw" className="aspect-[16/10] w-full" />
                <div className="p-6">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-forest text-sm font-bold text-white">{i + 1}</span>
                  <h3 className="mt-3 font-title text-lg font-bold text-ink">{p.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Por que rende mais */}
      <section className="container-page section-y">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-title text-3xl font-bold text-ink md:text-4xl">
            Como o modelo de média duração reduz seus custos
          </h2>
          <p className="mt-4 text-lg text-muted">
            A locação mobiliada de média duração reduz os maiores custos da locação de
            curta duração.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Benefit icon={Receipt} title="Custos que podem ser transferidos" text="Água, luz, condomínio e IPTU podem ser do inquilino durante a estadia, conforme o contrato." />
          <Benefit icon={TrendingUp} title="Menos imóvel parado" text="Um inquilino por uma estadia inteira, inclusive nos meses fracos do turismo." />
          <Benefit icon={FileSignature} title="Contrato com validade jurídica" text="Contrato de 30 a 180 dias gerado e assinado digitalmente, com validade jurídica." />
          <Benefit icon={ShieldCheck} title="Caução" text={`Caução documentada, combinada entre proprietário e inquilino. ${CAUCAO_FRASE} Outras modalidades de garantia locatícia: em breve. A plataforma organiza e documenta; não é a garantidora.`} />
        </div>
      </section>

      {/* O que oferecemos */}
      <section className="bg-surface-2 section-y">
        <div className="container-page grid items-center gap-12 md:grid-cols-2">
          <BrandImage
            src={PHOTOS.dashOwner}
            alt="Sala de imóvel mobiliado preparada para anúncio"
            sizes="(max-width: 768px) 100vw, 50vw"
            className="aspect-square w-full rounded-3xl"
          />
          <div>
            <h2 className="font-title text-3xl font-bold text-ink md:text-4xl">
              A plataforma cuida do trabalho chato
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                "Checklist de qualificação que ajuda a declarar a regularidade da locação.",
                "Selo Pronto para Morar para anunciar mais caro.",
                "Verificação de identidade do inquilino — em breve.",
                "Contrato de 30 a 180 dias gerado e assinado digitalmente, com validade jurídica.",
                "Pagamento mensal direto na sua conta.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-sage" />
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
            <ButtonLink href="/dashboard/imoveis/novo" variant="primary" className="mt-8">
              Começar pela qualificação
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

function Benefit({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-sage-200 bg-white p-6">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-sage-100 text-forest">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-title text-lg font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  );
}
