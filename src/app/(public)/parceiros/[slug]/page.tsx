import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Clock, MapPin, Star } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { trilha } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";
import { SolicitarOrcamento } from "@/components/parceiros/solicitar-orcamento";
import { createClient } from "@/lib/supabase/server";
import { imoveisParaServico } from "@/lib/parceiros/imoveis-servico";
import { RefDaVisita } from "@/components/cartoes/ref-da-visita";
import { parceiroPorSlug } from "@/lib/data/parceiros-publico";
import { destinoDaCategoria } from "@/lib/parceiros/rotas-categoria";
import { REDES, rotuloCategoria, textoPreco } from "@/lib/parceiros/regras";
import { documentoDoServico } from "@/lib/parceiros/fiscal";
import { ProblemaComIsto } from "@/components/ajuda/problema-com-isto";

/*
  Página pública do parceiro (Prompt 31a, item 5): banner, foto, nome, categorias, cidades, descrição, serviços,
  galeria e redes. Só avaliações reais (senão "Novo na Viva"). Nunca telefone, e-mail ou documento. Só aparece
  publicada; conta de teste fica fora do Google (noindex) e da busca pública.
*/

type Params = { params: Promise<{ slug: string }>; searchParams?: Promise<{ imovel?: string; cadastro?: string; categoria?: string; descricao?: string }> };

// Sempre do banco: publicar, pausar ou editar no painel aparece na hora (sem cache da página).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const d = await parceiroPorSlug(slug);
  if (!d) return { title: "Parceiro não encontrado", robots: { index: false } };
  const p = d.parceiro;
  return {
    title: `${p.nomePublico}: ${p.categorias.map(rotuloCategoria).join(", ").toLowerCase()} em ${p.cidades[0] ?? "sua cidade"}`,
    description: (p.descricaoCurta ?? p.descricao ?? `Parceiro da Viva Nomads em ${p.cidades.join(", ")}.`).slice(0, 160),
    alternates: { canonical: `/parceiros/${p.slug}` },
    robots: p.teste ? { index: false, follow: false } : undefined,
  };
}

export default async function ParceiroPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const d = await parceiroPorSlug(slug);
  if (!d) {
    // E187: /parceiros/limpeza, /parceiros/montagem… (sem parceiro com esse endereço) vão à busca já filtrada.
    const destino = destinoDaCategoria(slug);
    if (destino) redirect(destino);
    notFound();
  }
  // Prompt 31b: "Solicitar orçamento" ativo. Vindo do passo de fotos do cadastro, o imóvel já vem escolhido.
  const supabase = await createClient();
  const usuario = supabase ? (await supabase.auth.getUser()).data.user : null;
  const logado = !!usuario;
  // A lista de imóveis da folha "Solicitar orçamento" vem com a página (abrir a folha não chama ação).
  const imoveis = usuario ? await imoveisParaServico(usuario.id) : [];
  const imovelDoCadastro = sp.imovel && /^[0-9a-f-]{36}$/i.test(sp.imovel) ? sp.imovel : null;
  const { parceiro: p, servicos, galeria } = d;
  // Vindo da página da estadia pela busca (Prompt 41): a categoria pedida já vem escolhida na folha.
  const categoriaInicial = sp.categoria && p.categorias.includes(sp.categoria) ? sp.categoria : null;
  const doCadastro = !!imovelDoCadastro && sp.cadastro === "1";
  // Prompt 59: a descrição da ordem de manutenção fora do prazo já vem escrita na folha.
  const descricaoInicial = typeof sp.descricao === "string" ? sp.descricao.trim().slice(0, 500) : "";
  const consulta = new URLSearchParams({
    ...(descricaoInicial ? { descricao: descricaoInicial } : {}),
    ...(imovelDoCadastro ? { imovel: imovelDoCadastro } : {}),
    ...(doCadastro ? { cadastro: "1" } : {}),
    ...(categoriaInicial ? { categoria: categoriaInicial } : {}),
  }).toString();
  const voltarPara = `/parceiros/${slug}${consulta ? `?${consulta}` : ""}`;
  const redes = REDES.filter((r) => p.redes[r.chave]);

  return (
    <div data-testid="pagina-parceiro" data-slug={p.slug}>
      {/* Aberta pelo QR/link do cartão do parceiro: confere a assinatura e conta a visita (POST, sem gravar no render). */}
      <RefDaVisita parceiroId={p.id} />
      <JsonLd dados={trilha(SITE_URL, [{ nome: "Parceiros", caminho: "/parceiros/buscar" }, { nome: p.nomePublico, caminho: `/parceiros/${p.slug}` }])} />
      <div className="relative h-40 w-full overflow-hidden bg-sage-100 sm:h-56 lg:h-72">
        {p.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- imagem do bucket público, já reduzida no envio
          <img src={p.bannerUrl} alt={`Capa de ${p.nomePublico}`} className="h-full w-full object-cover" data-testid="parceiro-banner" />
        )}
      </div>
      <div className="container-page">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end">
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem do bucket público, já reduzida no envio
            <img src={p.avatarUrl} alt={`Foto de ${p.nomePublico}`} width={128} height={128} className="h-24 w-24 rounded-full border-4 border-white bg-white object-cover sm:h-32 sm:w-32" data-testid="parceiro-avatar" />
          ) : (
            <span className="grid h-24 w-24 place-items-center rounded-full border-4 border-white bg-sage-100 font-title text-[28px] font-semibold text-forest sm:h-32 sm:w-32">{p.nomePublico.slice(0, 1)}</span>
          )}
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="font-title text-2xl font-semibold text-ink sm:text-[28px]">{p.nomePublico}</h1>
            <p className="mt-1 text-muted">{p.categorias.map(rotuloCategoria).join(" · ")}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-ink">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden /> {p.cidades.join(", ")}
            </p>
          </div>
          <div className="pb-1" data-testid="parceiro-nota">
            {p.avaliacoesQtd > 0 && p.notaMedia ? (
              <p className="flex items-center gap-1 font-semibold text-ink">
                <Star className="h-5 w-5 text-amber-500" aria-hidden /> {p.notaMedia.toFixed(1)} · {p.avaliacoesQtd} {p.avaliacoesQtd === 1 ? "avaliação" : "avaliações"}
              </p>
            ) : (
              <span className="rounded-full bg-sage-100 px-3 py-1 text-sm font-semibold text-forest">Novo na Viva</span>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-8 pb-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            {p.descricao && (
              <section aria-labelledby="h-sobre">
                <h2 id="h-sobre" className="font-title text-xl font-semibold text-ink">Sobre</h2>
                <p className="mt-2 whitespace-pre-line text-ink">{p.descricao}</p>
              </section>
            )}
            <section aria-labelledby="h-servicos">
              <h2 id="h-servicos" className="font-title text-xl font-semibold text-ink">Serviços</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="parceiro-servicos">
                {servicos.map((s) => (
                  <li key={s.id} className="rounded-xl border border-line bg-white p-4">
                    <p className="text-xs font-semibold text-forest">{rotuloCategoria(s.categoria)}</p>
                    <h3 className="mt-1 font-semibold text-ink">{s.titulo}</h3>
                    {s.descricao && <p className="mt-1 text-sm text-muted">{s.descricao}</p>}
                    <p className="mt-2 text-sm font-semibold text-ink">{textoPreco(s.precoBase, s.unidade)}</p>
                    {s.prazoDias != null && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <Clock className="h-3.5 w-3.5" aria-hidden /> Prazo: {s.prazoDias === 0 ? "no mesmo dia" : `${s.prazoDias} ${s.prazoDias === 1 ? "dia" : "dias"}`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            {galeria.length > 0 && (
              <section aria-labelledby="h-galeria">
                <h2 id="h-galeria" className="font-title text-xl font-semibold text-ink">Galeria</h2>
                <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3" data-testid="parceiro-galeria">
                  {galeria.map((g) => (
                    <li key={g.id} className="min-w-0">
                      <figure>
                        {/* eslint-disable-next-line @next/next/no-img-element -- imagem do bucket público, já reduzida no envio */}
                        <img src={g.url} alt={g.legenda ?? `Trabalho de ${p.nomePublico}`} loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
                        {g.legenda && <figcaption className="mt-1 text-xs text-muted">{g.legenda}</figcaption>}
                      </figure>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <aside className="min-w-0 space-y-4">
            <div className="rounded-xl border border-line bg-white p-4">
              <SolicitarOrcamento
                parceiroId={p.id}
                nomeParceiro={p.nomePublico}
                categorias={p.categorias}
                servicos={servicos.map((s) => ({ id: s.id, titulo: s.titulo, categoria: s.categoria }))}
                logado={logado}
                voltarPara={voltarPara}
                imovelInicial={imovelDoCadastro}
                categoriaInicial={categoriaInicial}
                imoveis={imoveis}
                doCadastroDoImovel={doCadastro}
                descricaoInicial={descricaoInicial}
              />
              <p className="mt-2 text-sm text-muted">O pedido e a conversa ficam nas mensagens da Viva. Contato e endereço só depois do aceite.</p>
            </div>
            {redes.length > 0 && (
              <div className="rounded-xl border border-line bg-white p-4" data-testid="parceiro-redes">
                <h2 className="font-title text-base font-semibold text-ink">Redes</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {redes.map((r) => (
                    <li key={r.chave}>
                      <a href={p.redes[r.chave]!} target="_blank" rel="noopener nofollow noreferrer" className="text-blue-700 underline underline-offset-2">
                        {r.rotulo}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* FISCAL-PARCEIRO-B: quem declarou emitir nota pode ser denunciado por não emitir (Central de Ajuda). */}
            {documentoDoServico(p) === "nota" && (
              <div data-testid="parceiro-problema">
                <ProblemaComIsto tipo="parceiro" id={p.id} />
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
