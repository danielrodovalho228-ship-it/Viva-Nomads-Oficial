import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { trilha } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BannerTopo } from "@/components/institucional/banner-topo";
import { BrandImage } from "@/components/brand-image";
import { ButtonLink } from "@/components/ui/button";
import { SejaParceiroForm } from "@/components/parceiros/seja-parceiro-form";
import { RegrasParceiros } from "@/components/parceiros/regras-parceiros";
import { minhaParceria } from "@/lib/parceiros/solicitacao-actions";
import { categoriaValida } from "@/lib/parceiros/regras";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { FOTOS_PARCERIA } from "@/lib/parceiros-cartoes";

export const metadata: Metadata = {
  alternates: { canonical: "/parceiros" },
  title: "Seja parceiro: fotógrafos e gestores",
  description: "Fotógrafos, mudança, limpeza, montagem e manutenção para imóveis mobiliados: peça a sua parceria e tenha uma página na Viva Nomads.",
};

const CARDS = [
  { id: "fotografos", titulo: "Fotógrafos", selo: "Aberto", texto: "Página com portfólio, galeria, serviços e prazos. A conversa é pelas mensagens da Viva.",
    links: [{ href: "/parceiros?categoria=fotografia#quero-ser-parceiro", rotulo: "Sou fotógrafo" }, { href: "/parceiros/fotografos", rotulo: "Procuro fotógrafo" }] },
  { id: "empresas", titulo: "Empresas", selo: "Aberto", texto: "Empresas que hospedam equipes em imóveis mobiliados.", links: [{ href: "/empresas", rotulo: "Conhecer" }] },
  { id: "gestores", titulo: "Gestores e administradoras", selo: "Aberto", texto: "Taxa menor por volume e Plano Gestor para quem tem 31 ou mais imóveis.",
    links: [{ href: "/precos", rotulo: "Ver o Plano Gestor" }] },
  { id: "servicos", titulo: "Limpeza e manutenção", selo: "Aberto", texto: "Limpeza, lavanderia, reparos e manutenção para imóveis mobiliados. Página própria com serviços e cidades.",
    links: [{ href: "/parceiros?categoria=limpeza#quero-ser-parceiro", rotulo: "Quero atender" }, { href: "/parceiros/buscar?categoria=limpeza", rotulo: "Procurar" }] },
  { id: "mobilia", titulo: "Montagem e mudança", selo: "Aberto", texto: "Montagem de móveis e mudança para quem anuncia ou vem morar. Página própria com serviços e cidades.",
    links: [{ href: "/parceiros?categoria=mudanca#quero-ser-parceiro", rotulo: "Quero atender" }, { href: "/parceiros/buscar?categoria=mudanca", rotulo: "Procurar" }] },
  // Correção 62-B3: a entrada do avaliador credenciado (a categoria fica fora do formulário comum e do catálogo).
  { id: "avaliadores", titulo: "É avaliador de imóveis?", selo: "Aberto", texto: "Avaliação do imóvel pelo checklist da Viva, designada por rodízio. Peça o credenciamento numa página própria.",
    links: [{ href: "/parceiros/avaliadores", rotulo: "Ser avaliador credenciado" }] },
  { id: "seguros", titulo: "Seguros", selo: "Em breve", texto: "Seguros para imóveis mobiliados. Em breve: peça a parceria como \"Outro serviço\" e avisamos quando abrir.",
    links: [{ href: "/parceiros?categoria=outro#quero-ser-parceiro", rotulo: "Pedir parceria" }] },
];

const PASSOS = [
  { t: "Peça a parceria", d: "Com a sua conta: conte o que você faz e onde atende. Leva poucos minutos.", foto: "/images/unicas/parceiros-passo-cadastro.webp", alt: "Pessoa preenchendo o cadastro no notebook" },
  { t: "A Viva confere", d: "Identidade, CPF ou CNPJ e portfólio. A resposta chega por e-mail, com o link para ativar a sua página.", foto: "/images/unicas/parceiros-passo-confere.webp", alt: "Conferência de documentos no computador" },
  { t: "Receba pedidos", d: "Quem anuncia ou busca imóveis mobiliados chama você; a conversa é pela plataforma.", foto: "/images/unicas/parceiros-passo-pedidos.webp", alt: "Conversa pelo celular" },
  { t: "Entregue e seja avaliado", d: "Depois da entrega, o cliente avalia — boas avaliações trazem mais pedidos.", foto: "/images/unicas/parceiros-passo-avaliado.webp", alt: "Quarto arrumado e limpo depois do serviço" },
];


const DUVIDAS = [
  { p: "Preciso de CNPJ?", r: "Não: pessoa física (CPF) ou empresa e MEI (CNPJ). A equipe confere o documento antes de aprovar." },
  { p: "Quanto custa?", r: "O pedido e a página são grátis, sem mensalidade e sem exclusividade. Você só paga a taxa de serviço quando há serviço contratado." },
  { p: "Em quais cidades?", r: "Começando por Uberlândia (MG). Cadastre-se de qualquer cidade e avisamos quando chegarmos aí." },
];

export default async function ParceirosPage({ searchParams }: { searchParams: Promise<{ categoria?: string; origem?: string }> }) {
  const sp = await searchParams;
  const estado = await minhaParceria();
  const categoria = sp.categoria && categoriaValida(sp.categoria) ? sp.categoria : undefined;
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
        <ButtonLink href="#quero-ser-parceiro" variant="inverse" size="lg" data-testid="seja-parceiro-topo">
          Seja parceiro <ArrowRight className="h-4 w-4" />
        </ButtonLink>
        <ButtonLink href="#tipos" variant="inverseSecondary" size="lg">
          Ver tipos de parceria
        </ButtonLink>
      </BannerTopo>

      {/* Números rápidos. */}
      <section className="container-page relative z-10 -mt-12">
        <dl className="grid gap-4 rounded-xl border border-line bg-white p-6 sm:grid-cols-2 lg:grid-cols-4" data-testid="parceiros-numeros">
          <div><dt className="font-title text-2xl font-semibold text-ink">Uberlândia (MG)</dt><dd className="text-sm text-muted">Começamos por aqui; cadastre-se de qualquer cidade</dd></div>
          <div><dt className="font-title text-2xl font-semibold text-ink">30–180 dias</dt><dd className="text-sm text-muted">de estadia em imóveis mobiliados</dd></div>
          <div><dt className="font-title text-2xl font-semibold text-ink">R$ 0</dt><dd className="text-sm text-muted">para se cadastrar, sem mensalidade</dd></div>
          <div><dt className="font-title text-2xl font-semibold text-ink">Contato só pela plataforma</dt><dd className="text-sm text-muted">identidade revelada após o aceite</dd></div>
        </dl>
      </section>

      <section id="tipos" aria-labelledby="h-tipos" className="container-page section-y scroll-mt-24">
        <h2 id="h-tipos" className="text-center font-title text-2xl font-semibold text-ink">Tipos de parceria</h2>
        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6" data-testid="parceiros-tipos">
          {CARDS.map((c) => {
            const f = FOTOS_PARCERIA.find((x) => x.id === c.id)!;
            return (
              <li key={c.id} className={`flex flex-col overflow-hidden rounded-xl border border-line bg-white  ${f.classeGrade}`}>
                {f.fotoPronta ? (
                  <BrandImage src={f.foto} alt={f.alt} rounded="rounded-none" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="aspect-[16/9] w-full" />
                ) : (
                  <div className="aspect-[16/9] w-full bg-sage-100" data-testid="parceiros-foto-pendente" aria-hidden />
                )}
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 font-title text-lg font-semibold text-ink">{c.titulo}</h3>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${c.selo === "Aberto" ? "bg-sage-100 text-forest" : "bg-night/10 text-ink"}`}>{c.selo}</span>
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
          <h2 id="h-como" className="text-center font-title text-2xl font-semibold text-ink">Como funciona</h2>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map((p, i) => (
              <li key={p.t} className="overflow-hidden rounded-xl border border-line bg-white ">
                <BrandImage src={p.foto} alt={p.alt} rounded="rounded-none" sizes="(max-width: 640px) 100vw, 25vw" className="aspect-[16/10] w-full" />
                <div className="p-4">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-forest text-sm font-semibold text-white" aria-hidden>{i + 1}</span>
                  <h3 className="mt-3 font-title text-base font-semibold text-ink">{p.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="h-regras" className="container-page section-y">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <BrandImage src="/images/como-funciona/05-qualifique.webp" alt="Sala mobiliada pronta para receber moradores" sizes="(max-width: 768px) 100vw, 50vw" className="aspect-[4/3] w-full rounded-xl" />
          <div>
            <h2 id="h-regras" className="font-title text-2xl font-semibold text-ink">Regras claras</h2>
            <div className="mt-6">
              <RegrasParceiros pagamentoAtivo={PAGAMENTO_PARCEIROS_ATIVO} extra="Sem exclusividade e sem mensalidade. Combinar por fora antes do aceite leva ao descadastro." />
            </div>
          </div>
        </div>
      </section>

      <section id="quero-ser-parceiro" aria-labelledby="h-form" className="bg-surface-2 section-y scroll-mt-24">
        <div className="container-page grid gap-8 md:grid-cols-5">
          <div className="md:col-span-2">
            <h2 id="h-form" className="font-title text-2xl font-semibold text-ink">Seja parceiro</h2>
            <p className="mt-3 text-muted">Peça a parceria com a sua conta. A Viva analisa e responde por e-mail; aprovada, você ativa a sua página.</p>
            <h3 id="h-duvidas" className="mt-8 font-title text-lg font-semibold text-ink">Dúvidas</h3>
            <dl className="mt-4 space-y-4" aria-labelledby="h-duvidas">
              {DUVIDAS.map((d) => (<div key={d.p}><dt className="font-semibold text-ink">{d.p}</dt><dd className="mt-1 text-sm text-muted">{d.r}</dd></div>))}
            </dl>
          </div>
          <div className="rounded-xl border border-line bg-white p-6 md:col-span-3">
            <SejaParceiroForm estado={estado} origem={sp.origem === "conta" ? "conta" : "site"} categoriaInicial={categoria} />
          </div>
        </div>
      </section>
    </div>
  );
}
