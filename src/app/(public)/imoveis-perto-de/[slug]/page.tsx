import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Megaphone } from "lucide-react";
import { listProperties } from "@/lib/data/properties";
import { resolverDestino, temposAte } from "@/lib/data/tempos";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExemplo, ehAnuncioDeTeste } from "@/lib/demo-listing";
import { chaveCidade } from "@/lib/cidades";
import { PropertyCard } from "@/components/property-card";
import { PropertyMap } from "@/components/property-map-lazy";
import { buttonClasses } from "@/components/ui/button";

export const revalidate = 300;

interface Params {
  params: Promise<{ slug: string }>;
}

/** "perto do HC-UFU", "perto da UFU — Campus Umuarama". */
const pertoDe = (nome: string, artigo: string) => `perto ${artigo === "o" ? "do" : artigo === "a" ? "da" : "de"} ${nome}`;

async function dadosDaPagina(slug: string) {
  const admin = createAdminClient();
  if (!admin || !/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  const { data: d } = await admin.from("destinos").select("nome, artigo, cidade, uf").eq("slug", slug).eq("ativo", true).maybeSingle();
  const destino = d ? await resolverDestino({ destino: slug }, admin) : null;
  if (!d || !destino) return null;
  const daCidade = (await listProperties()).filter(
    (p) => chaveCidade(p.city ?? "") === chaveCidade(d.cidade as string) && !isExemplo(p.id) && !ehAnuncioDeTeste(p.title),
  );
  const { itens } = await temposAte(destino, "carro", { ids: daCidade.map((p) => p.id) }, admin);
  const tempo = new Map(itens.map((i) => [i.id, i]));
  const imoveis = [...daCidade].sort((a, b) => (tempo.get(a.id)?.min ?? 999) - (tempo.get(b.id)?.min ?? 999));
  return { d: d as { nome: string; artigo: string; cidade: string; uf: string }, imoveis, tempo };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const dados = await dadosDaPagina(slug);
  if (!dados) return { robots: { index: false } };
  const title = `Imóveis mobiliados ${pertoDe(dados.d.nome, dados.d.artigo)}`;
  const description = `Imóveis mobiliados para locação mensal ${pertoDe(dados.d.nome, dados.d.artigo)}, em ${dados.d.cidade}, em ordem de tempo até lá.`;
  const url = `/imoveis-perto-de/${slug}`;
  // Sem imóvel, a página existe (com o "Avise-me") mas fica fora do índice até ter o primeiro.
  return dados.imoveis.length > 0
    ? { title, description, robots: { index: true, follow: true }, alternates: { canonical: url }, openGraph: { title, description, locale: "pt_BR", url } }
    : { title, description, robots: { index: false, follow: true } };
}

export default async function PertoDePage({ params }: Params) {
  const { slug } = await params;
  const dados = await dadosDaPagina(slug);
  if (!dados) notFound();
  const { d, imoveis, tempo } = dados;
  const perto = pertoDe(d.nome, d.artigo);
  const pedido = `/pedidos/novo?cidade=${encodeURIComponent(d.cidade)}&destino=${slug}`;

  return (
    <>
      <section className="bg-forest section-y text-white">
        <div className="container-page">
          <nav className="text-sm text-white/60">
            <Link href="/" className="hover:text-champagne">Início</Link> / <span className="text-white/80">{d.nome}</span>
          </nav>
          <h1 className="mt-4 max-w-3xl font-title text-3xl font-bold md:text-5xl">Imóveis mobiliados {perto}</h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">
            Em ordem de tempo de carro até {d.artigo ? `${d.artigo} ` : ""}{d.nome}, em {d.cidade}. Locação de 30 a 180 dias.
          </p>
        </div>
      </section>

      <section className="container-page section-y">
        {imoveis.length > 0 ? (
          <>
            <h2 className="font-title text-2xl font-bold text-ink">
              {imoveis.length} {imoveis.length === 1 ? "imóvel" : "imóveis"} {perto}
            </h2>
            <div className="mt-6 overflow-hidden rounded-2xl" data-testid="perto-de-mapa">
              <PropertyMap
                className="aspect-[16/9] w-full"
                center={{ lat: imoveis[0].lat, lng: imoveis[0].lng }}
                markers={imoveis.map((i) => ({ id: i.id, lat: i.lat, lng: i.lng, kind: "property" as const }))}
                approximate
              />
            </div>
            <p className="mt-2 text-xs text-muted">Áreas aproximadas: o endereço exato é liberado após o aceite da candidatura.</p>
            <div className="mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" data-testid="perto-de-anuncios">
              {imoveis.map((i) => (
                <div key={i.id} className="flex h-full flex-col" data-testid="perto-de-cartao">
                  <div className="min-h-0 flex-1">
                    <PropertyCard property={i} />
                  </div>
                  {tempo.get(i.id) && <p className="mt-2 text-sm font-medium text-ink" data-testid="tempo-cartao">{tempo.get(i.id)!.texto}</p>}
                </div>
              ))}
            </div>
            <p className="mt-10 text-sm">
              <Link href={`/buscar?destino=${slug}&modo=carro`} className="font-semibold text-forest underline">
                Filtrar por tempo, valor e datas na busca
              </Link>
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-sage-200 p-8 text-center" data-testid="perto-de-vazio">
            <p className="font-title text-lg font-semibold text-ink">Ainda não há imóvel publicado {perto}.</p>
            <p className="mt-2 text-sm text-muted">
              Publique um pedido de moradia: os proprietários de {d.cidade} veem o que você precisa e falam com você pela plataforma.
            </p>
            <Link href={pedido} className={buttonClasses({ className: "mt-5" })} data-testid="perto-de-avise-me">
              <Megaphone className="h-4 w-4" aria-hidden /> Avise-me quando surgir um imóvel {perto}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
