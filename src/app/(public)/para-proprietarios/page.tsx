import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, FileSignature, Receipt, ShieldCheck, Check, ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { BrandImage } from "@/components/brand-image";
import { PHOTOS } from "@/lib/media";
import { CAUCAO_FRASE } from "@/lib/faixas";
import { ComparativoPrecos } from "@/components/precos/comparativo-precos";
import { JsonLd } from "@/components/seo/json-ld";
import { servicoProprietarios } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";
import { CITIES } from "@/lib/constants";

export const metadata: Metadata = {
  alternates: { canonical: "/para-proprietarios" },
  title: "Para proprietários — locação por temporada com mais margem",
  description:
    "Anuncie seu imóvel mobiliado para locação por temporada de 30 a 180 dias. Menos rotatividade, menos meses com o imóvel parado e custos que podem ser transferidos ao inquilino conforme o contrato.",
};

export default function ForLandlordsPage() {
  return (
    <>
      <JsonLd dados={servicoProprietarios(SITE_URL, CITIES)} />
      <section className="bg-forest section-y text-white">
        <div className="container-page grid items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="font-title text-4xl font-bold leading-tight md:text-5xl">
              Mais <span className="text-green-300">margem</span> que o aluguel de
              curta duração
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/80">
              Locação mobiliada de média duração (30 a 180 dias), com contrato formal e a
              negociação registrada na plataforma. Menos entra-e-sai, menos meses com o imóvel parado e com água, luz,
              condomínio e IPTU que podem ser transferidos ao inquilino conforme o contrato.
            </p>
            <p className="mt-4 text-white/90">
              <strong>Anuncie de graça.</strong> Pague uma comissão apenas quando fechar —{" "}
              <Link href="/precos" className="font-medium text-green-300 underline-offset-2 hover:underline">
                ver planos e comissões
              </Link>
              .
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/qualificar" variant="gold" size="lg">
                Anunciar meu imóvel <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/precos" variant="outline" size="lg" className="border-white/40 text-white hover:bg-white hover:text-forest">
                Ver planos
              </ButtonLink>
            </div>
          </div>
          {/* Fase 2.1 — destaque do topo. */}
          <BrandImage
            src="/media/hero-proprietarios.webp"
            alt="Proprietária segurando as chaves em uma sala mobiliada e iluminada"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
            className="aspect-video w-full rounded-3xl"
          />
        </div>
      </section>

      {/* Quanto custa, em reais, contra o Airbnb (versão curta; a completa fica em /precos). */}
      <section className="container-page pt-12">
        <div className="mx-auto max-w-2xl">
          <ComparativoPrecos variante="curto" />
        </div>
      </section>

      {/* Por que rende mais */}
      <section className="container-page section-y">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-title text-3xl font-bold text-ink md:text-4xl">
            Como o modelo de média duração reduz seus custos
          </h2>
          <p className="mt-4 text-lg text-muted">
            A locação mobiliada de média duração reduz os maiores custos do aluguel de
            curta duração.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Benefit icon={Receipt} title="Custos que podem ser transferidos" text="Água, luz, condomínio e IPTU podem ser do inquilino durante a estadia, conforme o contrato." />
          <Benefit icon={TrendingUp} title="Menos imóvel parado" text="Um inquilino por uma temporada inteira, inclusive nos meses fracos do turismo." />
          <Benefit icon={FileSignature} title="Contrato com validade jurídica" text="Contrato de locação por temporada gerado e assinado digitalmente, com validade jurídica." />
          <Benefit icon={ShieldCheck} title="Caução ou seguro-fiança" text={`A garantia é escolhida no contrato entre você e o inquilino. ${CAUCAO_FRASE} Ou seguro-fiança da seguradora parceira (em estruturação). A plataforma organiza e documenta; não é a garantidora.`} />
        </div>
      </section>

      {/* O que oferecemos */}
      <section className="bg-surface-2 section-y">
        <div className="container-page grid items-center gap-12 md:grid-cols-2">
          <BrandImage
            src={PHOTOS.dashOwner}
            alt="Sala de apartamento mobiliado preparada para anúncio"
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
                "Seguro-fiança via parceiro — em estruturação.",
                "Contrato de temporada gerado e assinado digitalmente, com validade jurídica.",
                "Pagamento do aluguel direto na sua conta.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-sage" />
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
            <ButtonLink href="/qualificar" variant="primary" className="mt-8">
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
