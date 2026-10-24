"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SeusPapeis } from "@/components/account/seus-papeis";
import { getMinhaIntencao, salvarMinhaIntencao } from "@/lib/data/intencao-actions";
import { getMeuPerfilPublico } from "@/lib/data/perfil-actions";
import type { Intencao } from "@/lib/auth/entrada";
import { PHOTOS } from "@/lib/media";
import { useParceiroAprovado } from "@/lib/use-papel-barra";
import { cn } from "@/lib/utils";
import { SOMBRA_CARTAO_CONTA } from "@/lib/conta/visual-mockup";
import {
  BOTAO_PARCEIRO_ATIVO,
  BOTAO_QUERO_PARCEIRO,
  RODAPE_PAPEIS,
  TEXTO_QUERO_PARCEIRO,
  alternarIntencao,
  linhaQueroMorar,
  resumoQueroMorar,
  textoQueroAnunciar,
} from "@/lib/conta/tela-papeis";

/**
 * A3 — Conta › Papéis e intenção (mockup perfil-03-papeis-com-fotos, 24/10): três cartões num padrão só — foto do
 * acervo à esquerda, do mesmo tamanho nos três, título e subtítulo na mesma hierarquia. "Quero morar" (Ativo +
 * interruptor, a linha da busca e o resumo com o pino), "Quero anunciar" ("Começar um anúncio") e "Quero ser parceiro"
 * ("Cadastrar meu serviço", que leva ao mesmo /dashboard/parceiro do convite); as pílulas "Preferências salvas" e
 * "Ajuda com o cadastro". Gravação automática a cada toque (rodapé do desenho). Embaixo, o papel em uso (troca de
 * menu e painel) — requisito já aprovado que o desenho não mostra.
 */
export function TelaPapeis() {
  const [intencao, setIntencao] = useState<Intencao[] | null>(null);
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState<"ok" | "salvando" | "erro" | null>(null);
  const parceiro = useParceiroAprovado();

  useEffect(() => {
    let vivo = true;
    Promise.all([getMinhaIntencao().catch(() => null), getMeuPerfilPublico().catch(() => null)]).then(([i, p]) => {
      if (!vivo) return;
      setIntencao(i ?? []);
      setCidade(p?.cidade ?? "");
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function alternar(alvo: Intencao, ligar: boolean) {
    if (!intencao) return;
    const anterior = intencao;
    const nova = alternarIntencao(anterior, alvo, ligar);
    setIntencao(nova);
    setEstado("salvando");
    const r = await salvarMinhaIntencao(nova, null).catch(() => ({ ok: false }));
    if (!r.ok) {
      setIntencao(anterior);
      setEstado("erro");
      return;
    }
    setEstado("ok");
  }

  if (!intencao)
    return (
      <div className="grid gap-4" aria-busy="true" data-testid="tela-papeis-carregando">
        <span className="block h-40 rounded-xl bg-white" aria-hidden />
        <span className="block h-40 rounded-xl bg-white" aria-hidden />
      </div>
    );

  const morar = intencao.includes("morar");
  const anunciar = intencao.includes("anunciar");

  return (
    <div className="grid gap-4" data-testid="tela-papeis">
      <CartaoPapel id="morar" foto={PHOTOS.papeis.morar} ativo={morar}>
        <div className="flex items-start justify-between gap-3">
          <h2 className={TITULO_CARTAO}>Quero morar</h2>
          <Switch checked={morar} onChange={(v) => void alternar("morar", v)} label="Quero morar" testId="papel-morar-toggle" />
        </div>
        <p className="mt-1 text-base text-ink">{linhaQueroMorar(cidade)}</p>
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink sm:text-base" data-testid="papel-morar-resumo">
          <MapPin className="h-5 w-5 shrink-0 text-forest" aria-hidden /> {resumoQueroMorar(cidade)}
        </p>
      </CartaoPapel>

      <CartaoPapel id="anunciar" foto={PHOTOS.papeis.anunciar} ativo={anunciar}>
        <div className="flex items-start justify-between gap-3">
          <h2 className={TITULO_CARTAO}>Quero anunciar</h2>
          {anunciar && <Switch checked onChange={(v) => void alternar("anunciar", v)} label="Quero anunciar" testId="papel-anunciar-toggle" />}
        </div>
        <p className="mt-1 text-base text-ink">Anuncie seu imóvel mobiliado</p>
        <p className="mt-1 text-sm text-muted">{textoQueroAnunciar(cidade)}</p>
        <ButtonLink href="/dashboard/imoveis/novo" size="lg" className="mt-3 w-full" data-testid="papel-comecar-anuncio">
          Começar um anúncio
        </ButtonLink>
      </CartaoPapel>

      <CartaoPapel id="parceiro" foto={PHOTOS.papeis.parceiro} ativo={parceiro}>
        <h2 className={TITULO_CARTAO}>Quero ser parceiro</h2>
        <p className="mt-1 text-base text-ink">{TEXTO_QUERO_PARCEIRO}</p>
        <ButtonLink href="/dashboard/parceiro" size="lg" className="mt-3 w-full" data-testid="papel-parceiro-botao">
          {parceiro ? BOTAO_PARCEIRO_ATIVO : BOTAO_QUERO_PARCEIRO}
        </ButtonLink>
      </CartaoPapel>

      <div className="flex flex-wrap justify-center gap-3">
        <span
          className="inline-flex min-h-11 items-center gap-1 rounded-full bg-sage-100 px-4 text-sm font-semibold text-forest"
          role="status"
          data-testid="papeis-preferencias"
          data-estado={estado ?? "ok"}
        >
          {estado === "erro" ? "Não foi possível salvar. Tente de novo." : estado === "salvando" ? "Salvando…" : (
            <>
              <Check className="h-4 w-4" aria-hidden /> Preferências salvas
            </>
          )}
        </span>
        <Link href="/ajuda" className="inline-flex min-h-11 items-center rounded-full bg-sage-100 px-4 text-sm font-semibold text-forest" data-testid="papeis-ajuda">
          Ajuda com o cadastro
        </Link>
      </div>
      <p className="text-center text-sm text-muted">{RODAPE_PAPEIS}</p>

      <SeusPapeis dentroDoBloco />
    </div>
  );
}

const TITULO_CARTAO = "font-title text-2xl font-semibold leading-tight text-ink";

/**
 * O cartão de papel: a foto pequena à esquerda (mesma medida nos três; no computador o selo "Ativo" fica sobre a foto,
 * como no desenho; no celular, ao lado do conteúdo) e o conteúdo à direita.
 */
function CartaoPapel({ id, foto, ativo, children }: { id: "morar" | "anunciar" | "parceiro"; foto: string; ativo: boolean; children: ReactNode }) {
  return (
    <section className={cn("flex items-start gap-4 rounded-xl bg-white p-4 sm:gap-6 sm:p-6", SOMBRA_CARTAO_CONTA)} data-testid={`papel-cartao-${id}`} data-ativo={ativo ? "1" : "0"}>
      <span className="relative block aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:aspect-[5/4] sm:w-44" data-testid="papel-foto">
        <Image src={foto} alt="" fill sizes="(min-width: 640px) 176px, 96px" className="object-cover" />
        {ativo && (
          <span className="absolute left-2 top-2 inline-flex items-center rounded-lg bg-forest px-2 py-1 text-xs font-semibold text-white sm:text-sm" data-testid={`papel-${id}-ativo`}>
            Ativo
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
