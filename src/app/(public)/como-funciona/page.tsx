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
            Do anúncio ao contrato, com verificação e segurança em cada passo — para{" "}
            <a href="#para-inquilinos" className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
              inquilino
            </a>{" "}
            e{" "}
            <a href="#para-proprietarios" className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
              proprietário
            </a>.
          </p>
        </div>
      </section>

      {/* Sub-navegação ancorada — atalhos para as três partes da história. */}
      <SubNav />

      <Steps id="para-inquilinos" title="Para quem busca um imóvel" steps={TENANT_STEPS} eager tone="tenant" badge="Para inquilinos" />

      {/* Dois caminhos do inquilino: buscar (fluxo acima) ou publicar um pedido. */}
      <DoisCaminhos />

      {/* Grupo "Garantias e estadia" em off-white — respiro entre os blocos. */}
      <div className="border-y border-sage-200 bg-surface-2">
        {/* Garantias da locação (dupla perspectiva) — âncora #garantias. */}
        <GarantiasInquilino />
        {/* O que acontece durante e ao fim da estadia (texto neutro, sem prazos). */}
        <DuranteDepois />
      </div>

      <Steps id="para-proprietarios" title="Para proprietários" steps={OWNER_STEPS} tone="owner" badge="Para proprietários" />
      {/* Reforço de segurança do proprietário (sem vistoria/dossiê — pós-QA). */}
      <ProtegidoPor />

      <div className="border-t border-sage-200 bg-surface-2">
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
      </div>
    </>
  );
}

/**
 * Garantias da locação com DUPLA perspectiva (inquilino e proprietário) — a
 * garantia protege as duas partes. Fonte única e neutra: enquanto a parceria de
 * seguro-fiança não estiver assinada, o status é honesto ("via parceiro — em
 * estruturação"), no mesmo padrão do hub de Ferramentas. Âncora #garantias.
 */
function GarantiasInquilino() {
  return (
    <section id="garantias" className="container-page section-y scroll-mt-24">
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
          <dl className="mt-3 space-y-2.5 text-sm">
            <div>
              <dt className="font-semibold text-ink">Para o inquilino</dt>
              <dd className="text-muted">
                Depósito <strong>devolvível</strong> ao fim da estadia, nos termos do contrato e
                da Lei 8.245/91. Sem mensalidade.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Para o proprietário</dt>
              <dd className="text-muted">
                O valor fica na <strong>sua conta</strong> antes da entrada — cobertura imediata
                para danos ou inadimplência, com tudo documentado.
              </dd>
            </div>
          </dl>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-2.5 py-1 text-xs font-semibold text-forest">
            Disponível
          </span>
        </div>
        <div className="rounded-2xl border border-sage-200 bg-white p-6">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-white">
            <FileSignature className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-title text-lg font-bold text-ink">Seguro-fiança (sem depósito)</h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div>
              <dt className="font-semibold text-ink">Para o inquilino</dt>
              <dd className="text-muted">
                Entre <strong>sem imobilizar dinheiro</strong>: mensalidade diluída, sujeita a
                análise.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Para o proprietário</dt>
              <dd className="text-muted">
                A seguradora parceira cobre o aluguel em caso de inadimplência. Via parceiro — em
                estruturação.
              </dd>
            </div>
          </dl>
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
        <div className="flex flex-col overflow-hidden rounded-2xl border border-sage-200 bg-white">
          <StepImage src="/images/busca/busca-hero-villa.webp" alt="Imóvel mobiliado disponível para temporada" />
          <div className="flex flex-1 flex-col p-6">
            <h3 className="font-title text-lg font-bold text-ink">Buscar imóveis</h3>
            <p className="mt-2 flex-1 text-sm text-muted">
              Explore os imóveis mobiliados por cidade, período e orçamento — é o passo a passo
              acima, do primeiro contato até a assinatura.
            </p>
            <ButtonLink href="/buscar" variant="outline" className="mt-5 self-start">
              Buscar imóveis
            </ButtonLink>
          </div>
        </div>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-sage-200 bg-white">
          <StepImage src="/images/como-funciona/02-converse.webp" alt="Proprietária respondendo a um pedido por vídeo" />
          <div className="flex flex-1 flex-col p-6">
            <h3 className="font-title text-lg font-bold text-ink">Publicar um Pedido de Moradia</h3>
            <p className="mt-2 flex-1 text-sm text-muted">
              Diga o que você precisa e os proprietários da cidade respondem com os imóveis deles.
              Sua identidade só aparece para quem você aceitar.
            </p>
            <ButtonLink href="/pedidos/novo" variant="primary" className="mt-5 self-start">
              Publicar pedido
            </ButtonLink>
          </div>
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
      img: "/images/home/home-diferencial-homeoffice.webp",
      alt: "Pessoa organizando os pagamentos no computador em casa",
      title: "Pagamentos",
      text: "Vão direto ao proprietário e ficam registrados na plataforma. Nada passa pela Viva Nomads.",
    },
    {
      img: "/images/home/home-hero-chegada.webp",
      alt: "Hóspede chegando com a bagagem para mais um período de estadia",
      title: "Renovação",
      text: "A estadia se renova em blocos, sem nova comissão a cada período.",
    },
    {
      img: "/images/home/home-proprietarios-chaves.webp",
      alt: "Entrega das chaves ao fim da estadia",
      title: "Devolução da caução",
      text: "Ao fim da estadia, conforme o contrato, com tudo documentado.",
    },
  ];
  return (
    <section className="container-page pb-4">
      <h2 className="font-title text-2xl font-bold text-ink">Durante e depois da estadia</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        {itens.map((it) => (
          <div key={it.title} className="flex flex-col overflow-hidden rounded-2xl border border-sage-200 bg-white">
            <StepImage src={it.img} alt={it.alt} />
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-title text-lg font-bold text-ink">{it.title}</h3>
              <p className="mt-2 text-sm text-muted">{it.text}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted">
        A Viva Nomads registra e documenta cada etapa — não retém valores nem é parte no
        pagamento.
      </p>
    </section>
  );
}

/**
 * Faixa "Você fica protegido por" (proprietário): 3 camadas de segurança já
 * existentes. Sem vistoria/dossiê — só entram quando forem construídos (pós-QA).
 * Seguro incêndio: obrigação legal em toda locação; contratação via parceiro.
 */
function ProtegidoPor() {
  const itens = [
    {
      img: "/images/como-funciona/03-verifique.webp",
      alt: "Inquilino apresentando o documento de identidade para verificação",
      title: "Inquilino verificado",
      text: "Identidade e análise antes de qualquer conversa.",
    },
    {
      img: "/images/como-funciona/08-feche.webp",
      alt: "Aperto de mãos fechando o contrato de locação",
      title: "Garantia do contrato",
      text: "Caução direto na sua conta ou seguro-fiança — escolhida no fechamento.",
    },
    {
      img: "/images/home/home-condominio-tranquilo.webp",
      alt: "Fachada de um condomínio residencial",
      title: "Seguro incêndio",
      text: "Obrigatório por lei em toda locação; contratação via parceiro (em estruturação).",
    },
  ];
  return (
    <section className="container-page pb-14">
      <h2 className="font-title text-2xl font-bold text-ink">Você fica protegido por</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        {itens.map((it) => (
          <div key={it.title} className="flex flex-col overflow-hidden rounded-2xl border border-sage-200 bg-white">
            <StepImage src={it.img} alt={it.alt} />
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-title text-lg font-bold text-ink">{it.title}</h3>
              <p className="mt-2 text-sm text-muted">{it.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Sub-navegação ancorada (logo abaixo do hero): atalhos para as três partes da
 * história única. Rola suave (scroll-smooth no <html>) até âncoras com
 * scroll-margin. No mobile, as pílulas ficam em linha rolável (sem quebrar).
 */
function SubNav() {
  const links = [
    { href: "#para-inquilinos", label: "Para quem busca" },
    { href: "#garantias", label: "Garantias e estadia" },
    { href: "#para-proprietarios", label: "Para proprietários" },
  ];
  return (
    <nav aria-label="Seções desta página" className="border-b border-sage-200 bg-surface">
      <div className="container-page flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-full border border-sage-200 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-sage hover:bg-surface-2"
          >
            {l.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function Steps({
  title,
  steps,
  eager = false,
  tone = "tenant",
  badge,
  id,
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
  /** Âncora da seção (para a sub-navegação); adiciona scroll-margin. */
  id?: string;
}) {
  const badgeClass =
    tone === "owner" ? "bg-blue-50 text-blue-500" : "bg-champagne/15 text-champagne-600";
  return (
    <section id={id} className="container-page section-y scroll-mt-24">
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
