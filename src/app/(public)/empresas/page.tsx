import type { Metadata } from "next";
import { Building2, ArrowRight, ShieldCheck, Home, MessageSquare, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { BrandImage } from "@/components/brand-image";
import { BannerTopo } from "@/components/institucional/banner-topo";
import { FotoCartao } from "@/components/institucional/foto-cartao";
import { cartaoSecao } from "@/lib/cartoes-secao";
import { EmpresasForm } from "./empresas-form";
import { JsonLd } from "@/components/seo/json-ld";
import { paginaInstitucional } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/empresas" },
  title: "Moradia mobiliada para equipes e empresas",
  description:
    "Mobilidade corporativa com imóveis mobiliados de 30 a 180 dias: contrato formal, recibo mensal da estadia para reembolso e relatórios. Fale com a gente.",
  openGraph: {
    url: "/empresas",
    title: "Moradia mobiliada para equipes e empresas",
    description:
      "Imóveis mobiliados de 30 a 180 dias para o seu time, com contrato formal e recibo mensal da estadia para reembolso.",
  },
};

const PASSOS = [
  { titulo: "Conte a necessidade", texto: "Cidade, período (30 a 180 dias) e quantas pessoas. Respondemos com opções de imóveis mobiliados.", foto: "/images/unicas/empresas-passo-necessidade.webp", alt: "Pessoa buscando imóveis mobiliados no notebook" },
  { titulo: "Escolha o imóvel", texto: "A pessoa do time ou o RH conversa com o proprietário pela plataforma e envia a candidatura.", foto: "/images/unicas/empresas-passo-escolha.webp", alt: "Colegas escolhendo o imóvel no tablet" },
  { titulo: "Contrato e recibo", texto: "Contrato digital assinado pelas partes; todo mês a empresa recebe o recibo da estadia para o reembolso.", foto: "/images/como-funciona/04-assine.webp", alt: "Assinatura digital do contrato no celular" },
];

/** O que a empresa ganha (benefícios concretos — sem depoimentos inventados no pré-lançamento). */
const BENEFICIOS = [
  "Imóveis mobiliados e prontos para morar: a pessoa chega e começa a trabalhar.",
  "Estadias de 30 a 180 dias, no tempo do projeto — sem diária de hotel.",
  "Contrato formal e assinatura digital, com tudo registrado na plataforma.",
  "Recibo mensal da estadia, emitido pelo proprietário.",
  "Nenhuma taxa para quem vem morar: a Viva Nomads não cobra o inquilino.",
  "Caução combinada com o proprietário e conversa direta pela plataforma.",
];

const FAQ_EMPRESAS = [
  { p: "Como a empresa recebe o recibo?", r: "O proprietário emite o recibo mensal da estadia em nome dele. A Viva Nomads não emite nota para a empresa e não cobra nada de quem vem morar." },
  { p: "Qual é o prazo das estadias?", r: "De 30 a 180 dias, com imóveis mobiliados e prontos para morar." },
  { p: "Quem assina o contrato?", r: "O proprietário e quem vai morar (ou a empresa, quando ela for a responsável). A assinatura é digital, pela plataforma." },
];

const PILARES = [
  {
    id: "mobilidade",
    titulo: "Mobilidade corporativa",
    texto:
      "Imóveis mobiliados e prontos para morar, de 30 a 180 dias, para times em projeto, realocação ou período de experiência.",
  },
  {
    id: "recibo",
    titulo: "Recibo para reembolso",
    texto: "Recibo mensal da estadia emitido pelo proprietário + contrato assinado, que podem ser usados no reembolso conforme a política da sua empresa. A Viva Nomads não cobra nada do inquilino.",
  },
  {
    id: "relatorios",
    titulo: "Relatórios",
    texto: "Acompanhamento das estadias da sua empresa — em construção com os primeiros parceiros corporativos.",
  },
];

export default function EmpresasPage() {
  return (
    <>
      <JsonLd dados={paginaInstitucional(SITE_URL, { caminho: "/empresas", nome: "Para empresas", descricao: "Mobilidade corporativa com locação mobiliada de média duração: imóveis prontos, recibo mensal da estadia para reembolso e relatórios." })} />
      <BannerTopo
        foto="/images/unicas/empresas-banner.webp"
        alt="Profissional chegando a um imóvel mobiliado com a mala"
        eyebrow="Para empresas"
        titulo="Moradia de média duração para o seu time"
        subtitulo={
          <p>
            Imóveis mobiliados de 30 a 180 dias para mobilidade corporativa — prontos para morar, com
            contrato formal e a negociação toda pela plataforma. O pagamento vai direto ao proprietário; a
            plataforma nunca toca no dinheiro.
          </p>
        }
      >
        <ButtonLink href="#fale-com-a-gente" variant="inverse" size="lg">
          Falar com a equipe <ArrowRight className="h-4 w-4" />
        </ButtonLink>
        <ButtonLink href="/buscar" variant="inverseSecondary" size="lg">
          Ver imóveis mobiliados
        </ButtonLink>
      </BannerTopo>

      {/* Proposta de valor: 3 pilares. */}
      <section className="container-page section-y">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-forest">
            <Building2 className="h-3.5 w-3.5" /> Mobilidade corporativa
          </span>
          <h2 className="mt-4 font-title text-2xl font-semibold text-ink">Um lugar para morar, não um quarto de hotel</h2>
          <p className="mt-3 text-muted">Para times em projeto, realocação ou período de experiência em outra cidade.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PILARES.map((p) => (
            <div key={p.titulo} className="flex flex-col overflow-hidden rounded-xl border border-line bg-white ">
              <FotoCartao cartao={cartaoSecao("empresas", p.id)} />
              <div className="p-6">
                <h3 className="line-clamp-2 font-title text-lg font-semibold text-ink">{p.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fluxo do processo com imagens (estilo das páginas de processo do Furnished Finder). */}
      <section className="bg-surface-2 section-y" data-testid="empresas-como-funciona">
        <div className="container-page">
          <h2 className="text-center font-title text-2xl font-semibold text-ink">Como funciona para a empresa</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="overflow-hidden rounded-xl border border-line bg-white ">
                <BrandImage src={p.foto} alt={p.alt} rounded="rounded-none" sizes="(max-width: 768px) 100vw, 33vw" className="aspect-[16/10] w-full" />
                <div className="p-6">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-forest text-sm font-semibold text-white">{i + 1}</span>
                  <h3 className="mt-3 font-title text-lg font-semibold text-ink">{p.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Benefícios + foto. */}
      <section className="container-page section-y">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <BrandImage src="/images/unicas/empresas-homeoffice.webp" alt="Espaço de trabalho em casa num imóvel mobiliado" sizes="(max-width: 768px) 100vw, 50vw" className="aspect-[4/3] w-full rounded-xl" />
          <div>
            <h2 className="font-title text-2xl font-semibold text-ink">O que a empresa ganha</h2>
            <ul className="mt-6 space-y-3">
              {BENEFICIOS.map((b) => (
                <li key={b} className="flex gap-3 text-ink">
                  <Check className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                { Icon: Home, t: "Imóveis mobiliados" },
                { Icon: ShieldCheck, t: "Contrato formal" },
                { Icon: MessageSquare, t: "Tudo pela plataforma" },
              ].map(({ Icon, t }) => (
                <div key={t} className="rounded-xl bg-surface-2 p-3">
                  <Icon className="mx-auto h-5 w-5 text-forest" aria-hidden />
                  <p className="mt-2 text-xs font-medium text-ink">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-2 section-y" data-testid="empresas-faq">
        <div className="container-page max-w-3xl">
          <h2 className="font-title text-2xl font-semibold text-ink">Perguntas rápidas</h2>
          <div className="mt-6 space-y-3">
            {FAQ_EMPRESAS.map((f) => (
              <details key={f.p} className="rounded-xl border border-line bg-white p-5">
                <summary className="cursor-pointer font-semibold text-ink">{f.p}</summary>
                <p className="mt-2 text-sm text-muted">{f.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="fale-com-a-gente" className="container-page section-y scroll-mt-24">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <h2 className="font-title text-2xl font-semibold text-ink">Fale com a gente</h2>
            <p className="mt-3 text-muted">
              Conte seu volume e sua necessidade — retornamos com o que dá para fazer hoje.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-white p-6 md:col-span-3">
            <EmpresasForm />
          </div>
        </div>
      </section>
    </>
  );
}
