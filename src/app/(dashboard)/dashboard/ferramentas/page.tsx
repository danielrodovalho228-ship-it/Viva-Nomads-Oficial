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
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            <Lock className="h-3 w-3" /> {f.status}
          </span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 min-h-[2.75rem] font-title font-bold text-ink">{f.titulo}</h3>
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
  const base = "flex h-full flex-col rounded-2xl border border-sage-200 bg-white p-5";
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
        capa="ferramentas"
        title="Ferramentas"
        subtitle="Tudo o que ajuda você a analisar, fechar e proteger a locação — em um só lugar."
      />

      <div className="space-y-10">
        {GRUPOS.map((g) => {
          const foto = FOTOS_FERRAMENTAS[g.id];
          return (
            <section key={g.id} aria-labelledby={`grupo-${g.id}`} data-testid="ferramentas-grupo">
              <div className="mb-4">
                <h2 id={`grupo-${g.id}`} className="font-title text-xl font-bold text-ink">
                  {g.titulo}
                </h2>
                <p className="text-sm text-muted">{g.texto}</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div className="relative aspect-[16/7] overflow-hidden rounded-2xl bg-surface-2 lg:aspect-auto lg:min-h-full">
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
                <div className="grid auto-rows-fr gap-4 sm:grid-cols-2">
                  {g.itens.map((f) => (
                    <CardFerramenta key={f.titulo} f={f} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}

        <p className="flex items-start gap-2 rounded-xl border border-sage-200 bg-surface-2 px-4 py-3 text-sm text-muted">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
          Em todas as ferramentas, a Viva Nomads <strong>calcula, conecta e documenta</strong> — o
          dinheiro (valor mensal, caução, seguros) vai direto ao proprietário, à poupança da caução ou ao
          parceiro. A plataforma nunca retém valores.
        </p>
      </div>
    </div>
  );
}
