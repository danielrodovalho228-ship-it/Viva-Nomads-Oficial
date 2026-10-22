import { Building2, Check, Clock, Languages, MapPin, Star, UserRound } from "lucide-react";
import { PropertyCard } from "@/components/property-card";
import { SeloExemplo } from "@/components/property/selo-exemplo";
import { corAvatar, iniciais } from "@/lib/avatar";
import { getPropertyById } from "@/lib/properties";
import { hojeBR, numBR } from "@/lib/utils";
import {
  AVISO_EXEMPLO,
  avaliacoesDoProprietarioExemplo,
  respostaExemploLabel,
  tempoNaVivaLabel,
  type ProprietarioExemplo,
} from "@/config/exemplo-proprietarios";
import type { Property } from "@/lib/types";

const MESES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

/** /proprietario/exemplo-N (prompt 9): mesmo layout da página real, com dados ILUSTRATIVOS sempre marcados. */
export function PerfilExemplo({ p }: { p: ProprietarioExemplo }) {
  const imoveis = p.imoveis.map((id) => getPropertyById(id)).filter(Boolean) as Property[];
  const avaliacoes = avaliacoesDoProprietarioExemplo(p);
  const media = avaliacoes.reduce((s, a) => s + a.nota, 0) / (avaliacoes.length || 1);
  const fatos = [
    { icone: MapPin, texto: p.cidade },
    { icone: Clock, texto: tempoNaVivaLabel(p.desde, hojeBR()) },
    { icone: Building2, texto: `${imoveis.length} imóveis na Viva` },
    { icone: UserRound, texto: `${p.estadiasConcluidas} estadias concluídas` },
    { icone: Clock, texto: respostaExemploLabel(p.respostaHoras) },
    { icone: Languages, texto: `Fala ${p.idiomas.join(", ")}` },
  ];

  return (
    <div className="container-page py-8 sm:py-12" data-testid="pagina-proprietario">
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-night/90 px-4 py-3 text-white" data-testid="faixa-exemplo">
        <SeloExemplo className="bg-white/20" />
        <p className="text-sm">{AVISO_EXEMPLO}</p>
      </div>
      <section className="rounded-xl border border-sage-200 bg-white p-5 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            className="grid h-24 w-24 place-items-center rounded-full font-title text-2xl font-semibold text-white sm:h-28 sm:w-28"
            style={{ backgroundColor: corAvatar(p.nome) }}
            aria-hidden
          >
            {iniciais(p.nome)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-sage">Proprietário</p>
            <h1 className="font-title text-[28px] font-semibold text-ink">{p.nome}</h1>
            <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink">
              {p.selos.map((s) => (
                <li key={s} className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-forest" aria-hidden /> {s}
                </li>
              ))}
              {avaliacoes.length > 0 && (
                <li>
                  <a href="#avaliacoes" className="inline-flex items-center gap-1 font-medium hover:text-forest">
                    <Star className="h-4 w-4 fill-champagne text-champagne" aria-hidden />
                    {numBR(media, 1)} · {avaliacoes.length} avaliações
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
        <ul className="mt-6 grid gap-2 text-sm text-ink sm:grid-cols-2">
          {fatos.map((f) => (
            <li key={f.texto} className="flex items-start gap-2">
              <f.icone className="mt-1 h-4 w-4 shrink-0 text-sage" aria-hidden /> {f.texto}
            </li>
          ))}
        </ul>
        <p className="mt-5 max-w-2xl leading-relaxed text-muted">{p.bio}</p>
        <p className="mt-3 text-xs text-muted">Nos anúncios reais, a conversa acontece pelo chat da Viva, a partir de um dos imóveis. Contato direto fica protegido.</p>
      </section>

      <section className="mt-10" aria-labelledby="imoveis-proprietario">
        <h2 id="imoveis-proprietario" className="font-title text-2xl font-semibold text-ink">
          Imóveis de {p.nome}
        </h2>
        <div className="mt-5 grid gap-5 sm:auto-rows-fr sm:grid-cols-2 xl:grid-cols-4">
          {imoveis.map((im) => (
            <PropertyCard key={im.id} property={im} />
          ))}
        </div>
      </section>

      <section id="avaliacoes" className="mt-10 scroll-mt-28" aria-labelledby="avaliacoes-proprietario">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="avaliacoes-proprietario" className="font-title text-2xl font-semibold text-ink">
            Avaliações recebidas
          </h2>
          <SeloExemplo />
        </div>
        <ul className="mt-5 grid gap-4 lg:grid-cols-2">
          {avaliacoes.map((a) => (
            <li key={`${a.imovelId}-${a.autor}`} className="rounded-xl border border-sage-200 bg-white p-5" data-testid="avaliacao-exemplo">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: corAvatar(a.autor) }}
                >
                  {iniciais(a.autor)}
                </span>
                <div>
                  <p className="font-medium text-ink">{a.autor}</p>
                  <p className="text-xs text-muted">
                    {a.titulo} · {MESES[Number(a.mes.slice(5, 7)) - 1]} {a.mes.slice(0, 4)}
                  </p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-ink">
                  <Star className="h-4 w-4 fill-champagne text-champagne" aria-hidden /> {numBR(a.nota, 1)}
                </span>
              </div>
              <p className="mt-3 text-sm text-ink">{a.texto}</p>
              {a.resposta && (
                <p className="mt-3 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
                  <strong className="text-ink">Resposta de {p.nome}:</strong> {a.resposta}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
