import Link from "next/link";
import {
  Briefcase,
  Stethoscope,
  Users,
  Laptop,
  Building2,
  RefreshCcw,
  Receipt,
  Search,
  MessageSquare,
  FileSignature,
  Wifi,
  Armchair,
  Coffee,
  ArrowRight,
} from "lucide-react";
import { PERSONAS } from "@/lib/constants";
import { listProperties } from "@/lib/data/properties";
import { ButtonLink } from "@/components/ui/button";
import { WorkReadyBadge } from "@/components/ui/badge";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { PropertyCard } from "@/components/property-card";
import { HeroSearch } from "@/components/hero-search";

const PERSONA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Briefcase,
  Stethoscope,
  Users,
  Laptop,
};

export default async function HomePage() {
  const featured = (await listProperties()).slice(0, 3);

  return (
    <>
      {/* 1. HERO */}
      <section className="relative overflow-hidden bg-forest text-white">
        <div className="container-page grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-champagne">
              Locação por temporada · 30 a 180 dias
            </span>
            <h1 className="mt-5 font-title text-4xl font-extrabold leading-tight md:text-5xl">
              Moradia mobiliada para a sua nova fase em Uberlândia
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/80">
              Locação mensal de 30 a 180 dias para profissionais em transição. Pronto para
              morar — e para trabalhar — já no primeiro dia.
            </p>
            <div className="mt-8">
              <HeroSearch />
            </div>
          </div>

          <div className="relative">
            <PhotoPlaceholder
              label="[FOTO — profissional chegando / se instalando no imóvel]"
              className="aspect-[4/3] w-full rounded-3xl border border-white/15 bg-white/5 text-white/70"
            />
          </div>
        </div>
      </section>

      {/* 2. PARA QUEM É */}
      <section className="bg-surface py-16 md:py-24">
        <div className="container-page">
          <SectionHead
            eyebrow="Para quem é"
            title="Feito para quem se muda pelo trabalho — não para turistas"
            subtitle="Quatro perfis de profissionais e pessoas em transição que precisam morar bem por uma temporada."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {PERSONAS.map((p) => {
              const Icon = PERSONA_ICONS[p.icon] ?? Briefcase;
              return (
                <div
                  key={p.id}
                  className="flex gap-5 rounded-2xl border border-sage-200 bg-white p-6"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-title text-lg font-bold text-ink">{p.title}</h3>
                      <span className="rounded-full bg-champagne/20 px-2 py-0.5 text-xs font-medium text-champagne-600">
                        {p.period}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. O DIFERENCIAL TRABALHO */}
      <section className="bg-surface-2 py-16 md:py-24">
        <div className="container-page grid items-center gap-12 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <PhotoPlaceholder
              label="[FOTO — home office montado no imóvel]"
              className="aspect-square w-full rounded-3xl"
            />
          </div>
          <div className="order-1 md:order-2">
            <SectionHead
              align="left"
              eyebrow="O diferencial"
              title="Pronto para Trabalho: você trabalha no dia seguinte à chegada"
              subtitle="Quem se muda pelo trabalho precisa de mais que uma cama. Imóveis com infraestrutura de trabalho recebem o selo dourado e aparecem em destaque."
            />
            <div className="mt-6">
              <WorkReadyBadge />
            </div>
            <ul className="mt-6 space-y-4">
              <WorkFeature icon={Wifi} title="Home office no imóvel" text="Cômodo dedicado, mesa, cadeira e internet fibra de qualidade." />
              <WorkFeature icon={Armchair} title="Coworkings próximos" text="Mapeamos coworkings e salas de reunião perto do imóvel." />
              <WorkFeature icon={Coffee} title="Cafés de trabalho" text="Espaços para trabalhar a menos de 1 km, exibidos na página do imóvel." />
            </ul>
          </div>
        </div>
      </section>

      {/* 4. POR QUE NÃO É AIRBNB */}
      <section className="bg-forest py-16 text-white md:py-24">
        <div className="container-page">
          <SectionHead
            dark
            eyebrow="Outra categoria"
            title="Não é Airbnb. Não é QuintoAndar."
            subtitle="Locação mensal mobiliada, com contrato formal e inquilino qualificado — aceita em condomínios onde o Airbnb não é."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <CompareCard icon={Building2} title="Aceito em condomínios" text="Locação de 30 a 180 dias é juridicamente diferente da hospedagem hoteleira de curtíssimo prazo — e os condomínios aceitam." />
            <CompareCard icon={RefreshCcw} title="Sem rotatividade" text="Sem entra-e-sai constante. Um inquilino qualificado por uma temporada inteira, com contrato." />
            <CompareCard icon={Receipt} title="Custos transferem" text="Água, luz, condomínio e IPTU vão para o inquilino durante a estadia — diferente do Airbnb." />
          </div>
        </div>
      </section>

      {/* 5. COMO FUNCIONA */}
      <section className="bg-surface py-16 md:py-24">
        <div className="container-page">
          <SectionHead
            eyebrow="Como funciona"
            title="Do anúncio ao contrato em 3 passos"
            subtitle="Simples para o inquilino, seguro para o proprietário."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <StepCard n={1} icon={Search} title="Buscar" text="Encontre imóveis mobiliados pela cidade, período e orçamento mensal. Filtre por Pronto para Trabalho." />
            <StepCard n={2} icon={MessageSquare} title="Conversar" text="Fale direto com o proprietário, tire dúvidas e agende a visita pela própria plataforma." />
            <StepCard n={3} icon={FileSignature} title="Assinar contrato" text="Garantia escolhida e contrato de locação por temporada assinado digitalmente, com validade jurídica." />
          </div>
        </div>
      </section>

      {/* 6. PARA PROPRIETÁRIOS (CTA) */}
      <section className="bg-surface-2 py-16 md:py-20">
        <div className="container-page">
          <div className="overflow-hidden rounded-3xl bg-forest px-8 py-12 text-white md:px-14">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div>
                <h2 className="font-title text-3xl font-extrabold md:text-4xl">
                  Ganhe aproximadamente <span className="text-champagne">2x mais</span> que no Airbnb
                </h2>
                <p className="mt-4 max-w-md text-white/80">
                  Sem rotatividade, sem vacância nos meses fracos e com os custos transferidos
                  para o inquilino. Anuncie seu imóvel e fale com inquilinos qualificados.
                </p>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <ButtonLink href="/para-proprietarios" variant="gold" size="lg">
                  Quero anunciar meu imóvel
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <Link href="/precos" className="text-sm text-white/70 hover:text-champagne">
                  Ver planos de assinatura
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. IMÓVEIS EM DESTAQUE */}
      <section className="bg-surface py-16 md:py-24">
        <div className="container-page">
          <div className="flex items-end justify-between">
            <SectionHead align="left" eyebrow="Imóveis em destaque" title="Disponíveis agora" />
            <Link
              href="/buscar"
              className="hidden items-center gap-1 text-sm font-medium text-forest hover:text-champagne-600 sm:inline-flex"
            >
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHead({
  eyebrow,
  title,
  subtitle,
  align = "center",
  dark = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  dark?: boolean;
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <p className="font-title text-sm font-bold uppercase tracking-wide text-champagne-600">
          {eyebrow}
        </p>
      )}
      <h2
        className={`mt-2 font-title text-3xl font-extrabold md:text-4xl ${
          dark ? "text-white" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-4 text-lg ${dark ? "text-white/80" : "text-muted"}`}>{subtitle}</p>
      )}
    </div>
  );
}

function WorkFeature({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <li className="flex gap-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-champagne/20 text-champagne-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h4 className="font-title font-bold text-ink">{title}</h4>
        <p className="text-sm text-muted">{text}</p>
      </div>
    </li>
  );
}

function CompareCard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-6">
      <Icon className="h-7 w-7 text-champagne" />
      <h3 className="mt-4 font-title text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/75">{text}</p>
    </div>
  );
}

function StepCard({
  n,
  icon: Icon,
  title,
  text,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="relative rounded-2xl border border-sage-200 bg-surface-2 p-7">
      <span className="absolute right-6 top-6 font-title text-4xl font-extrabold text-sage-200">
        {n}
      </span>
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-forest text-white">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-5 font-title text-xl font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  );
}
