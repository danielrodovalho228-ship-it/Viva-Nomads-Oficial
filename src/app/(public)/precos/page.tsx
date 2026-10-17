import type { Metadata } from "next";
import { Check, Camera, FileSignature, ShieldCheck, UserCheck, Banknote, PiggyBank, ArrowRight, Megaphone, TrendingDown, Users } from "lucide-react";
import { BannerTopo } from "@/components/institucional/banner-topo";
import { BrandImage } from "@/components/brand-image";
import { PHOTOS } from "@/lib/media";
import { FAIXAS_COMISSAO_PADRAO, TEXTO_REGRA_UNICA, DESCRICAO_PRECOS, TAXA_NEGOCIADA_TEXTO, taxaPublicaTexto, comissaoSobreContrato, TEXTO_RENOVACAO_COMISSAO } from "@/lib/cobranca/regra";
import { PlanoGestorForm } from "@/components/precos/plano-gestor-form";
import { ComparativoPrecos } from "@/components/precos/comparativo-precos";
import { ButtonLink } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { CAUCAO_FRASE } from "@/lib/faixas";
import { JsonLd } from "@/components/seo/json-ld";
import { ofertaRegraUnica } from "@/lib/seo/estruturados";
import { SITE_URL, SUPORTE_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/precos" },
  title: "Anuncie imóveis mobiliados: 12% por contrato",
  description: DESCRICAO_PRECOS,
};

/**
 * Serviços opcionais (ordem 5a4b9146: simplificados) — só o que existe, com
 * status honesto, numa faixa compacta. A plataforma organiza e documenta; nunca
 * é a garantidora. Por lei, só uma garantia por contrato.
 */
const OPCIONAIS = [
  { icon: PiggyBank, titulo: "Caução", texto: `${CAUCAO_FRASE} Devolvida ao fim da estadia.`, status: "Disponível", ok: true, href: "/como-funciona#garantias" },
  { icon: ShieldCheck, titulo: "Outras modalidades", texto: "Outras modalidades de garantia locatícia: em breve. A plataforma não é a garantidora.", status: "Em breve", ok: false, href: "/como-funciona#garantias" },
  { icon: Camera, titulo: "Fotografia profissional", texto: "Sessão de fotos do imóvel com parceiro, sob consulta.", status: "Via parceiro", ok: false, href: "/parceiros/fotografos" },
] as const;

/** Já vem em toda locação — sem contratar nada à parte (antes era a seção "Tecnologia & segurança"). */
const INCLUIDO = [
  { icon: FileSignature, titulo: "Contrato assinado digitalmente", texto: "De 30 a 180 dias, com validade jurídica." },
  { icon: UserCheck, titulo: "Conversa registrada", texto: "Negociação na plataforma, com o contato protegido até o aceite." },
  { icon: Banknote, titulo: "Valor mensal direto ao proprietário", texto: "A plataforma não recebe nem retém o valor mensal." },
] as const;

export default function PricingPage() {
  return (
    <>
      <JsonLd dados={ofertaRegraUnica(SITE_URL)} />

      <BannerTopo
        foto={PHOTOS.ownerKeys}
        alt="Proprietário entregando as chaves de um imóvel mobiliado"
        eyebrow="Preços"
        titulo="Anunciar é grátis"
        alinhamento="centro"
        subtitulo={
          <p>
            A Viva cobra <strong className="text-white">12% sobre o valor total do contrato fechado</strong>. Sem mensalidade.
          </p>
        }
      >
        <ButtonLink href="/dashboard/imoveis/novo" variant="inverse" size="lg">
          Anunciar meu imóvel <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </BannerTopo>

      {/* Os três números que importam, logo abaixo do banner. */}
      <section className="container-page relative z-10 -mt-10">
        <div className="grid gap-4 sm:grid-cols-3" data-testid="precos-destaques">
          {[
            { Icon: Megaphone, n: "R$ 0", t: "para anunciar, quantos imóveis quiser" },
            { Icon: TrendingDown, n: "12% → 6%", t: "quanto mais imóveis, menor a taxa" },
            { Icon: Users, n: "R$ 0", t: "de taxa para quem vem morar" },
          ].map(({ Icon, n, t }) => (
            <div key={t} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-lg">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <p className="font-title text-2xl font-bold text-ink">{n}</p>
                <p className="text-sm text-muted">{t}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page pb-16 pt-10">
        <div className="mb-10 rounded-3xl border border-champagne bg-white p-6 shadow-xl ring-2 ring-champagne sm:p-8" data-testid="regra-unica">
          <h2 className="font-title text-2xl font-bold text-ink">Quanto mais imóveis, menor a taxa</h2>
          <p className="mt-3 text-ink">{TEXTO_REGRA_UNICA}</p>
          <ul className="mt-5 space-y-3">
            {[
              "Anunciar é grátis, com quantos imóveis mobiliados você quiser.",
              "Você só paga quando o contrato é fechado, sobre o valor total do contrato (valor mensal × meses). " + TEXTO_RENOVACAO_COMISSAO,
              "Sem mensalidade. Quem vem morar não paga taxa da plataforma.",
              "A cobrança é feita ao proprietário; a plataforma não recebe nem retém o valor mensal do contrato.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden /> {t}
              </li>
            ))}
          </ul>
          <table className="mt-5 w-full text-left text-sm" data-testid="faixas-taxa">
            <caption className="sr-only">Taxa por número de imóveis ativos</caption>
            <thead>
              <tr className="border-b border-champagne text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Imóveis ativos</th>
                <th scope="col" className="py-2 pr-3 font-medium">Taxa sobre o valor total do contrato</th>
                <th scope="col" className="py-2 font-medium">Exemplo: 3 meses a R$ 3.000 por mês (total R$ 9.000)</th>
              </tr>
            </thead>
            <tbody>
              {FAIXAS_COMISSAO_PADRAO.map((f) => (
                <tr key={f.minImoveis} className="border-b border-champagne/50 text-ink">
                  <th scope="row" className="py-2 pr-3 font-medium">
                    {f.gestor ? `${f.minImoveis}+ · Plano Gestor` : f.maxImoveis === null ? `${f.minImoveis}+` : `${f.minImoveis}–${f.maxImoveis}`}
                  </th>
                  <td className="py-2 pr-3">{taxaPublicaTexto(f)}</td>
                  <td className="py-2">{f.gestor ? TAXA_NEGOCIADA_TEXTO : formatBRL(comissaoSobreContrato(3000, 3, f.taxa))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted" data-testid="plano-gestor">
            31 imóveis ou mais? Plano Gestor: condições negociadas, entre em contato.
          </p>
          <PlanoGestorForm />
          <ButtonLink href="/dashboard/imoveis/novo" variant="gold" className="mt-6 w-full sm:w-auto">
            Anunciar meu imóvel
          </ButtonLink>
        </div>

        <ComparativoPrecos />
      </section>

      {/* Incluído em toda locação (antes "Tecnologia & segurança"). */}
      <section className="bg-surface-2 section-y" data-testid="precos-incluido">
        <div className="container-page">
          <h2 className="text-center font-title text-3xl font-bold text-ink">Incluído em toda locação</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {INCLUIDO.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.titulo} className="flex gap-4 rounded-2xl border border-line bg-white p-5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-title text-base font-bold text-ink">{b.titulo}</h3>
                    <p className="mt-1 text-sm text-muted">{b.texto}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Serviços opcionais — simplificados: uma faixa compacta, status honesto. */}
      <section className="container-page section-y" data-testid="precos-opcionais">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-title text-2xl font-bold text-ink">Se você precisar</h2>
          <p className="mt-2 text-muted">Opcionais, contratados no momento certo do fluxo. Caução: uma por contrato, combinada entre proprietário e inquilino.</p>
        </div>
        <ul className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-3">
          {OPCIONAIS.map((o) => {
            const Icon = o.icon;
            return (
              <li key={o.titulo}>
                <a href={o.href} className="flex h-full flex-col rounded-2xl border border-line bg-white p-5 transition hover:border-forest hover:shadow-md">
                  <div className="flex items-center justify-between gap-3">
                    <Icon className="h-5 w-5 text-forest" aria-hidden />
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", o.ok ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-700")}>{o.status}</span>
                  </div>
                  <h3 className="mt-3 font-title text-base font-bold text-ink">{o.titulo}</h3>
                  <p className="mt-1 text-sm text-muted">{o.texto}</p>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Chamada final com foto. */}
      <section className="container-page pb-16">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-forest text-white md:grid-cols-2">
          <div className="p-8 md:p-12">
            <h2 className="font-title text-3xl font-bold">Seu imóvel mobiliado, ocupado por meses</h2>
            <p className="mt-3 text-white/80">Anuncie de graça e pague só quando o contrato for fechado.</p>
            <ButtonLink href="/dashboard/imoveis/novo" variant="inverse" size="lg" className="mt-6">
              Anunciar meu imóvel <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
          <BrandImage src={PHOTOS.condominio} alt="Sala de estar mobiliada e iluminada" rounded="rounded-none" sizes="(max-width: 768px) 100vw, 50vw" className="h-64 w-full md:h-full md:min-h-[18rem]" />
        </div>
      </section>
    </>
  );
}
