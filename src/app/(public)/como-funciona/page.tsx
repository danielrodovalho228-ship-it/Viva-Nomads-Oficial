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
  Megaphone,
  Wallet,
  Repeat,
  PiggyBank,
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
  { icon: MessageSquare, img: "/media/como-funciona-01-converse.webp", alt: "Mulher jovem sorrindo no laptop, conversando pela plataforma", title: "Converse", text: "Fale direto com o proprietário, tire dúvidas e combine os detalhes." },
  { icon: ShieldCheck, img: `${IMG}/03-verifique.webp`, alt: "Verificação de identidade com documento", title: "Verifique-se", text: "Confirme sua identidade uma vez e candidate-se com um clique." },
  { icon: FileSignature, img: "/media/como-funciona-02-assine.webp", alt: "Homem assinando o contrato pelo celular", title: "Assine", text: "Assine o contrato digital com validade jurídica e receba as chaves." },
];

const OWNER_STEPS = [
  { icon: ClipboardCheck, img: "/media/como-funciona-03-qualifique.webp", alt: "Mulher analisando um perfil no tablet", title: "Qualifique o imóvel", text: "Passe pelo checklist e mostre que seu imóvel está pronto." },
  { icon: Award, img: `${IMG}/06-selo.webp`, alt: "Apartamento mobiliado com espaço de trabalho em casa", title: "Ganhe o selo", text: "Conquiste o selo Pronto para Morar e ganhe destaque na busca." },
  { icon: Home, img: `${IMG}/07-anuncie.webp`, alt: "Proprietário publicando o anúncio do imóvel", title: "Anuncie", text: "Publique fotos e descrição e receba consultas de inquilinos verificados." },
  { icon: KeyRound, img: "/media/como-funciona-04-chaves.webp", alt: "Casal recebendo as chaves do imóvel, aperto de mãos", title: "Feche com segurança", text: "Você decide, gera o contrato e recebe direto na sua conta — a plataforma registra e documenta cada recebimento." },
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

      {/* Dois caminhos do inquilino: buscar (fluxo acima) ou publicar um pedido. */}
      <DoisCaminhos />

      {/* Garantias da locação (inquilino) — âncora #garantias. Destino correto do
          CTA "Ver opções de garantia" (antes levava à área do proprietário). */}
      <GarantiasInquilino />

      {/* O que acontece durante e ao fim da estadia (texto neutro, sem prazos). */}
      <DuranteDepois />

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

/**
 * Dois caminhos para o inquilino, logo após o fluxo de busca: (a) buscar
 * imóveis (o passo a passo acima) ou (b) publicar um Pedido de Moradia e deixar
 * os proprietários responderem. Mesmo padrão visual dos cards da página.
 */
function DoisCaminhos() {
  return (
    <section className="container-page pb-4">
      <h2 className="font-title text-2xl font-bold text-ink">Dois caminhos</h2>
      <p className="mt-2 max-w-2xl text-muted">
        Você escolhe como chegar ao imóvel: procurar por conta própria ou dizer o que precisa
        e deixar os proprietários virem até você.
      </p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-sage-200 bg-white p-6">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-white">
            <Search className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-title text-lg font-bold text-ink">Buscar imóveis</h3>
          <p className="mt-2 flex-1 text-sm text-muted">
            Explore os imóveis mobiliados por cidade, período e orçamento — é o passo a passo
            acima, do primeiro contato até a assinatura.
          </p>
          <ButtonLink href="/buscar" variant="outline" className="mt-5 self-start">
            Buscar imóveis
          </ButtonLink>
        </div>
        <div className="flex flex-col rounded-2xl border border-sage-200 bg-white p-6">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-white">
            <Megaphone className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-title text-lg font-bold text-ink">Publicar um Pedido de Moradia</h3>
          <p className="mt-2 flex-1 text-sm text-muted">
            Diga o que você precisa e os proprietários da cidade respondem com os imóveis deles.
            Sua identidade só aparece para quem você aceitar.
          </p>
          <ButtonLink href="/pedidos/novo" variant="primary" className="mt-5 self-start">
            Publicar pedido
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/**
 * O que acontece DURANTE e ao FIM da estadia. Texto neutro e declaratório — sem
 * prazos inventados (aguarda parecer): a plataforma registra e documenta; o
 * dinheiro nunca passa por ela. Vistoria/dossiê NÃO entram aqui ainda (pós-QA).
 */
function DuranteDepois() {
  const itens = [
    {
      icon: Wallet,
      title: "Pagamentos",
      text: "Vão direto ao proprietário e ficam registrados na plataforma. Nada passa pela Viva Nomads.",
    },
    {
      icon: Repeat,
      title: "Renovação",
      text: "A estadia se renova em blocos, sem nova comissão a cada período.",
    },
    {
      icon: PiggyBank,
      title: "Devolução da caução",
      text: "Ao fim da estadia, conforme o contrato, com tudo documentado.",
    },
  ];
  return (
    <section className="container-page pb-4">
      <h2 className="font-title text-2xl font-bold text-ink">Durante e depois da estadia</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        {itens.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.title} className="flex flex-col">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-title text-lg font-bold text-ink">{it.title}</h3>
              <p className="mt-2 text-sm text-muted">{it.text}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-muted">
        A Viva Nomads registra e documenta cada etapa — não retém valores nem é parte no
        pagamento.
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
