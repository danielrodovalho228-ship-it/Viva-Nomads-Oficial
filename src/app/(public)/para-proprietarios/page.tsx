import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, FileSignature, Receipt, ShieldCheck, Check, ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { BrandImage } from "@/components/brand-image";
import { PHOTOS } from "@/lib/media";

export const metadata: Metadata = {
  title: "Para proprietários — locação por temporada com mais margem",
  description:
    "Anuncie seu imóvel mobiliado para locação por temporada de 30 a 180 dias. Menos rotatividade, menos vacância nos meses fracos e custos que podem ser transferidos ao inquilino conforme o contrato.",
};

export default function ForLandlordsPage() {
  return (
    <>
      <section className="bg-forest section-y text-white">
        <div className="container-page grid items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="font-title text-4xl font-bold leading-tight md:text-5xl">
              Mais <span className="text-green-300">margem</span> que a locação por
              curtíssimo prazo
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/80">
              Locação por temporada de 30 a 180 dias, com contrato formal e inquilino
              verificado. Menos entra-e-sai, menos vacância nos meses fracos e com água, luz,
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
          <BrandImage
            src={PHOTOS.ownerKeys}
            alt="Proprietária sorrindo com chaves em apartamento mobiliado pronto para alugar"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
            className="aspect-[4/3] w-full rounded-3xl"
          />
        </div>
      </section>

      {/* Por que rende mais */}
      <section className="container-page section-y">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-title text-3xl font-bold text-ink md:text-4xl">
            Como o modelo de média temporada reduz seus custos
          </h2>
          <p className="mt-4 text-lg text-muted">
            O modelo de temporada de média duração reduz os maiores custos do aluguel por
            curtíssimo prazo.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Benefit icon={Receipt} title="Custos que podem ser transferidos" text="Água, luz, condomínio e IPTU podem ser do inquilino durante a estadia, conforme o contrato." />
          <Benefit icon={TrendingUp} title="Menos vacância" text="Um inquilino por uma temporada inteira, inclusive nos meses fracos do turismo." />
          <Benefit icon={FileSignature} title="Contrato com validade jurídica" text="Contrato de locação por temporada gerado e assinado digitalmente, com validade jurídica." />
          <Benefit icon={ShieldCheck} title="Inquilino verificado" text="Verificação de identidade e garantia locatícia: você decide com segurança." />
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
                "Checklist de qualificação que comprova a regularidade da locação.",
                "Selo Pronto para Morar para anunciar mais caro.",
                "Verificação de identidade do inquilino com laudo de semáforo.",
                "Cotação de seguro-fiança dentro da plataforma.",
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
