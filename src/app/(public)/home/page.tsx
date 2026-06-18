import Link from "next/link";
import {
  Briefcase,
  Stethoscope,
  Users,
  Laptop,
  Wifi,
  Coffee,
  Building2,
  Search,
  MessageSquare,
  FileSignature,
  ArrowRight,
  Check,
  X,
  Minus,
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

        <div className="container-page relative grid items-center gap-12 py-16 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Locação por temporada · 30 a 180 dias
            </span>
            <h1 className="mt-6 font-title font-bold display-xl">
              Moradia mobiliada para a sua{" "}
              <span className="text-gradient-brand">nova fase</span> em Uberlândia
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/70">
              Locação mensal de 30 a 180 dias para profissionais em transição. Pronto para
              morar — e para trabalhar — já no primeiro dia.
            </p>
            <div className="mt-9 max-w-2xl">
              <HeroSearch />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/55">
              <span>Contrato formal (art. 48)</span>
              <span className="hidden h-1 w-1 rounded-full bg-white/30 sm:block" />
              <span>Mobiliado e pronto para morar</span>
              <span className="hidden h-1 w-1 rounded-full bg-white/30 sm:block" />
              <span>Inquilino verificado</span>
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
                  Home office, internet fibra e coworkings mapeados por perto.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── PARA QUEM É (linhas editoriais alternadas) ───────── */}
      <section className="bg-surface py-14 md:py-20">
        <div className="container-page">
          <div className="max-w-2xl">
            <Eyebrow>Para quem é</Eyebrow>
            <h2 className="mt-4 font-title font-bold text-ink display-lg">
              Feito para quem se muda pelo trabalho — não para turistas
            </h2>
          </div>

          <div className="mt-14 flex flex-col gap-px overflow-hidden rounded-3xl border border-line bg-line">
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
      <section className="bg-surface-2 py-14 md:py-20">
        <div className="container-page grid items-center gap-14 lg:grid-cols-2">
          <div className="relative order-2 lg:order-1">
            <BrandImage
              src={PHOTOS.homeOffice}
              alt="Home office montado no imóvel"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="aspect-[5/4] w-full rounded-3xl"
            />
            <div className="absolute -right-4 -top-4 rounded-2xl bg-gradient-brand p-[1px] shadow-xl">
              <div className="rounded-2xl bg-white px-4 py-3">
                <p className="font-title text-2xl font-bold text-ink">300 Mbps</p>
                <p className="text-xs text-muted">fibra dedicada</p>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <Eyebrow>O diferencial</Eyebrow>
            <h2 className="mt-4 font-title font-bold text-ink display-lg">
              Você trabalha no dia seguinte à chegada
            </h2>
            <p className="mt-5 text-lg text-muted">
              Quem se muda pelo trabalho precisa de mais que uma cama. Além do selo{" "}
              <strong className="text-ink">Pronto para Morar</strong>, etiquetas mostram a
              aptidão de cada imóvel para o trabalho.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <SpecTag kind="home_office" />
              <SpecTag kind="work_located" />
            </div>
            <ul className="mt-8 space-y-5">
              <WorkFeature icon={Wifi} title="Home office no imóvel" text="Cômodo dedicado, mesa, cadeira e internet fibra de qualidade." />
              <WorkFeature icon={Building2} title="Coworkings próximos" text="Mapeamos coworkings e salas de reunião perto do imóvel." />
              <WorkFeature icon={Coffee} title="Cafés de trabalho" text="Espaços para trabalhar a menos de 1 km, exibidos na página." />
            </ul>
          </div>
        </div>
      </section>

      {/* ───────── NÃO É AIRBNB / QUINTOANDAR (tabela comparativa) ───────── */}
      <section className="bg-night py-20 text-white md:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow light>Outra categoria</Eyebrow>
            <h2 className="mt-4 font-title font-bold text-white display-lg">
              Não é Airbnb. Não é QuintoAndar.
            </h2>
            <p className="mt-5 text-lg text-white/65">
              Locação mensal mobiliada, com contrato formal e inquilino qualificado — aceita
              em condomínios onde o Airbnb não é.
            </p>
          </div>

          <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="p-5 font-medium text-white/50">Comparativo</th>
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
      </section>

      {/* ───────── COMO FUNCIONA (passos com linha conectora) ───────── */}
      <section className="bg-surface py-14 md:py-20">
        <div className="container-page">
          <div className="max-w-2xl">
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="mt-4 font-title font-bold text-ink display-lg">
              Do anúncio ao contrato em 3 passos
            </h2>
          </div>

          <div className="relative mt-16 grid gap-10 md:grid-cols-3">
            <div className="absolute left-0 right-0 top-7 hidden h-px bg-line md:block" />
            <Step n="1" icon={Search} title="Buscar" text="Encontre imóveis mobiliados pela cidade, período e orçamento. Filtre por Pronto para Morar." />
            <Step n="2" icon={MessageSquare} title="Conversar" text="Fale direto com o proprietário, tire dúvidas e agende a visita pela plataforma." />
            <Step n="3" icon={FileSignature} title="Assinar contrato" text="Garantia escolhida e contrato de temporada assinado digitalmente, com validade jurídica." />
          </div>
        </div>
      </section>

      {/* ───────── FAIXA PROPRIETÁRIOS (preto de impacto) ───────── */}
      <section className="bg-surface pb-20 md:pb-28">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-3xl bg-night px-8 py-14 text-white md:px-16 md:py-20">
            <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-gradient-brand opacity-30 blur-3xl" />
            <div className="relative grid items-center gap-10 md:grid-cols-2">
              <div>
                <Eyebrow light>Para proprietários</Eyebrow>
                <h2 className="mt-4 font-title font-bold display-lg">
                  Ganhe <span className="text-gradient-brand">~2x mais</span> que no Airbnb
                </h2>
                <p className="mt-5 max-w-md text-white/65">
                  Sem rotatividade, sem vacância nos meses fracos e com os custos transferidos
                  para o inquilino. Anuncie e fale com inquilinos qualificados.
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
      <section className="bg-surface-2 py-14 md:py-20">
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
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
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
      <td className="p-5 font-medium">{label}</td>
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
