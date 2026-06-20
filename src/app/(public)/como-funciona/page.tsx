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
import { StepImage } from "@/components/step-image";

export const metadata: Metadata = {
  title: "Como funciona",
  description:
    "Entenda como funciona a locação mobiliada por temporada no Viva Nomads — para inquilinos e para proprietários.",
};

const IMG = "/images/como-funciona";

const TENANT_STEPS = [
  { icon: Search, img: `${IMG}/01-busque.webp`, alt: "Profissional pesquisando imóveis mobiliados no notebook", title: "Busque", text: "Encontre imóveis mobiliados por cidade, período e orçamento." },
  { icon: MessageSquare, img: `${IMG}/02-converse.webp`, alt: "Pessoa em videochamada conversando com o proprietário", title: "Converse", text: "Fale direto com o proprietário, tire dúvidas e combine os detalhes." },
  { icon: ShieldCheck, img: `${IMG}/03-verifique.webp`, alt: "Verificação de identidade com documento", title: "Verifique-se", text: "Confirme sua identidade uma vez e candidate-se com um clique." },
  { icon: FileSignature, img: `${IMG}/04-assine.webp`, alt: "Entrega de chaves após a assinatura do contrato", title: "Assine", text: "Assine o contrato digital com validade jurídica e receba as chaves." },
];

const OWNER_STEPS = [
  { icon: ClipboardCheck, img: `${IMG}/05-qualifique.webp`, alt: "Proprietário avaliando o imóvel com checklist", title: "Qualifique o imóvel", text: "Passe pelo checklist e mostre que seu imóvel está pronto." },
  { icon: Award, img: `${IMG}/06-selo.webp`, alt: "Apartamento mobiliado com espaço de trabalho em casa", title: "Ganhe o selo", text: "Conquiste o selo Pronto para Morar e ganhe destaque na busca." },
  { icon: Home, img: `${IMG}/07-anuncie.webp`, alt: "Proprietário publicando o anúncio do imóvel", title: "Anuncie", text: "Publique fotos e descrição e receba consultas de inquilinos verificados." },
  { icon: KeyRound, img: `${IMG}/08-feche.webp`, alt: "Aperto de mão entre proprietário e inquilino", title: "Feche com segurança", text: "Você decide, gera o contrato e recebe — tudo organizado." },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="bg-forest py-16 text-white md:py-20">
        <div className="container-page max-w-3xl">
          <h1 className="font-title text-4xl font-bold md:text-5xl">Como funciona</h1>
          <p className="mt-5 text-lg text-white/80">
            Do anúncio ao contrato, com verificação e segurança em cada passo — para inquilino
            e proprietário.
          </p>
        </div>
      </section>

      <Steps title="Para quem busca um imóvel" steps={TENANT_STEPS} eager tone="tenant" badge="Para inquilinos" />
      {/* Faixa de fundo separa visualmente os dois fluxos (reforço no mobile) */}
      <div className="border-y border-sage-200 bg-surface-2">
        <Steps title="Para proprietários" steps={OWNER_STEPS} tone="owner" badge="Para proprietários" />
      </div>

      <section className="container-page py-16 text-center">
        <h2 className="font-title text-3xl font-bold text-ink">Pronto para começar?</h2>
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
  eager = false,
  tone = "tenant",
  badge,
}: {
  title: string;
  steps: {
    icon: React.ComponentType<{ className?: string }>;
    img: string;
    alt: string;
    title: string;
    text: string;
  }[];
  /** Carrega as imagens deste fluxo de imediato (fluxo acima da dobra). */
  eager?: boolean;
  /** Acento por perfil: verde = inquilinos, azul = proprietários. */
  tone?: "tenant" | "owner";
  badge?: string;
}) {
  const badgeClass =
    tone === "owner" ? "bg-blue-50 text-blue-500" : "bg-champagne/15 text-champagne-600";
  return (
    <section className="container-page py-12 md:py-16">
      {badge && (
        <span className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {badge}
        </span>
      )}
      <h2 className="font-title text-3xl font-bold text-ink">{title}</h2>
      <div className="mt-8 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={s.title}
              className="flex flex-col overflow-hidden rounded-2xl border border-sage-200 bg-white"
            >
              {/* Imagem ilustrativa no topo (3:2), cantos arredondados em cima */}
              <StepImage src={s.img} alt={s.alt} priority={eager} />
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-title text-3xl font-bold text-sage-200">{i + 1}</span>
                </div>
                <h3 className="mt-4 font-title text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
