import type { Metadata } from "next";
import {
  Search,
  MessageSquare,
  ShieldCheck,
  FileSignature,
  KeyRound,
  Home,
  ClipboardCheck,
  Award,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Como funciona",
  description:
    "Entenda como funciona a locação mobiliada por temporada no Viva Nomads — para inquilinos e para proprietários.",
};

const TENANT_STEPS = [
  { icon: Search, title: "Busque", text: "Filtre imóveis por cidade, período, orçamento e pelo selo Pronto para Trabalho." },
  { icon: MessageSquare, title: "Converse", text: "Fale direto com o proprietário, tire dúvidas e agende uma visita." },
  { icon: ShieldCheck, title: "Verifique-se", text: "Faça a verificação de perfil (CAF) — identidade e prova de vida — para dar segurança ao proprietário." },
  { icon: FileSignature, title: "Assine", text: "Escolha a garantia, assine o contrato digital com validade jurídica e receba as chaves." },
];

const OWNER_STEPS = [
  { icon: ClipboardCheck, title: "Qualifique o imóvel", text: "Passe pelo checklist de elegibilidade — a prova de que é locação por temporada regular." },
  { icon: Award, title: "Ganhe o selo", text: "Some 70+ pontos na pontuação de qualidade e conquiste o selo Pronto para Trabalho." },
  { icon: Home, title: "Anuncie", text: "Publique fotos, descrição e preço. Receba consultas de inquilinos qualificados." },
  { icon: KeyRound, title: "Feche o contrato", text: "Aprove o inquilino (a decisão é sua), gere o contrato e receba o aluguel direto." },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="bg-forest py-16 text-white md:py-20">
        <div className="container-page max-w-3xl">
          <h1 className="font-title text-4xl font-extrabold md:text-5xl">Como funciona</h1>
          <p className="mt-5 text-lg text-white/80">
            Simples para quem busca, seguro para quem anuncia. Locação mobiliada por temporada
            de 30 a 180 dias, com contrato formal e inquilino verificado.
          </p>
        </div>
      </section>

      <Steps title="Para quem busca um imóvel" steps={TENANT_STEPS} />
      <div className="bg-surface-2">
        <Steps title="Para proprietários" steps={OWNER_STEPS} />
      </div>

      <section className="container-page py-16 text-center">
        <h2 className="font-title text-3xl font-extrabold text-ink">Pronto para começar?</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/buscar" variant="primary" size="lg">
            Buscar imóveis
          </ButtonLink>
          <ButtonLink href="/qualificar" variant="gold" size="lg">
            Anunciar meu imóvel
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

function Steps({
  title,
  steps,
}: {
  title: string;
  steps: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }[];
}) {
  return (
    <section className="container-page py-16">
      <h2 className="font-title text-3xl font-extrabold text-ink">{title}</h2>
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="rounded-2xl border border-sage-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-title text-3xl font-extrabold text-sage-200">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-title text-lg font-bold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
