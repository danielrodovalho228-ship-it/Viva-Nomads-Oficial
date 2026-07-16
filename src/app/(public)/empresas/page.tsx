import type { Metadata } from "next";
import { Building2, FileText, BarChart3, MapPin } from "lucide-react";
import { EmpresasForm } from "./empresas-form";

export const metadata: Metadata = {
  title: "Para empresas",
  description:
    "Mobilidade corporativa com locação mobiliada de média duração: imóveis prontos, nota fiscal e relatórios. Fale com a gente.",
};

const PILARES = [
  {
    icon: MapPin,
    titulo: "Mobilidade corporativa",
    texto:
      "Imóveis mobiliados e prontos para morar, de 30 a 180 dias, para times em projeto, realocação ou período de experiência.",
  },
  {
    icon: FileText,
    titulo: "Nota fiscal",
    texto: "Emissão de nota fiscal dos serviços da plataforma, para o seu financeiro fechar sem dor de cabeça.",
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
      <span className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-forest">
        <Building2 className="h-3.5 w-3.5" /> Para empresas
      </span>
      <h1 className="mt-4 font-title text-4xl font-bold text-ink">
        Moradia de média duração para o seu time
      </h1>
      <p className="mt-4 text-lg text-muted">
        Locação mobiliada de 30 a 180 dias para mobilidade corporativa — imóveis prontos, inquilino
        verificado e a negociação toda pela plataforma. O aluguel vai direto ao proprietário; a
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
