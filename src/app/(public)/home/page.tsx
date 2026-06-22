import Link from "next/link";
import {
  Briefcase,
  Stethoscope,
  Users,
  Laptop,
  Wifi,
  Building2,
  Search,
  MessageSquare,
  FileSignature,
  ArrowRight,
  Check,
  X,
  Minus,
  ShieldCheck,
  Sofa,
} from "lucide-react";
import { PERSONAS } from "@/lib/constants";
import { PHOTOS } from "@/lib/media";
import { listProperties } from "@/lib/data/properties";
import { ButtonLink } from "@/components/ui/button";
import { ReadyToLiveBadge, SpecTag, Eyebrow } from "@/components/ui/badge";
import { BrandImage } from "@/components/brand-image";
import { PropertyCard } from "@/components/property-card";
import { HeroSearch } from "@/components/hero-search";

const PERSONA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Briefcase,
  Stethoscope,
  Users,
  Laptop,
};
const PERSONA_PHOTOS: Record<string, string> = {
  executivos: PHOTOS.personas.executivos,
  saude: PHOTOS.personas.saude,
  familias: PHOTOS.personas.familias,
  nomades: PHOTOS.personas.nomades,
};

export default async function HomePage() {
  const featured = (await listProperties()).slice(0, 3);

  return (
    <>
      {/* ───────── HERO (preto, gradiente azul→verde) ───────── */}
      <section className="relative overflow-hidden bg-night text-white">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-gradient-brand opacity-25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-blue-700 opacity-25 blur-3xl" />

        <div className="container-page relative grid items-center gap-8 pb-8 pt-8 lg:grid-cols-12 lg:gap-10 lg:pt-12">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Locação por temporada · 30 a 180 dias
            </span>
            <h1 className="mt-6 font-title font-bold display-xl">
              Moradia mobiliada para a sua{" "}
              <span className="text-gradient-brand">nova fase</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/70">
              Apartamentos prontos para morar, por temporada de 30 a 180 dias.
              Para quem chega a uma nova fase e quer se sentir em casa desde o primeiro dia.
            </p>
            <div className="mt-9 max-w-2xl">
              <HeroSearch />
            </div>
            {/* Locações acima de 180 dias (1C) */}
            <p className="mt-3 text-sm text-white/55">
              Precisa de mais de 180 dias?{" "}
              <a
                href="mailto:contato@vivanomads.com.br?subject=Loca%C3%A7%C3%A3o%20acima%20de%20180%20dias"
                className="font-medium text-green-300 underline-offset-2 hover:underline"
              >
                Fale conosco
              </a>
              .
            </p>
            {/* Trust badges com ícones (1E) */}
            <div className="mt-6 grid grid-cols-3 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-7">
              <TrustItem icon={FileSignature} text="Contrato por temporada (art. 48)" />
              <TrustItem icon={Sofa} text="Pronto para morar" />
              <TrustItem icon={ShieldCheck} text="Inquilino verificado" />
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative">
              <BrandImage
                src={PHOTOS.heroProfessional}
                alt="Profissional instalado e trabalhando no imóvel"
                priority
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="aspect-[4/5] w-full rounded-3xl ring-1 ring-white/10"
              />
              <div className="absolute -bottom-5 -left-5 hidden rounded-2xl bg-white p-4 shadow-xl sm:block">
                <ReadyToLiveBadge />
                <p className="mt-2 max-w-[12rem] text-xs text-muted">
                  Home office, internet boa para o trabalho e coworkings na região.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── PARA QUEM É (linhas editoriais alternadas) ───────── */}
      <section className="bg-surface section-y">
        <div className="container-page">
          <div className="max-w-2xl">
            <Eyebrow>Para quem é</Eyebrow>
            <h2 className="mt-4 font-title font-bold text-ink display-lg">
              Feito para morar de verdade, pelo tempo que a vida pedir
            </h2>
          </div>

          <div className="mt-6 md:mt-8 flex flex-col gap-px overflow-hidden rounded-3xl border border-line bg-line">
            {PERSONAS.map((p, i) => {
              const Icon = PERSONA_ICONS[p.icon] ?? Briefcase;
              return (
                <div
                  key={p.id}
                  className={`grid items-center gap-6 bg-white p-6 sm:grid-cols-12 sm:p-8 ${
                    i % 2 === 1 ? "sm:[direction:rtl]" : ""
                  }`}
                >
                  <div className="sm:col-span-3 sm:[direction:ltr]">
                    <BrandImage
                      src={PERSONA_PHOTOS[p.id]}
                      alt={p.title}
                      sizes="(max-width: 640px) 100vw, 25vw"
                      className="aspect-[3/2] w-full"
                    />
                  </div>
                  <div className="sm:col-span-1 sm:[direction:ltr]">
                    <span className="font-title text-4xl font-bold text-line">
                      0{i + 1}
                    </span>
                  </div>
                  <div className="sm:col-span-8 sm:[direction:ltr]">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-500">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="font-title text-xl font-bold text-ink">{p.title}</h3>
                      <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-900">
                        {p.period}
                      </span>
                    </div>
                    <p className="mt-3 max-w-2xl text-muted">{p.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────── PRONTO PARA TRABALHO (spotlight) ───────── */}
      <section className="bg-surface-2 section-y">
        <div className="container-page grid items-center gap-10 lg:grid-cols-2">
          <div className="relative order-2 lg:order-1">
            <BrandImage
              src={PHOTOS.homeOffice}
              alt="Home office montado no imóvel"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="aspect-[5/4] w-full rounded-3xl"
            />
            <div className="absolute -right-4 -top-4 rounded-2xl bg-gradient-brand p-[1px] shadow-xl">
              <div className="rounded-2xl bg-white px-4 py-3">
                <p className="font-title text-lg font-bold text-ink">Internet para home office</p>
                <p className="text-xs text-muted">aguenta videochamadas pesadas</p>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <Eyebrow>O diferencial</Eyebrow>
            <h2 className="mt-4 font-title font-bold text-ink display-lg">
              Pronto para morar — e para trabalhar, se for o caso
            </h2>
            <p className="mt-5 text-lg text-muted">
              Mais que uma cama: além do selo{" "}
              <strong className="text-ink">Pronto para Morar</strong>, etiquetas mostram a
              aptidão de cada imóvel para o trabalho remoto.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <SpecTag kind="home_office" />
              <SpecTag kind="work_located" />
            </div>
            <ul className="mt-8 space-y-5">
              <WorkFeature icon={Wifi} title="Home office no imóvel" text="Cômodo dedicado, mesa, cadeira e internet boa para o trabalho — declarados pelo proprietário. É o que sustenta a etiqueta Para trabalhar de casa." />
              <WorkFeature icon={Building2} title="Coworkings e cafés na região" text="A vizinhança costuma ter espaços de trabalho — você confere a posição no mapa do imóvel." />
            </ul>
          </div>
        </div>
      </section>

      {/* ───────── OUTRA CATEGORIA (tabela comparativa) ───────── */}
      <section className="bg-night section-y text-white">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow light>Outra categoria</Eyebrow>
            <h2 className="mt-4 font-title font-bold text-white display-lg">
              Uma categoria à parte: estadia de meses, com contrato de verdade.
            </h2>
            <p className="mt-5 text-lg text-white/65">
              Estadia de meses, com contrato de verdade, inquilino verificado e custos
              organizados. Tempo para morar com tranquilidade, no seu ritmo.
            </p>
          </div>

          {/* Indicador de rolagem (mobile) */}
          <p className="mx-auto mt-12 max-w-4xl px-1 text-xs text-white/45 sm:hidden">
            Deslize para comparar →
          </p>
          <div className="mx-auto mt-2 max-w-4xl rounded-2xl border border-white/10 sm:mt-14">
            <div className="overflow-x-auto rounded-2xl [scrollbar-width:thin]">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="sticky left-0 z-10 bg-night p-5 font-medium text-white/50">
                      Comparativo
                    </th>
                    <th className="p-5">
                      <span className="font-title text-base font-bold text-gradient-brand">
                        Viva Nomads
                      </span>
                    </th>
                    <th className="p-5 font-title text-base font-bold text-white/70">Airbnb</th>
                    <th className="p-5 font-title text-base font-bold text-white/70">QuintoAndar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  <CompareRow label="Estadia de 30 a 180 dias" a="yes" b="no" c="partial" />
                  <CompareRow label="Mobiliado e pronto para morar" a="yes" b="yes" c="no" />
                  <CompareRow label="Contrato com validade jurídica" a="yes" b="no" c="yes" />
                  <CompareRow label="Custos de consumo transferíveis ao inquilino" a="yes" b="no" c="yes" />
                  <CompareRow label="Contrato formal por temporada" a="yes" b="no" c="partial" />
                  <CompareRow label="Selo Pronto para Morar" a="yes" b="no" c="no" />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── COMO FUNCIONA (passos com linha conectora) ───────── */}
      <section className="bg-surface section-y">
        <div className="container-page">
          <div className="max-w-2xl">
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="mt-4 font-title font-bold text-ink display-lg">
              Do anúncio ao contrato em 3 passos
            </h2>
          </div>

          <div className="relative mt-10 md:mt-12 grid gap-10 md:grid-cols-3">
            <div className="absolute left-0 right-0 top-7 hidden h-px bg-line md:block" />
            <Step n="1" icon={Search} title="Busque" text="Encontre imóveis mobiliados pela cidade, período e orçamento. Filtre por Pronto para Morar." />
            <Step n="2" icon={MessageSquare} title="Converse" text="Fale direto com o proprietário, tire dúvidas e agende a visita pela plataforma." />
            <Step n="3" icon={FileSignature} title="Assine com segurança" text="Garantia escolhida e contrato de temporada assinado digitalmente, com validade jurídica." />
          </div>
        </div>
      </section>

      {/* ───────── FAIXA PROPRIETÁRIOS (preto de impacto) ───────── */}
      <section className="bg-surface section-y">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-3xl bg-night px-8 py-14 text-white md:px-16 md:py-20">
            <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-gradient-brand opacity-30 blur-3xl" />
            <div className="relative grid items-center gap-10 md:grid-cols-2">
              <div>
                <Eyebrow light>Para proprietários</Eyebrow>
                <h2 className="mt-4 font-title font-bold display-lg">
                  Mais estabilidade, menos vacância,{" "}
                  <span className="text-gradient-brand">mais margem líquida</span>.
                </h2>
                <p className="mt-5 max-w-md text-white/65">
                  Um inquilino por uma temporada inteira traz previsibilidade: agenda estável,
                  custos de consumo organizados no contrato e inquilino verificado. Você
                  anuncia de graça e só paga quando fecha.
                </p>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <ButtonLink href="/para-proprietarios" variant="accent" size="lg">
                  Quero anunciar meu imóvel <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <Link href="/precos" className="text-sm text-white/55 transition-colors hover:text-green-300">
                  Ver planos de assinatura
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── IMÓVEIS EM DESTAQUE ───────── */}
      <section className="bg-surface-2 section-y">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <Eyebrow>Imóveis em destaque</Eyebrow>
              <h2 className="mt-4 font-title font-bold text-ink display-lg">
                Disponíveis agora
              </h2>
            </div>
            <Link
              href="/buscar"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-500 hover:text-blue-700"
            >
              Ver todos os imóveis <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {featured.length > 0 ? (
            <div className="mt-6 md:mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          ) : (
            <div className="mt-6 md:mt-8 rounded-3xl border border-dashed border-line bg-surface px-6 py-14 text-center">
              <p className="font-title text-xl font-bold text-ink">
                Os primeiros imóveis estão chegando.
              </p>
              <p className="mx-auto mt-2 max-w-md text-muted">
                É proprietário? Anuncie o seu e apareça aqui primeiro.
              </p>
              <ButtonLink href="/qualificar" variant="gold" className="mt-6">
                Anunciar meu imóvel
              </ButtonLink>
            </div>
          )}
        </div>
      </section>
    </>
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
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-brand text-white">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h4 className="font-title text-base font-bold text-ink">{title}</h4>
        <p className="text-sm text-muted">{text}</p>
      </div>
    </li>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  text,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="relative">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-night font-title text-xl font-bold text-white ring-8 ring-surface">
          {n}
        </span>
        <Icon className="h-6 w-6 text-blue-500" />
      </div>
      <h3 className="mt-6 font-title text-xl font-bold text-ink">{title}</h3>
      <p className="mt-2 text-muted">{text}</p>
    </div>
  );
}

function TrustItem({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <span className="flex flex-col items-center gap-1.5 text-center text-xs text-white/75 sm:flex-row sm:gap-2 sm:text-sm">
      <Icon className="h-6 w-6 text-green-300 sm:h-4 sm:w-4" />
      <span className="leading-tight">{text}</span>
    </span>
  );
}

function CompareRow({
  label,
  a,
  b,
  c,
}: {
  label: string;
  a: "yes" | "no" | "partial";
  b: "yes" | "no" | "partial";
  c: "yes" | "no" | "partial";
}) {
  return (
    <tr className="text-white/80">
      <td className="sticky left-0 z-10 bg-night p-5 font-medium">{label}</td>
      <td className="p-5"><Mark v={a} brand /></td>
      <td className="p-5"><Mark v={b} /></td>
      <td className="p-5"><Mark v={c} /></td>
    </tr>
  );
}

function Mark({ v, brand = false }: { v: "yes" | "no" | "partial"; brand?: boolean }) {
  if (v === "yes")
    return (
      <span
        className={`grid h-6 w-6 place-items-center rounded-full ${
          brand ? "bg-green-500 text-night" : "bg-white/10 text-green-300"
        }`}
      >
        <Check className="h-4 w-4" />
      </span>
    );
  if (v === "partial")
    return (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white/50">
        <Minus className="h-4 w-4" />
      </span>
    );
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-white/5 text-white/30">
      <X className="h-4 w-4" />
    </span>
  );
}
