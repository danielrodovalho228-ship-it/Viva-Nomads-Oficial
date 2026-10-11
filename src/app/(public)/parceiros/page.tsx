import type { Metadata } from "next";
import Link from "next/link";
import { ParceiroForm } from "./parceiro-form";

export const metadata: Metadata = {
  alternates: { canonical: "/parceiros" },
  title: "Seja parceiro da Viva Nomads",
  description: "Fotógrafos, empresas, gestores e prestadores de serviços para imóveis mobiliados: cadastre seu interesse e seja parceiro da Viva Nomads.",
};

const CARDS = [
  { id: "fotografos", titulo: "Fotógrafos", selo: "Aberto", texto: "Perfil com portfólio, pacote e prazo. O contato do dono é liberado no aceite e há avaliação após a entrega.",
    links: [{ href: "/parceiros?tipo=fotografo#quero-ser-parceiro", rotulo: "Sou fotógrafo" }, { href: "/parceiros/fotografos", rotulo: "Procuro fotógrafo" }] },
  { id: "empresas", titulo: "Empresas", selo: "Aberto", texto: "Empresas que hospedam equipes em imóveis mobiliados.", links: [{ href: "/empresas", rotulo: "Conhecer" }] },
  { id: "gestores", titulo: "Gestores e administradoras", selo: "Aberto", texto: "Taxa menor por volume (12/10/8/6%) e Plano Gestor para quem tem 31 ou mais imóveis.",
    links: [{ href: "/precos", rotulo: "Ver o Plano Gestor" }] },
  { id: "servicos", titulo: "Serviços para o imóvel", selo: "Em breve", texto: "Limpeza, manutenção, mobília, enxoval, internet e mudança. Em breve: deixe seu contato.",
    links: [{ href: "/parceiros?tipo=servicos#quero-ser-parceiro", rotulo: "Deixar contato" }] },
  { id: "seguros", titulo: "Seguros e garantias", selo: "Em breve", texto: "Seguros e garantias para imóveis mobiliados. Em breve: deixe seu contato.",
    links: [{ href: "/parceiros?tipo=seguros#quero-ser-parceiro", rotulo: "Deixar contato" }] },
];

const PASSOS = ["Cadastre-se", "A Viva confere (CNPJ ou MEI, portfólio, reputação)", "Receba pedidos (contato liberado no aceite)", "Entregue e seja avaliado"];

const REGRAS = [
  "O pagamento do serviço é entre parceiro e cliente: a Viva não recebe esse dinheiro.",
  "Taxa de parceria só quando você aceita um pedido, com o valor mostrado antes.",
  "Sem exclusividade e sem mensalidade.",
  "Contato fora da plataforma antes do aceite leva ao descadastro.",
];

const DUVIDAS = [
  { p: "Preciso de CNPJ?", r: "Para aparecer no site, CNPJ ou MEI. Você pode se cadastrar antes." },
  { p: "Quanto custa?", r: "É grátis. A taxa de parceria só existe quando você aceita um pedido." },
  { p: "Em quais cidades?", r: "Em todo o Brasil: a busca funciona por CEP ou cidade em qualquer região." },
];

export default async function ParceirosPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  return (
    <div>
      <section className="bg-night text-white">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Seja parceiro da Viva Nomads</h1>
          <p className="mt-3 text-white/80">Atenda quem anuncia e quem busca imóveis mobiliados, com contato liberado só depois do aceite.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#quero-ser-parceiro" className="rounded-xl bg-white px-5 py-3 font-semibold text-night focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Quero ser parceiro</a>
            <a href="#tipos" className="rounded-xl border border-white/40 px-5 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Ver tipos de parceria</a>
          </div>
          <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div><dt className="text-sm text-white/70">Brasil</dt><dd className="text-sm">Busca por CEP ou cidade em qualquer região</dd></div>
            <div><dt className="text-sm text-white/70">30–180 dias</dt><dd className="text-sm">de estadia</dd></div>
            <div><dt className="text-sm text-white/70">2027</dt><dd className="text-sm">lançamento oficial</dd></div>
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-12 px-4 py-10 sm:px-6">
        <section id="tipos" aria-labelledby="h-tipos">
          <h2 id="h-tipos" className="font-display text-2xl font-bold text-ink">Tipos de parceria</h2>
          <ul className="mt-4 space-y-4">
            {CARDS.map((c) => (
              <li key={c.id} className="rounded-xl border border-sage-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-ink">{c.titulo}</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.selo === "Aberto" ? "bg-sage-100 text-forest" : "bg-night/10 text-ink"}`}>{c.selo}</span>
                </div>
                <p className="mt-2 text-sm text-ink/75">{c.texto}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
                  {c.links.map((l) => <Link key={l.href} href={l.href} className="underline underline-offset-2">{l.rotulo}</Link>)}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="h-como">
          <h2 id="h-como" className="font-display text-2xl font-bold text-ink">Como funciona</h2>
          <ol className="mt-4 space-y-2">
            {PASSOS.map((p, i) => (
              <li key={p} className="flex gap-3 text-ink"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-night text-sm font-bold text-white" aria-hidden>{i + 1}</span><span className="pt-0.5">{p}</span></li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="h-regras">
          <h2 id="h-regras" className="font-display text-2xl font-bold text-ink">Regras claras</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-ink/80">{REGRAS.map((r) => <li key={r}>{r}</li>)}</ul>
        </section>

        <section id="quero-ser-parceiro" aria-labelledby="h-form" className="scroll-mt-24">
          <h2 id="h-form" className="font-display text-2xl font-bold text-ink">Quero ser parceiro</h2>
          <p className="mb-4 mt-2 text-ink/70">Deixe seu contato e a equipe responde.</p>
          <ParceiroForm tipoInicial={tipo ?? ""} />
        </section>

        <section aria-labelledby="h-duvidas">
          <h2 id="h-duvidas" className="font-display text-2xl font-bold text-ink">Dúvidas</h2>
          <dl className="mt-4 space-y-4">
            {DUVIDAS.map((d) => (<div key={d.p}><dt className="font-semibold text-ink">{d.p}</dt><dd className="mt-1 text-ink/75">{d.r}</dd></div>))}
          </dl>
        </section>

        <p className="text-xs text-ink/60">Plataforma em fase de testes. Lançamento oficial em 2027.</p>
      </div>
    </div>
  );
}
