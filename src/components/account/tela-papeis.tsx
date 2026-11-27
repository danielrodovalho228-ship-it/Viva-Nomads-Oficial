"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SeusPapeis } from "@/components/account/seus-papeis";
import { usePapelEmUso } from "@/components/account/use-papel-em-uso";
import { getMinhaIntencao, salvarMinhaIntencao } from "@/lib/data/intencao-actions";
import { getMeuPerfilPublico } from "@/lib/data/perfil-actions";
import type { Intencao } from "@/lib/auth/entrada";
import { PHOTOS } from "@/lib/media";
import { minhaParceria } from "@/lib/parceiros/solicitacao-actions";
import { BOTAO_PARCERIA_APROVADA, HREF_ATIVAR_PARCERIA, TEXTO_PARCERIA_APROVADA, situacaoParceiro, type SituacaoParceiro } from "@/lib/parceiros/situacao-conta";
import { cn } from "@/lib/utils";
import { SOMBRA_CARTAO_CONTA } from "@/lib/conta/visual-mockup";
import {
  BOTAO_PARCEIRO_ATIVO,
  BOTAO_QUERO_PARCEIRO,
  RODAPE_PAPEIS,
  TEXTO_MORAR_EM_USO,
  TEXTO_QUERO_PARCEIRO,
  alternarIntencao,
  estadoQueroMorar,
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
  const [estado, setEstado] = useState<"ok" | "salvando" | "erro" | "erro_leitura" | null>(null);
  // E576: a situação inteira (ativo, aprovada sem página ou nenhum), não só "tem página".
  const [situacao, setSituacao] = useState<SituacaoParceiro>("nenhum");
  const parceiro = situacao === "ativo";
  const emUso = usePapelEmUso();
  const aprovadaSemPagina = situacao === "aprovada_sem_pagina";

  useEffect(() => {
    let vivo = true;
    // Achado 58: falhou a leitura da intenção → os interruptores ficam desabilitados (intencao null) e a tela avisa.
    Promise.all([getMinhaIntencao().catch(() => "falhou" as const), getMeuPerfilPublico().catch(() => null)]).then(([i, p]) => {
      if (!vivo) return;
      if (i === "falhou") setEstado("erro_leitura");
      else setIntencao(i ?? []);
      setCidade(p?.cidade ?? "");
    });
    minhaParceria()
      .then((e) => vivo && setSituacao(situacaoParceiro(e)))
      .catch(() => {});
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

  // E537: o interruptor reflete o papel de verdade (intenção "morar" OU morador em uso), não só a intenção.
  const { ligado: morar, travado: morarTravado } = estadoQueroMorar(intencao, emUso === "morador");
  const anunciar = intencao.includes("anunciar");

  // E1028: o botão de cada cartão entra pela ação do cartão (no celular, uma linha própria por baixo da foto e do texto).
  const botaoAnunciar = (
    <ButtonLink href="/dashboard/imoveis/novo" size="lg" className={BOTAO_DO_CARTAO} data-testid="papel-comecar-anuncio">
      Começar um anúncio
    </ButtonLink>
  );
  const botaoParceiro = (
    <ButtonLink href={HREF_ATIVAR_PARCERIA} size="lg" className={BOTAO_DO_CARTAO} data-testid="papel-parceiro-botao">
      {parceiro ? BOTAO_PARCEIRO_ATIVO : aprovadaSemPagina ? BOTAO_PARCERIA_APROVADA : BOTAO_QUERO_PARCEIRO}
    </ButtonLink>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" data-testid="tela-papeis">
      <CartaoPapel id="morar" foto={PHOTOS.papeis.morar} ativo={morar}>
        <div className="flex items-start justify-between gap-3">
          <h2 className={TITULO_CARTAO}>Quero morar</h2>
          <Switch checked={morar} disabled={morarTravado} onChange={(v) => void alternar("morar", v)} label="Quero morar" testId="papel-morar-toggle" />
        </div>
        {morarTravado && (
          <p className="mt-1 text-sm text-muted" data-testid="papel-morar-em-uso">
            {TEXTO_MORAR_EM_USO}
          </p>
        )}
        <p className="mt-1 text-base text-ink">{linhaQueroMorar(cidade)}</p>
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink sm:text-base" data-testid="papel-morar-resumo">
          <MapPin className="h-5 w-5 shrink-0 text-forest" aria-hidden /> {resumoQueroMorar(cidade)}
        </p>
      </CartaoPapel>

      <CartaoPapel id="anunciar" foto={PHOTOS.papeis.anunciar} ativo={anunciar} acao={botaoAnunciar}>
        <div className="flex items-start justify-between gap-3">
          <h2 className={TITULO_CARTAO}>Quero anunciar</h2>
          {anunciar && <Switch checked onChange={(v) => void alternar("anunciar", v)} label="Quero anunciar" testId="papel-anunciar-toggle" />}
        </div>
        <p className="mt-1 text-base text-ink">Anuncie seu imóvel mobiliado</p>
        <p className="mt-1 text-sm text-muted">{textoQueroAnunciar(cidade)}</p>
      </CartaoPapel>

      <CartaoPapel id="parceiro" foto={PHOTOS.papeis.parceiro} ativo={parceiro} acao={botaoParceiro}>
        <h2 className={TITULO_CARTAO}>Quero ser parceiro</h2>
        {aprovadaSemPagina ? (
          <p className="mt-1 text-base text-ink" data-testid="papel-parceiro-aprovada">{TEXTO_PARCERIA_APROVADA}</p>
        ) : (
          <p className="mt-1 text-base text-ink">{TEXTO_QUERO_PARCEIRO}</p>
        )}
      </CartaoPapel>

      <div className="flex flex-wrap justify-center gap-3">
        <span
          className="inline-flex min-h-11 items-center gap-1 rounded-full bg-sage-100 px-4 text-sm font-semibold text-forest"
          role="status"
          data-testid="papeis-preferencias"
          data-estado={estado ?? "ok"}
        >
          {estado === "erro_leitura" ? "Não foi possível carregar suas escolhas agora. Recarregue a página para tentar de novo." : estado === "erro" ? "Não foi possível salvar. Tente de novo." : estado === "salvando" ? "Salvando…" : (
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
/** O botão de um cartão: largura toda da linha dele. No celular o recuo lateral encolhe, porque o texto nunca quebra. */
const BOTAO_DO_CARTAO = "w-full px-3 sm:px-8";

/**
 * O cartão de papel: a foto pequena à esquerda (mesma medida nos três; no computador o selo "Ativo" fica sobre a foto,
 * como no desenho; no celular, ao lado do conteúdo) e o conteúdo à direita.
 * E1028: o botão (`acao`) não mora na coluna do conteúdo. No celular ele desce para uma linha própria, na largura toda
 * do cartão: ao lado da foto sobram 214 px a 390 px, e "Abrir meu painel de parceiro" pede 243 (o texto de um botão
 * nunca quebra). Do sm para cima fica onde sempre esteve, por baixo do conteúdo. O conteúdo pode encolher
 * (`minmax(0,1fr)`): nenhuma coluna alarga por causa do que tem dentro.
 */
function CartaoPapel({ id, foto, ativo, acao, children }: { id: "morar" | "anunciar" | "parceiro"; foto: string; ativo: boolean; acao?: ReactNode; children: ReactNode }) {
  return (
    <section
      className={cn("grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-x-4 rounded-xl bg-white p-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:grid-rows-[auto_1fr] sm:gap-x-6 sm:p-6", SOMBRA_CARTAO_CONTA)}
      data-testid={`papel-cartao-${id}`}
      data-ativo={ativo ? "1" : "0"}
    >
      <span className="relative block aspect-[4/5] w-24 overflow-hidden rounded-lg bg-surface-2 sm:row-span-2 sm:aspect-[5/4] sm:w-44" data-testid="papel-foto">
        <Image src={foto} alt="" fill sizes="(min-width: 640px) 176px, 96px" className="object-cover" />
        {ativo && (
          <span className="absolute left-2 top-2 inline-flex items-center rounded-lg bg-forest px-2 py-1 text-xs font-semibold text-white sm:text-sm" data-testid={`papel-${id}-ativo`}>
            Ativo
          </span>
        )}
      </span>
      <div className="min-w-0">{children}</div>
      {acao && (
        <div className="col-span-2 mt-3 sm:col-span-1 sm:col-start-2" data-testid={`papel-${id}-acao`}>
          {acao}
        </div>
      )}
    </section>
  );
}
