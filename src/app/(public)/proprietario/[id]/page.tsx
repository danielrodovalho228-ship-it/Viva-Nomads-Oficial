import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Building2, Clock, Handshake, Languages, MapPin, Star, UserRound } from "lucide-react";
import { getAvaliacoesRecebidas, getPerfilProprietario } from "@/lib/data/perfil-proprietario";
import { listPropertiesDoProprietario } from "@/lib/data/properties";
import { desdeLabel, robotsDoProprietario } from "@/lib/perfil/perfil-publico";
import { corAvatar, iniciais } from "@/lib/avatar";
import { PropertyCard } from "@/components/property-card";
import { buttonClasses } from "@/components/ui/button";
import { dataBR } from "@/lib/utils";
import { proprietarioExemploPorId } from "@/config/exemplo-proprietarios";
import { PerfilExemplo } from "./perfil-exemplo";
import { SeloLinkedin } from "@/components/confianca/selo-linkedin";
import { ehSeloLinkedin } from "@/lib/linkedin/textos";
import { ProblemaComIsto } from "@/components/ajuda/problema-com-isto";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  // Proprietário de exemplo (prompt 9): ilustrativo, sempre fora do Google.
  const ex = proprietarioExemploPorId(id);
  if (ex) return { title: `${ex.nome} — exemplo ilustrativo`, robots: { index: false, follow: false } };
  const p = await getPerfilProprietario(id);
  if (!p) return { title: "Página não encontrada", robots: { index: false, follow: false } };
  // Conta o que a página realmente lista (o anúncio de teste não aparece nem conta).
  const visiveis = await listPropertiesDoProprietario(id);
  return {
    title: `${p.nome} — proprietário na Viva Nomads`,
    description: `${p.nome}${p.cidade ? `, ${p.cidade}` : ""}: imóveis mobiliados na Viva Nomads.`,
    // Sem imóvel ativo, a página fica fora do Google.
    robots: robotsDoProprietario(visiveis.length),
  };
}

/** Perfil público de quem anuncia (prompt 6): tudo do cartão + imóveis ativos + avaliações com resposta. */
export default async function ProprietarioPage({ params }: Params) {
  const { id } = await params;
  const ex = proprietarioExemploPorId(id);
  if (ex) return <PerfilExemplo p={ex} />;
  const p = await getPerfilProprietario(id);
  if (!p) notFound();
  const [imoveis, avaliacoes] = await Promise.all([listPropertiesDoProprietario(id), getAvaliacoesRecebidas(id)]);
  const desde = desdeLabel(p.desde);

  const fatos = [
    p.cidade && { icone: MapPin, texto: p.cidade },
    desde && { icone: Handshake, texto: desde },
    { icone: Building2, texto: `${imoveis.length} ${imoveis.length === 1 ? "imóvel" : "imóveis"} na Viva` },
    { icone: UserRound, texto: `${p.estadiasConcluidas} ${p.estadiasConcluidas === 1 ? "estadia concluída" : "estadias concluídas"}` },
    { icone: Clock, texto: p.resposta ? `Responde ${p.resposta.taxa}% das conversas, ${p.resposta.tempo}` : "Novo na Viva" },
    p.idiomas.length > 0 && { icone: Languages, texto: `Fala ${p.idiomas.join(", ")}` },
  ].filter(Boolean) as { icone: typeof Clock; texto: string }[];

  return (
    <div className="container-page py-8 sm:py-12" data-testid="pagina-proprietario">
      <section className="rounded-xl border border-sage-200 bg-white p-4 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {p.fotoUrl ? (
            <Image src={p.fotoUrl} alt={`Foto de ${p.nome}`} width={112} height={112} className="h-24 w-24 rounded-full object-cover sm:h-28 sm:w-28" />
          ) : (
            <div
              className="grid h-24 w-24 place-items-center rounded-full font-title text-2xl font-semibold text-white sm:h-28 sm:w-28"
              style={{ backgroundColor: corAvatar(p.nome) }}
              aria-hidden
            >
              {iniciais(p.nome)}
            </div>
          )}
          {/* FOTO-PERFIL-B: a foto é o rosto do titular; quem vê algo errado denuncia pela Central de Ajuda. */}
          {p.fotoUrl && (
            <div className="sm:order-last sm:ml-auto" data-testid="proprietario-problema-foto">
              <ProblemaComIsto tipo="perfil" id={id} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-sage">Proprietário</p>
            <h1 className="font-title text-[28px] font-semibold text-ink">{p.nome}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {p.selos.map((s) =>
                ehSeloLinkedin(s) ? (
                  <SeloLinkedin key={s} formato="pilula" />
                ) : (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-forest">
                    <BadgeCheck className="h-4 w-4" aria-hidden /> {s}
                  </span>
                ),
              )}
              {p.reputacao.n > 0 && (
                <a href="#avaliacoes" className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-forest">
                  <Star className="h-4 w-4 fill-champagne text-champagne" aria-hidden />
                  {p.reputacao.media.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} · {p.reputacao.n}{" "}
                  {p.reputacao.n === 1 ? "avaliação" : "avaliações"}
                </a>
              )}
            </div>
          </div>
        </div>
        <ul className="mt-6 grid gap-2 text-sm text-ink sm:grid-cols-2">
          {fatos.map((f) => (
            <li key={f.texto} className="flex items-start gap-2">
              <f.icone className="mt-1 h-4 w-4 shrink-0 text-sage" aria-hidden /> {f.texto}
            </li>
          ))}
        </ul>
        {p.bio && <p className="mt-4 max-w-2xl leading-relaxed text-muted">{p.bio}</p>}
        {imoveis[0] && (
          <Link
            href={`/imoveis/${imoveis[0].id}#proprietario`}
            className={buttonClasses({ variant: "primary", size: "md", className: "mt-6 w-full sm:w-auto" })}
          >
            Enviar mensagem
          </Link>
        )}
        <p className="mt-3 text-xs text-muted">A conversa acontece pelo chat da Viva, a partir de um dos imóveis. Contato direto fica protegido.</p>
      </section>

      <section className="mt-12" aria-labelledby="imoveis-proprietario">
        <h2 id="imoveis-proprietario" className="font-title text-2xl font-semibold text-ink">
          Imóveis de {p.nome}
        </h2>
        {imoveis.length === 0 ? (
          <p className="mt-3 text-muted">Nenhum imóvel ativo no momento.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:auto-rows-fr sm:grid-cols-2 xl:grid-cols-4">
            {imoveis.map((im) => (
              <PropertyCard key={im.id} property={im} />
            ))}
          </div>
        )}
      </section>

      <section id="avaliacoes" className="mt-12 scroll-mt-28" aria-labelledby="avaliacoes-proprietario">
        <h2 id="avaliacoes-proprietario" className="font-title text-2xl font-semibold text-ink">
          Avaliações recebidas
        </h2>
        {avaliacoes.length === 0 ? (
          <p className="mt-3 text-muted">Ainda sem avaliações publicadas.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {avaliacoes.map((a) => (
              <li key={a.id} className="rounded-xl border border-sage-200 bg-white p-4">
                <p className="flex items-center gap-1 text-sm font-semibold text-ink">
                  <Star className="h-4 w-4 fill-champagne text-champagne" aria-hidden /> {a.nota.toLocaleString("pt-BR")}
                  {a.data && <span className="ml-2 font-normal text-muted">{dataBR(a.data.slice(0, 10))}</span>}
                </p>
                {a.comentario && <p className="mt-2 text-sm text-ink">{a.comentario}</p>}
                {a.resposta && (
                  <p className="mt-3 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
                    <strong className="text-ink">Resposta de {p.nome}:</strong> {a.resposta}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
