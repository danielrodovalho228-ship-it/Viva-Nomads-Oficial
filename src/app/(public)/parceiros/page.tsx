import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { trilha } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { BannerTopo } from "@/components/institucional/banner-topo";
import { BrandImage } from "@/components/brand-image";
import { ButtonLink } from "@/components/ui/button";
import { ParceiroForm } from "./parceiro-form";
import { FaixasTaxaParceria } from "@/components/parceiros/faixas-taxa";
import { FOTOS_PARCERIA } from "@/lib/parceiros-cartoes";

export const metadata: Metadata = {
  alternates: { canonical: "/parceiros" },
  title: "Seja parceiro: fotógrafos e gestores",
  description: "Fotógrafos, empresas, gestores e prestadores de serviços para imóveis mobiliados: cadastre seu interesse e seja parceiro da Viva Nomads.",
};

const CARDS = [
  { id: "fotografos", titulo: "Fotógrafos", selo: "Aberto", texto: "Perfil com portfólio, pacote e prazo. Depois do aceite você vê a identidade do dono, e a conversa segue pela plataforma. Há avaliação após a entrega.",
    links: [{ href: "/parceiros?tipo=fotografo#quero-ser-parceiro", rotulo: "Sou fotógrafo" }, { href: "/parceiros/fotografos", rotulo: "Procuro fotógrafo" }] },
  { id: "empresas", titulo: "Empresas", selo: "Aberto", texto: "Empresas que hospedam equipes em imóveis mobiliados.", links: [{ href: "/empresas", rotulo: "Conhecer" }] },
  { id: "gestores", titulo: "Gestores e administradoras", selo: "Aberto", texto: "Taxa menor por volume (12/10/8/6%) e Plano Gestor para quem tem 31 ou mais imóveis.",
    links: [{ href: "/precos", rotulo: "Ver o Plano Gestor" }] },
  { id: "servicos", titulo: "Serviços para o imóvel", selo: "Em breve", texto: "Limpeza, manutenção, mobília, enxoval, internet e mudança. Em breve: deixe seu contato.",
    links: [{ href: "/parceiros?tipo=servicos#quero-ser-parceiro", rotulo: "Deixar contato" }] },
  { id: "seguros", titulo: "Seguros e garantias", selo: "Em breve", texto: "Seguros e garantias para imóveis mobiliados. Em breve: deixe seu contato.",
    links: [{ href: "/parceiros?tipo=seguros#quero-ser-parceiro", rotulo: "Deixar contato" }] },
];

const PASSOS = [
  { t: "Cadastre-se", d: "Conte o que você faz e onde atende. Leva poucos minutos.", foto: "/images/unicas/parceiros-passo-cadastro.webp", alt: "Pessoa preenchendo o cadastro no notebook" },
  { t: "A Viva confere", d: "CNPJ ou MEI, portfólio e reputação, antes de aparecer no site.", foto: "/images/unicas/parceiros-passo-confere.webp", alt: "Conferência de documentos no computador" },
  { t: "Receba pedidos", d: "Quem anuncia ou busca imóveis mobiliados chama você; a conversa é pela plataforma.", foto: "/images/unicas/parceiros-passo-pedidos.webp", alt: "Conversa pelo celular" },
  { t: "Entregue e seja avaliado", d: "Depois da entrega, o cliente avalia — boas avaliações trazem mais pedidos.", foto: "/images/unicas/parceiros-passo-avaliado.webp", alt: "Quarto arrumado e limpo depois do serviço" },
];

const REGRAS = [
  "O pagamento do serviço é entre parceiro e cliente: a Viva não recebe esse dinheiro.",
  "Taxa de parceria só quando você aceita um pedido, com o valor mostrado antes (veja as faixas abaixo).",
  "Sem exclusividade e sem mensalidade.",
  "Contato fora da plataforma antes do aceite leva ao descadastro.",
];

const DUVIDAS = [
  { p: "Preciso de CNPJ?", r: "Para aparecer no site, CNPJ ou MEI. Você pode se cadastrar antes." },
  { p: "Quanto custa?", r: "É grátis. A taxa de parceria só existe quando você aceita um pedido." },
  { p: "Em quais cidades?", r: "Começando por Uberlândia (MG). Cadastre-se de qualquer cidade e avisamos quando chegarmos aí." },
];

export default async function ParceirosPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  return (
    <div>
      <JsonLd dados={trilha(SITE_URL, [{ nome: "Parceiros", caminho: "/parceiros" }])} />
      <BannerTopo
        foto="/images/unicas/parceiros-banner.webp"
        alt="Fotógrafo registrando uma sala mobiliada"
        eyebrow="Parceiros"
        titulo="Seja parceiro da Viva Nomads"
        subtitulo={<p>Atenda quem anuncia e quem busca imóveis mobiliados, com conversa só pela plataforma e identidade revelada depois do aceite.</p>}
      >
        <ButtonLink href="#quero-ser-parceiro" variant="inverse" size="lg">
          Quero ser parceiro <ArrowRight className="h-4 w-4" />
        </ButtonLink>
        <ButtonLink href="#tipos" variant="inverseSecondary" size="lg">
          Ver tipos de parceria
        </ButtonLink>
      </BannerTopo>

      {/* Números rápidos. */}
      <section className="container-page relative z-10 -mt-10">
        <dl className="grid gap-4 rounded-2xl border border-line bg-white p-6 shadow-lg sm:grid-cols-3">
          <div><dt className="font-title text-2xl font-bold text-ink">Uberlândia (MG)</dt><dd className="text-sm text-muted">Começamos por aqui; cadastre-se de qualquer cidade</dd></div>
          <div><dt className="font-title text-2xl font-bold text-ink">30–180 dias</dt><dd className="text-sm text-muted">de estadia em imóveis mobiliados</dd></div>
          <div><dt className="font-title text-2xl font-bold text-ink">R$ 0</dt><dd className="text-sm text-muted">para se cadastrar, sem mensalidade</dd></div>
        </dl>
      </section>

      <section id="tipos" aria-labelledby="h-tipos" className="container-page section-y scroll-mt-24">
        <h2 id="h-tipos" className="text-center font-title text-3xl font-bold text-ink md:text-4xl">Tipos de parceria</h2>
        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6" data-testid="parceiros-tipos">
          {CARDS.map((c) => {
            const f = FOTOS_PARCERIA.find((x) => x.id === c.id)!;
            return (
              <li key={c.id} className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm ${f.classeGrade}`}>
                {f.fotoPronta ? (
                  <BrandImage src={f.foto} alt={f.alt} rounded="rounded-none" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="aspect-[16/9] w-full" />
                ) : (
                  <div className="aspect-[16/9] w-full bg-sage-100" data-testid="parceiros-foto-pendente" aria-hidden />
                )}
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 font-title text-lg font-bold text-ink">{c.titulo}</h3>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.selo === "Aberto" ? "bg-sage-100 text-forest" : "bg-night/10 text-ink"}`}>{c.selo}</span>
                  </div>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{c.texto}</p>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-forest">
                    {c.links.map((l) => <Link key={l.href} href={l.href} className="underline underline-offset-2 hover:text-blue-700">{l.rotulo}</Link>)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Fluxo do processo com imagens (como as páginas de processo do Furnished Finder). */}
      <section aria-labelledby="h-como" className="bg-surface-2 section-y" data-testid="parceiros-fluxo">
        <div className="container-page">
          <h2 id="h-como" className="text-center font-title text-3xl font-bold text-ink md:text-4xl">Como funciona</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map((p, i) => (
              <li key={p.t} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                <BrandImage src={p.foto} alt={p.alt} rounded="rounded-none" sizes="(max-width: 640px) 100vw, 25vw" className="aspect-[16/10] w-full" />
                <div className="p-5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-forest text-sm font-bold text-white" aria-hidden>{i + 1}</span>
                  <h3 className="mt-3 font-title text-base font-bold text-ink">{p.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="h-regras" className="container-page section-y">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <BrandImage src="/images/como-funciona/05-qualifique.webp" alt="Sala mobiliada pronta para receber hóspedes" sizes="(max-width: 768px) 100vw, 50vw" className="aspect-[4/3] w-full rounded-3xl" />
          <div>
            <h2 id="h-regras" className="font-title text-3xl font-bold text-ink">Regras claras</h2>
            <ul className="mt-6 space-y-3">
              {REGRAS.map((r) => (
                <li key={r} className="flex gap-3 text-ink">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6"><FaixasTaxaParceria titulo="Taxa de parceria para fotógrafos" /></div>
          </div>
        </div>
      </section>

      <section id="quero-ser-parceiro" aria-labelledby="h-form" className="bg-surface-2 section-y scroll-mt-24">
        <div className="container-page grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <h2 id="h-form" className="font-title text-3xl font-bold text-ink">Quero ser parceiro</h2>
            <p className="mt-3 text-muted">Deixe seu contato e a equipe responde. É grátis; a taxa de parceria só existe quando você aceita um pedido.</p>
            <dl className="mt-8 space-y-5" aria-labelledby="h-duvidas">
              <h3 id="h-duvidas" className="font-title text-lg font-bold text-ink">Dúvidas</h3>
              {DUVIDAS.map((d) => (<div key={d.p}><dt className="font-semibold text-ink">{d.p}</dt><dd className="mt-1 text-sm text-muted">{d.r}</dd></div>))}
            </dl>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-sm md:col-span-3">
            <ParceiroForm tipoInicial={tipo ?? ""} />
          </div>
        </div>
      </section>
    </div>
  );
}
