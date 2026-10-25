"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, Check, Clock, Handshake, Languages, MapPin, MessageSquare, Star, UserRound, Wrench } from "lucide-react";
import { rotuloTaxaManutencao } from "@/lib/conforto/exibicao";
import type { Property } from "@/lib/types";
import type { PerfilProprietario } from "@/lib/data/perfil-proprietario";
import { iniciais, corAvatar } from "@/lib/avatar";
import { isExemplo } from "@/lib/demo-listing";
import { desdeLabel } from "@/lib/perfil/perfil-publico";
import {
  AVISO_EXEMPLO,
  avaliacoesDoProprietarioExemplo,
  proprietarioDoExemplo,
  respostaExemploLabel,
  tempoNaVivaLabel,
} from "@/config/exemplo-proprietarios";
import { donoVerificado } from "@/lib/anuncio/dono-verificado";
import { SeloDonoVerificado } from "@/components/property/selo-dono-verificado";
import { SeloExemplo } from "@/components/property/selo-exemplo";
import { buttonClasses } from "@/components/ui/button";
import { hojeBR, numBR } from "@/lib/utils";
import { SeloLinkedin } from "@/components/confianca/selo-linkedin";
import { ehSeloLinkedin } from "@/lib/linkedin/textos";
import { SeloVinculo } from "@/components/confianca/selo-vinculo";
import { dominioDoSelo, ehSeloVinculo } from "@/lib/vinculo/textos";

function AvatarDono({ nome, foto }: { nome: string; foto: string | null | undefined }) {
  return foto ? (
    <Image src={foto} alt={`Foto de ${nome}`} width={72} height={72} className="h-18 w-18 shrink-0 rounded-full object-cover" />
  ) : (
    <div
      className="grid h-18 w-18 shrink-0 place-items-center rounded-full font-title text-2xl font-semibold text-white"
      style={{ backgroundColor: corAvatar(nome) }}
      aria-hidden
    >
      {iniciais(nome)}
    </div>
  );
}

interface Dados {
  nome: string;
  foto: string | null;
  cidade: string | null;
  selos: string[];
  reputacao: { media: number; n: number; href: string } | null;
  tempoNaViva: string | null;
  fatos: { icone: typeof Clock; texto: string; testid?: string }[];
  bio: string | null;
  perfilHref: string | null;
}

/**
 * "Sobre o proprietário" (prompt 6 + layout do prompt 9): à esquerda o cartão (iniciais/foto, nome, cidade,
 * selos com ✓); à direita tempo na Viva, fatos, frase e os botões. Nunca telefone nem e-mail: o contato é
 * "Enviar mensagem" (chat da Viva). Anúncio de EXEMPLO: dados ilustrativos, sempre com o selo "Exemplo
 * ilustrativo" e o aviso; "Enviar mensagem" só abre o aviso de demonstração (nenhuma conversa é criada).
 */
export function OwnerCard({
  property,
  proprietario,
  onMensagem,
  taxaManutencao = null,
}: {
  property: Property;
  proprietario?: PerfilProprietario | null;
  onMensagem?: () => void;
  /** Prompt 59-A: taxa de solução de manutenção no prazo (12 meses); só existe com 3 ou mais chamados resolvidos. */
  taxaManutencao?: { taxa: number; resolvidos: number } | null;
}) {
  const exemplo = isExemplo(property);
  const [avisoDemo, setAvisoDemo] = useState(false);
  const hoje = hojeBR();

  let d: Dados | null = null;
  if (exemplo) {
    const p = proprietarioDoExemplo(property.id);
    if (p) {
      const todas = avaliacoesDoProprietarioExemplo(p);
      const media = todas.reduce((s, a) => s + a.nota, 0) / (todas.length || 1);
      d = {
        nome: p.nome,
        foto: null,
        cidade: p.cidade,
        selos: p.selos,
        reputacao: todas.length ? { media, n: todas.length, href: `/proprietario/${p.id}#avaliacoes` } : null,
        tempoNaViva: tempoNaVivaLabel(p.desde, hoje),
        fatos: [
          { icone: Building2, texto: `${p.imoveis.length} imóveis na Viva` },
          { icone: UserRound, texto: `${p.estadiasConcluidas} estadias concluídas` },
          { icone: Clock, texto: respostaExemploLabel(p.respostaHoras), testid: "proprietario-resposta" },
          { icone: Languages, texto: `Fala ${p.idiomas.join(", ")}` },
        ],
        bio: p.bio,
        perfilHref: `/proprietario/${p.id}`,
      };
    }
  } else {
    const owner = property.owner;
    const nome = proprietario?.nome ?? owner?.name ?? property.ownerName;
    if (nome) {
      const desde = proprietario?.desde ?? owner?.memberSince ?? null;
      const fatos: Dados["fatos"] = [];
      const desdeTxt = desdeLabel(desde);
      if (desdeTxt) fatos.push({ icone: Handshake, texto: desdeTxt });
      if (proprietario) {
        fatos.push({ icone: Building2, texto: `${proprietario.imoveisAtivos} ${proprietario.imoveisAtivos === 1 ? "imóvel" : "imóveis"} na Viva` });
        fatos.push({ icone: UserRound, texto: `${proprietario.estadiasConcluidas} ${proprietario.estadiasConcluidas === 1 ? "estadia concluída" : "estadias concluídas"}` });
        fatos.push(
          proprietario.resposta
            ? { icone: Clock, texto: `Responde ${proprietario.resposta.taxa}% das conversas, ${proprietario.resposta.tempo}`, testid: "proprietario-resposta" }
            : { icone: Clock, texto: "Novo na Viva", testid: "proprietario-resposta" },
        );
        if (proprietario.idiomas.length > 0) fatos.push({ icone: Languages, texto: `Fala ${proprietario.idiomas.join(", ")}` });
        const taxa = rotuloTaxaManutencao(taxaManutencao);
        if (taxa) fatos.push({ icone: Wrench, texto: taxa, testid: "proprietario-manutencao-prazo" });
      }
      d = {
        nome,
        foto: proprietario ? proprietario.fotoUrl : (owner?.avatarUrl ?? null),
        cidade: proprietario?.cidade ?? null,
        selos: proprietario?.selos ?? [],
        reputacao:
          proprietario && proprietario.reputacao.n > 0
            ? { media: proprietario.reputacao.media, n: proprietario.reputacao.n, href: `/proprietario/${proprietario.id}#avaliacoes` }
            : null,
        tempoNaViva: desde ? tempoNaVivaLabel(desde.slice(0, 7), hoje) : null,
        fatos,
        bio: proprietario?.bio ?? null,
        perfilHref: proprietario ? `/proprietario/${proprietario.id}` : null,
      };
    }
  }
  if (!d) return null;

  const podeMensagem = exemplo || !!onMensagem;

  return (
    <section aria-labelledby="proprietario-title" data-testid="sobre-proprietario">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="proprietario-title" className="font-title text-2xl font-semibold text-ink">
          Sobre o proprietário
        </h2>
        {exemplo && <SeloExemplo />}
      </div>
      {exemplo && (
        <p className="mt-2 text-sm text-muted" data-testid="proprietario-exemplo">
          {AVISO_EXEMPLO}
        </p>
      )}

      <div className="mt-4 grid gap-4 rounded-xl border border-sage-200 p-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Esquerda: o cartão. */}
        <div className="flex flex-col items-center rounded-xl bg-surface-2 p-4 text-center">
          <AvatarDono nome={d.nome} foto={d.foto} />
          <p className="mt-3 font-title text-lg font-semibold text-ink" data-testid="proprietario-nome">
            {d.nome}
          </p>
          {d.cidade && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted">
              <MapPin className="h-4 w-4" aria-hidden /> {d.cidade}
            </p>
          )}
          {d.reputacao && (
            <Link
              href={d.reputacao.href}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-forest"
              data-testid="proprietario-reputacao"
            >
              <Star className="h-4 w-4 fill-champagne text-champagne" aria-hidden />
              {numBR(d.reputacao.media, 1)} · {d.reputacao.n} {d.reputacao.n === 1 ? "avaliação" : "avaliações"}
            </Link>
          )}
          {/* Selos só com verificação REAL registrada; no exemplo, ilustrativos e marcados. */}
          <ul className="mt-3 grid gap-1 text-left text-sm text-ink" data-testid="proprietario-selos">
            {!exemplo && donoVerificado(property) && (
              <li>
                <SeloDonoVerificado />
              </li>
            )}
            {d.selos.map((s) =>
              ehSeloLinkedin(s) ? (
                <li key={s}>
                  <SeloLinkedin />
                </li>
              ) : ehSeloVinculo(s) ? (
                <li key={s}>
                  <SeloVinculo dominio={dominioDoSelo(s)} />
                </li>
              ) : (
                <li key={s} className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-forest" aria-hidden />
                  {s}
                </li>
              ),
            )}
          </ul>
        </div>

        {/* Direita: tempo na Viva, fatos, frase e botões. */}
        <div className="min-w-0">
          {d.tempoNaViva && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Tempo na Viva</p>
              <p className="font-title text-lg font-semibold text-ink" data-testid="proprietario-tempo">
                {d.tempoNaViva.replace(/^Na Viva há /, "")}
              </p>
            </div>
          )}
          {d.fatos.length > 0 && (
            <ul className="mt-3 grid gap-2 text-sm text-ink">
              {d.fatos.map((f) => (
                <li key={f.texto} className="flex items-start gap-2" data-testid={f.testid}>
                  <f.icone className="mt-1 h-4 w-4 shrink-0 text-sage" aria-hidden /> {f.texto}
                </li>
              ))}
            </ul>
          )}
          {d.bio && <p className="mt-4 text-sm leading-relaxed text-muted">{d.bio}</p>}

          {(d.perfilHref || podeMensagem) && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {d.perfilHref && (
                <Link href={d.perfilHref} className={buttonClasses({ variant: "secondary", size: "md", className: "w-full" })}>
                  Ver perfil completo
                </Link>
              )}
              {podeMensagem && (
                <button
                  type="button"
                  onClick={exemplo ? () => setAvisoDemo(true) : onMensagem}
                  className={buttonClasses({ variant: "secondary", size: "md", className: "w-full" })}
                >
                  <MessageSquare className="h-4 w-4" aria-hidden /> Enviar mensagem
                </button>
              )}
            </div>
          )}
          {avisoDemo && (
            <p role="status" data-testid="mensagem-demo" className="mt-3 rounded-xl bg-sage-50 p-3 text-sm text-ink">
              Este é um anúncio de demonstração: nenhuma mensagem é enviada. Nos anúncios reais, a conversa acontece
              pelo chat da Viva, com o contato protegido até o aceite.
            </p>
          )}
        </div>
      </div>

      {/* Transparência do operador (sublocação autorizada) */}
      {property.ownershipType !== "own" && property.subleaseAuthorized && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-sage-100 px-3 py-2 text-xs font-medium text-forest">
          <Handshake className="h-3.5 w-3.5" />
          {property.ownershipType === "managed"
            ? "Administrado por gestor em nome do proprietário"
            : "Operado por gestor profissional, com sublocação autorizada pelo proprietário"}
        </p>
      )}
    </section>
  );
}
