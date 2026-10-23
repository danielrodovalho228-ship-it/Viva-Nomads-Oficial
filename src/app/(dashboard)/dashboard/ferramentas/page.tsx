import Image from "next/image";
import Link from "next/link";
import {
  TrendingUp,
  Percent,
  Calculator,
  Scale,
  FileText,
  FileSignature,
  Receipt,
  CalendarDays,
  Flame,
  ShieldCheck,
  Wrench,
  BadgeCheck,
  ArrowRight,
  Lock,
  Sparkles,
  MessageSquareText,
  CalendarClock,
} from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { FOTOS_FERRAMENTAS } from "@/components/dashboard/capas";
import { BRAND_BLUR } from "@/lib/media";

/*
  Central de Ferramentas (ampliação da ordem 9f3085d8). Três grupos, quatro
  ferramentas reais em cada: foto do grupo ao lado de uma grade 2×2 de cards
  da mesma altura. Ferramenta ainda sem parceiro aparece como card de status,
  sem link e sem botão.
*/

interface Ferramenta {
  /** Sem href = card informativo (em estruturação). */
  href?: string;
  titulo: string;
  texto: string;
  icone: React.ComponentType<{ className?: string }>;
  acao?: string;
  status?: string;
}

interface Grupo {
  id: keyof typeof FOTOS_FERRAMENTAS;
  titulo: string;
  texto: string;
  itens: [Ferramenta, Ferramenta, Ferramenta, Ferramenta];
}

const GRUPOS: Grupo[] = [
  {
    id: "analise",
    titulo: "Análise & cálculo",
    texto: "Entenda o retorno antes de anunciar ou de investir em móveis.",
    itens: [
      {
        href: "/dashboard/simulador",
        titulo: "Simulador de rentabilidade",
        texto: "Quanto o seu imóvel rende por mês na Viva Nomads — receita, custos e líquido.",
        icone: TrendingUp,
      },
      {
        href: "/dashboard/roi-imovel",
        titulo: "Calculadora de ROI",
        texto: "Vale a pena mobiliar? Veja o payback do investimento e o retorno anual.",
        icone: Percent,
      },
      {
        href: "/dashboard/carteira",
        titulo: "Análise da carteira",
        texto: "Com 3 imóveis ativos ou mais: ocupação, receita e vencimentos de todos juntos.",
        icone: Calculator,
      },
      {
        href: "/dashboard/tributacao",
        titulo: "Tributação PF × PJ",
        texto: "Estime o imposto das locações como pessoa física e como empresa.",
        icone: Scale,
      },
    ],
  },
  {
    id: "fechamento",
    titulo: "Fechamento & documentos",
    texto: "Do orçamento ao contrato assinado, com tudo registrado.",
    itens: [
      {
        href: "/dashboard/orcamentos",
        titulo: "Orçamentos",
        texto: "Monte e envie propostas numeradas para os interessados.",
        icone: FileText,
      },
      {
        href: "/dashboard/fechamento",
        titulo: "Fechamento",
        texto: "Verificação, garantia, serviços e contrato — em um fluxo só.",
        icone: FileSignature,
      },
      {
        href: "/dashboard/contratos",
        titulo: "Contratos & blocos",
        texto: "Acompanhe os blocos e registre os recebimentos que você declara.",
        icone: Receipt,
      },
      {
        // Prompt 23: a Agenda entra na grade 2×2 (a conferência de entrada segue no menu, em Contratos).
        href: "/dashboard/agenda",
        titulo: "Agenda",
        texto: "Visitas, entradas, saídas e datas bloqueadas de todos os imóveis num calendário só.",
        icone: CalendarDays,
      },
    ],
  },
  {
    id: "protecao",
    titulo: "Proteção & garantias",
    texto: "Coberturas, garantias e registros que dão segurança à locação.",
    itens: [
      {
        href: "/dashboard/garantias",
        titulo: "Garantia locatícia",
        texto: "Caução Viva (50% por bloco, devolvível) — o dinheiro nunca fica com a plataforma.",
        icone: ShieldCheck,
      },
      {
        href: "/dashboard/verificacao",
        titulo: "Verificação de identidade",
        texto: "Documento e prova de vida para fechar com quem é quem diz ser.",
        icone: BadgeCheck,
      },
      {
        href: "/dashboard/solicitacoes",
        titulo: "Solicitações de manutenção",
        texto: "Problema reportado com foto, resposta e solução — tudo no histórico do contrato.",
        icone: Wrench,
      },
      {
        titulo: "Seguro incêndio",
        texto: "Proteção contra incêndio do imóvel. A contratação via parceiro está em estruturação.",
        icone: Flame,
        status: "Em estruturação",
      },
    ],
  },
];

/** Prompt 55-E2: ferramentas do dia a dia (fora da grade 3 × 4 com foto). */
const OPERAR: { href: string; titulo: string; texto: string; acao: string; icone: React.ComponentType<{ className?: string }> }[] = [
  {
    href: "/dashboard/respostas-rapidas",
    titulo: "Respostas rápidas",
    texto: "Até 20 respostas salvas para usar na conversa com 1 toque. A mensagem do seu anúncio vem primeiro.",
    acao: "Abrir respostas",
    icone: MessageSquareText,
  },
  {
    href: "/dashboard/contratos",
    titulo: "Mensagens programadas",
    texto: "Abra a estadia em Contratos. Em cada uma: 7 dias antes da entrada, no dia da entrada e no dia da saída. Nada sai entre 22h e 7h.",
    acao: "Ver contratos",
    icone: CalendarClock,
  },
];

function CardFerramenta({ f }: { f: Ferramenta }) {
  const corpo = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span
          className={
            f.href
              ? "grid h-10 w-10 place-items-center rounded-xl bg-sage-100 text-forest"
              : "grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"
          }
        >
          <f.icone className="h-5 w-5" />
        </span>
        {f.status && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            <Lock className="h-3 w-3" /> {f.status}
          </span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 min-h-[2.75rem] font-title font-semibold text-ink">{f.titulo}</h3>
      <p className="mt-1 flex-1 text-sm text-muted">{f.texto}</p>
      {f.href ? (
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-forest">
          {f.acao ?? "Abrir"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      ) : (
        <span className="mt-3 text-sm font-medium text-muted">Via parceiro — em breve</span>
      )}
    </>
  );
  const base = "flex h-full flex-col rounded-xl border border-sage-200 bg-white p-4";
  return f.href ? (
    <Link
      href={f.href}
      data-testid="ferramenta-card"
      className={`group ${base} transition-colors hover:border-sage hover:bg-surface-2`}
    >
      {corpo}
    </Link>
  ) : (
    <div data-testid="ferramenta-card" className={base}>
      {corpo}
    </div>
  );
}

export default function FerramentasPage() {
  return (
    <div>
      <PageTitle
        title="Ferramentas"
        subtitle="Tudo o que ajuda você a analisar, fechar e proteger a locação — em um só lugar."
      />

      <div className="space-y-12">
        {GRUPOS.map((g) => {
          const foto = FOTOS_FERRAMENTAS[g.id];
          return (
            <section key={g.id} aria-labelledby={`grupo-${g.id}`} data-testid="ferramentas-grupo">
              <div className="mb-4">
                <h2 id={`grupo-${g.id}`} className="font-title text-xl font-semibold text-ink">
                  {g.titulo}
                </h2>
                <p className="text-sm text-muted">{g.texto}</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div className="relative aspect-[16/7] overflow-hidden rounded-xl bg-surface-2 lg:aspect-auto lg:min-h-full">
                  <Image
                    src={foto.src}
                    alt={foto.alt}
                    fill
                    sizes="(min-width: 1024px) 30vw, 100vw"
                    placeholder="blur"
                    blurDataURL={BRAND_BLUR}
                    className="object-cover"
                  />
                </div>
                <div className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2">
                  {g.itens.map((f) => (
                    <CardFerramenta key={f.titulo} f={f} />
                  ))}
                </div>
              </div>
              {/* Prompt 54: desempenho de cada anúncio (o atalho leva a Meus imóveis → Desempenho). */}
              {g.id === "analise" && (
                <Link href="/dashboard/imoveis" className="mt-3 mr-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline underline-offset-4" data-testid="atalho-desempenho">
                  Desempenho do anúncio
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              {/* Prompt 53: importar o calendário do Airbnb/Booking fica no calendário de cada imóvel (editor). */}
              {g.id === "fechamento" && (
                <Link href="/dashboard/imoveis" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline underline-offset-4" data-testid="atalho-importar-calendario">
                  Importar calendário do Airbnb ou Booking
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              {/* Prompt 39-B1: o informe anual dos recibos, ao lado do simulador. */}
              {g.id === "analise" && (
                <Link href="/dashboard/recibos#informe" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline underline-offset-4" data-testid="atalho-informe-ir">
                  Informe para o IR
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </section>
          );
        })}

        {/* Prompt 55-E2: "Para operar" — o dia a dia das conversas e das estadias. */}
        <section aria-labelledby="grupo-operar" data-testid="ferramentas-operar">
          <div className="mb-4">
            <h2 id="grupo-operar" className="font-title text-xl font-semibold text-ink">
              Para operar
            </h2>
            <p className="text-sm text-muted">O dia a dia das conversas e das estadias, sem repetir a mesma resposta.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {OPERAR.map((f) => (
              <Link
                key={f.titulo}
                href={f.href}
                data-testid="ferramenta-operar"
                className="group flex h-full flex-col rounded-xl border border-sage-200 bg-white p-4 transition-colors hover:border-sage hover:bg-surface-2"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sage-100 text-forest">
                  <f.icone className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-title font-semibold text-ink">{f.titulo}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{f.texto}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-forest">
                  {f.acao}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <p className="flex items-start gap-2 rounded-xl border border-sage-200 bg-surface-2 px-4 py-3 text-sm text-muted">
          <Sparkles className="mt-1 h-4 w-4 shrink-0 text-sage" />
          Em todas as ferramentas, a Viva Nomads <strong>calcula, conecta e documenta</strong> — o
          dinheiro (valor mensal, caução, seguros) vai direto ao proprietário, à poupança da caução ou ao
          parceiro. A plataforma nunca retém valores.
        </p>
      </div>
    </div>
  );
}
