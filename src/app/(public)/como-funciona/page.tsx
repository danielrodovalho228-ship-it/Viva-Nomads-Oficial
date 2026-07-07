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
      <section className="bg-forest section-y text-white">
        <div className="container-page max-w-3xl">
          <h1 className="font-title text-4xl font-bold md:text-5xl">Como funciona</h1>
          <p className="mt-5 text-lg text-white/80">
            Do anúncio ao contrato, com verificação e segurança em cada passo — para inquilino
            e proprietário.
          </p>
        </div>
      </section>

      <Steps title="Para quem busca um imóvel" steps={TENANT_STEPS} eager tone="tenant" badge="Para inquilinos" />

      {/* Garantias da locação (inquilino) — âncora #garantias. Destino correto do
          CTA "Ver opções de garantia" (antes levava à área do proprietário). */}
      <GarantiasInquilino />

      {/* Faixa de fundo separa visualmente os dois fluxos (reforço no mobile) */}
      <div className="border-y border-sage-200 bg-surface-2">
        <Steps title="Para proprietários" steps={OWNER_STEPS} tone="owner" badge="Para proprietários" />
      </div>

      <section className="container-page section-y text-center">
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

/**
 * Explicação das garantias para o INQUILINO (linguagem de quem vai alugar).
 * Fonte única e neutra: enquanto a parceria de seguro-fiança não estiver
 * assinada, o status é honesto ("via parceiro — em estruturação"), no mesmo
 * padrão do hub de Ferramentas. Âncora #garantias.
 */
function GarantiasInquilino() {
  return (
    <section id="garantias" className="container-page section-y scroll-mt-24">
      <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-champagne/15 px-3 py-1 text-xs font-semibold text-champagne-600">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Para inquilinos
      </span>
      <h2 className="font-title text-3xl font-bold text-ink">Garantias da locação</h2>
      <p className="mt-3 max-w-2xl text-muted">
        Por lei, cada contrato usa <strong>uma</strong> garantia. Você escolhe a que
        preferir, com a mesma proteção para as duas partes — e nada fica com a plataforma.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-sage-200 bg-white p-6">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-title text-lg font-bold text-ink">Caução (depósito devolvível)</h3>
          <p className="mt-2 text-sm text-muted">
            Um depósito que fica em conta vinculada e <strong>volta para você</strong> ao fim da
            estadia, nos termos do contrato e da Lei 8.245/91. Sem mensalidade.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-2.5 py-1 text-xs font-semibold text-forest">
            Disponível
          </span>
        </div>
        <div className="rounded-2xl border border-sage-200 bg-white p-6">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-white">
            <FileSignature className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-title text-lg font-bold text-ink">Seguro-fiança (sem depósito)</h3>
          <p className="mt-2 text-sm text-muted">
            Entre <strong>sem deixar dinheiro preso</strong>: uma mensalidade diluída cobre o
            aluguel, contratada com parceiro e sujeita a análise. Ideal para quem prefere não
            imobilizar caixa.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            Via parceiro — em estruturação
          </span>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">
        A Viva Nomads conecta, verifica e documenta — não é fiadora, seguradora nem retém
        valores. A garantia é combinada no fechamento, conforme o que o imóvel aceita.
      </p>
    </section>
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
    <section className="container-page section-y">
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
