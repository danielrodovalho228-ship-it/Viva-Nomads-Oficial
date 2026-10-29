import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { BannerTopo } from "@/components/institucional/banner-topo";
import { BrandImage } from "@/components/brand-image";
import { PHOTOS } from "@/lib/media";
import { FAIXAS_COMISSAO_PADRAO, TEXTO_REGRA_UNICA, DESCRICAO_PRECOS, TAXA_NEGOCIADA_TEXTO, taxaPublicaTexto, comissaoSobreContrato, rotuloFaixaTaxa } from "@/lib/cobranca/regra";
import { DESTAQUES_PRECOS, FRASES_REGRA, INCLUIDO_CONTRATO, OPCIONAIS_PRECOS, SUBTITULO_OPCIONAIS } from "@/lib/precos-pagina";
import { PlanoGestorForm } from "@/components/precos/plano-gestor-form";
import { ComparativoPrecos } from "@/components/precos/comparativo-precos";
import { SimuladorBolso } from "@/components/precos/simulador-bolso";
import { ButtonLink } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { CAUCAO_FRASE } from "@/lib/faixas";
import { JsonLd } from "@/components/seo/json-ld";
import { ofertaRegraUnica } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/precos" },
  // Título bate com o conteúdo (12% → 6%, faixas de regra.ts); literal para os testes de SEO medirem.
  title: "Imóveis mobiliados: 12% a 6% por contrato",
  description: DESCRICAO_PRECOS,
};

export default function PricingPage() {
  return (
    <>
      <JsonLd dados={ofertaRegraUnica(SITE_URL)} />

      <BannerTopo
        foto={PHOTOS.ownerKeys}
        posicaoFoto="50% 25%"
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

      {/* Os quatro números que importam (todos de regra.ts), logo abaixo do banner. Grade PAR. */}
      <section className="container-page relative z-10 -mt-12">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="precos-destaques">
          {DESTAQUES_PRECOS.map(({ n, t }) => (
            <div key={t} className="rounded-xl border border-line bg-white p-4">
              <p className="font-title text-2xl font-semibold text-ink">{n}</p>
              <p className="text-sm text-muted">{t}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page section-y">
        <div className="mb-12 w-full rounded-xl border border-line bg-white p-6 sm:p-8" data-testid="regra-unica">
          <h2 className="font-title text-2xl font-semibold text-ink">Quanto mais imóveis, menor a taxa</h2>
          <p className="mt-3 text-ink">{TEXTO_REGRA_UNICA}</p>
          <ul className="mt-4 grid gap-2 text-sm text-ink sm:grid-cols-3">
            {FRASES_REGRA.map((t) => (
              <li key={t} className="rounded-xl bg-surface-2 px-4 py-3">{t}</li>
            ))}
          </ul>

          {/* Computador: tabela. Celular: um cartão por faixa (sem rolagem lateral). */}
          <table className="mt-6 hidden w-full text-left text-sm sm:table" data-testid="faixas-taxa">
            <caption className="sr-only">Taxa por número de imóveis ativos</caption>
            <thead>
              <tr className="border-b border-line text-muted">
                <th scope="col" className="py-3 pl-3 pr-3 font-medium">Imóveis ativos</th>
                <th scope="col" className="py-3 pr-3 text-right font-medium">Taxa sobre o valor total do contrato</th>
                <th scope="col" className="py-3 pr-3 text-right font-medium">Exemplo: 3 meses a R$ 3.000 por mês (total R$ 9.000)</th>
              </tr>
            </thead>
            <tbody>
              {FAIXAS_COMISSAO_PADRAO.map((f) => (
                <tr
                  key={f.minImoveis}
                  data-negociavel={f.negociavel ? "1" : undefined}
                  className={cn("border-b border-line text-ink even:bg-surface-2", f.negociavel && "bg-sage-100 font-semibold even:bg-sage-100")}
                >
                  <th scope="row" className="py-3 pl-3 pr-3 font-medium">
                    {rotuloFaixaTaxa(f)}
                  </th>
                  <td className="py-3 pr-3 text-right tabular-nums">{taxaPublicaTexto(f)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{f.negociavel ? TAXA_NEGOCIADA_TEXTO : formatBRL(comissaoSobreContrato(3000, 3, f.taxa))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-6 grid gap-3 sm:hidden" data-testid="faixas-taxa-cartoes">
            {FAIXAS_COMISSAO_PADRAO.map((f) => (
              <li key={f.minImoveis} className={cn("rounded-xl border border-line p-4", f.negociavel && "border-forest bg-sage-100")}>
                <p className="font-semibold text-ink">
                  {rotuloFaixaTaxa(f, true)}
                </p>
                <p className="mt-1 flex justify-between text-sm text-ink">
                  <span>Taxa sobre o total</span> <span className="font-semibold tabular-nums">{taxaPublicaTexto(f)}</span>
                </p>
                <p className="flex justify-between text-sm text-muted">
                  <span>3 meses a R$ 3.000</span>
                  <span className="tabular-nums">{f.negociavel ? TAXA_NEGOCIADA_TEXTO : formatBRL(comissaoSobreContrato(3000, 3, f.taxa))}</span>
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row" data-testid="precos-botoes">
            <ButtonLink href="/dashboard/imoveis/novo" variant="primary" size="lg">
              Anunciar meu imóvel
            </ButtonLink>
            <PlanoGestorForm />
          </div>
        </div>

        <SimuladorBolso className="mb-12" />

        <ComparativoPrecos />
      </section>

      {/* Incluído em todo contrato: 4 caixas (grade PAR), com foto quando houver (única no site, t112). */}
      <section className="bg-surface-2 section-y" data-testid="precos-incluido">
        <div className="container-page">
          <h2 className="text-center font-title text-2xl font-semibold text-ink">Incluído em todo contrato</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INCLUIDO_CONTRATO.map((b) => (
              <div key={b.titulo} className="flex flex-col overflow-hidden rounded-xl border border-line bg-white">
                {b.foto && <BrandImage src={b.foto} alt={b.alt ?? ""} rounded="rounded-none" sizes="(max-width: 640px) 100vw, 25vw" className="aspect-[16/9] w-full" />}
                <div className="p-4">
                  <h3 className="font-title text-base font-semibold text-ink">{b.titulo}</h3>
                  <p className="mt-1 text-sm text-muted">{b.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Se você precisar: 4 opcionais (grade PAR), só o que existe, status honesto. */}
      <section className="container-page section-y" data-testid="precos-opcionais">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-title text-2xl font-semibold text-ink">Se você precisar</h2>
          <p className="mt-2 text-muted">{SUBTITULO_OPCIONAIS}</p>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OPCIONAIS_PRECOS(CAUCAO_FRASE).map((o) => (
            <li key={o.titulo}>
              <a href={o.href} className="flex h-full flex-col rounded-xl border border-line bg-white p-4 transition hover:border-forest ">
                <span className={cn("self-start rounded-full px-3 py-1 text-xs font-semibold", o.ok ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-700")}>{o.status}</span>
                <h3 className="mt-3 font-title text-base font-semibold text-ink">{o.titulo}</h3>
                <p className="mt-1 text-sm text-muted">{o.texto}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Chamada final com foto. */}
      <section className="container-page pb-16 pt-4">
        <div className="grid items-center gap-8 overflow-hidden rounded-xl bg-forest text-white md:grid-cols-2">
          <div className="p-8 md:p-12">
            <h2 className="font-title text-2xl font-semibold">Seu imóvel mobiliado, ocupado por meses</h2>
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
