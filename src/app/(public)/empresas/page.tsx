import type { Metadata } from "next";
import { Building2, FileText, BarChart3, MapPin } from "lucide-react";
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
  { titulo: "Conte a necessidade", texto: "Cidade, período (30 a 180 dias) e quantas pessoas. Respondemos com opções de imóveis mobiliados." },
  { titulo: "Escolha o imóvel", texto: "A pessoa do time ou o RH conversa com o proprietário pela plataforma e envia a candidatura." },
  { titulo: "Contrato e recibo", texto: "Contrato digital assinado pelas partes; todo mês a empresa recebe o recibo da estadia para o reembolso." },
];

const FAQ_EMPRESAS = [
  { p: "Como a empresa recebe o recibo?", r: "O proprietário emite o recibo mensal da estadia em nome dele. A Viva Nomads não emite nota para a empresa e não cobra nada de quem se hospeda." },
  { p: "Qual é o prazo das estadias?", r: "De 30 a 180 dias, com imóveis mobiliados e prontos para morar." },
  { p: "Quem assina o contrato?", r: "O proprietário e quem vai morar (ou a empresa, quando ela for a responsável). A assinatura é digital, pela plataforma." },
];

const PILARES = [
  {
    icon: MapPin,
    titulo: "Mobilidade corporativa",
    texto:
      "Imóveis mobiliados e prontos para morar, de 30 a 180 dias, para times em projeto, realocação ou período de experiência.",
  },
  {
    icon: FileText,
    titulo: "Recibo para reembolso",
    texto: "Recibo mensal da estadia em nome do proprietário + contrato assinado, aceitos para reembolso. A Viva Nomads não cobra nada do inquilino.",
  },
  {
    icon: BarChart3,
    titulo: "Relatórios",
    texto: "Acompanhamento das estadias da sua empresa — em construção com os primeiros parceiros corporativos.",
  },
];

export default function EmpresasPage() {
  return (
    <div className="container-page max-w-3xl py-12 md:py-16">
      <JsonLd dados={paginaInstitucional(SITE_URL, { caminho: "/empresas", nome: "Para empresas", descricao: "Mobilidade corporativa com locação mobiliada de média duração: imóveis prontos, recibo mensal da estadia para reembolso e relatórios." })} />
      <span className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-forest">
        <Building2 className="h-3.5 w-3.5" /> Para empresas
      </span>
      <h1 className="mt-4 font-title text-4xl font-bold text-ink">
        Moradia de média duração para o seu time
      </h1>
      <p className="mt-4 text-lg text-muted">
        Locação mobiliada de 30 a 180 dias para mobilidade corporativa — imóveis prontos, contrato
        formal e a negociação toda pela plataforma. O pagamento vai direto ao proprietário; a
        plataforma nunca toca no dinheiro.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {PILARES.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.titulo} className="rounded-2xl border border-sage-200 bg-white p-5">
              <Icon className="h-5 w-5 text-forest" />
              <h2 className="mt-3 font-title text-base font-bold text-ink">{p.titulo}</h2>
              <p className="mt-1.5 text-sm text-muted">{p.texto}</p>
            </div>
          );
        })}
      </div>

      <section className="mt-12" data-testid="empresas-como-funciona">
        <h2 className="font-title text-2xl font-bold text-ink">Como funciona para a empresa</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="rounded-2xl border border-sage-200 bg-white p-5">
              <span className="text-xs font-semibold text-forest">Passo {i + 1}</span>
              <h3 className="mt-1 font-title text-base font-bold text-ink">{p.titulo}</h3>
              <p className="mt-1.5 text-sm text-muted">{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12" data-testid="empresas-faq">
        <h2 className="font-title text-2xl font-bold text-ink">Perguntas rápidas</h2>
        <div className="mt-4 space-y-3">
          {FAQ_EMPRESAS.map((f) => (
            <details key={f.p} className="rounded-xl border border-sage-200 bg-white p-4">
              <summary className="cursor-pointer font-semibold text-ink">{f.p}</summary>
              <p className="mt-2 text-sm text-muted">{f.r}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-title text-2xl font-bold text-ink">Fale com a gente</h2>
        <p className="mt-2 text-muted">
          Conte seu volume e sua necessidade — retornamos com o que dá para fazer hoje. Sem promessa
          de recurso que ainda não existe.
        </p>
        <div className="mt-5">
          <EmpresasForm />
        </div>
      </section>
    </div>
  );
}
