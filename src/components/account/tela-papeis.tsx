"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SeusPapeis } from "@/components/account/seus-papeis";
import { getMinhaIntencao, salvarMinhaIntencao } from "@/lib/data/intencao-actions";
import { getMeuPerfilPublico } from "@/lib/data/perfil-actions";
import type { Intencao } from "@/lib/auth/entrada";
import { RODAPE_PAPEIS, alternarIntencao, linhaQueroMorar, resumoQueroMorar, textoQueroAnunciar } from "@/lib/conta/tela-papeis";

/**
 * A3 — Conta › Papéis e intenção (mockup perfil-03): o cartão "Quero morar" (Ativo + interruptor, a linha da busca e o
 * resumo com o pino), o cartão "Quero anunciar" (texto e "Começar um anúncio") e as pílulas "Preferências salvas" e
 * "Ajuda com o cadastro". Gravação automática a cada toque (rodapé do desenho). Embaixo, o papel em uso (troca de
 * menu e painel) — requisito já aprovado que o desenho não mostra.
 */
export function TelaPapeis() {
  const [intencao, setIntencao] = useState<Intencao[] | null>(null);
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState<"ok" | "salvando" | "erro" | null>(null);

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
      <section className="rounded-xl bg-white p-4 sm:p-6" data-testid="papel-cartao-morar" data-ativo={morar ? "1" : "0"}>
        <div className="flex items-start justify-between gap-4">
          <span className={morar ? "inline-flex items-center rounded-lg bg-forest px-3 py-1 text-sm font-semibold text-white" : "invisible"} data-testid="papel-morar-ativo">
            Ativo
          </span>
          <Switch checked={morar} onChange={(v) => void alternar("morar", v)} label="Quero morar" testId="papel-morar-toggle" />
        </div>
        <h2 className="mt-2 font-title text-2xl font-semibold text-ink">Quero morar</h2>
        <p className="mt-1 text-base text-ink">{linhaQueroMorar(cidade)}</p>
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 py-3 text-base text-ink" data-testid="papel-morar-resumo">
          <MapPin className="h-5 w-5 shrink-0 text-forest" aria-hidden /> {resumoQueroMorar(cidade)}
        </p>
      </section>

      <section className="rounded-xl bg-white p-4 sm:p-6" data-testid="papel-cartao-anunciar" data-ativo={anunciar ? "1" : "0"}>
        {anunciar && (
          <div className="mb-2 flex items-start justify-between gap-4">
            <span className="inline-flex items-center rounded-lg bg-forest px-3 py-1 text-sm font-semibold text-white">Ativo</span>
            <Switch checked onChange={(v) => void alternar("anunciar", v)} label="Quero anunciar" testId="papel-anunciar-toggle" />
          </div>
        )}
        <h2 className="font-title text-2xl font-semibold text-ink">Quero anunciar</h2>
        <p className="mt-1 text-base text-ink">Anuncie seu imóvel mobiliado</p>
        <p className="mt-2 text-sm text-muted">{textoQueroAnunciar(cidade)}</p>
        <ButtonLink href="/dashboard/imoveis/novo" size="lg" className="mt-4 w-full sm:w-auto sm:min-w-80" data-testid="papel-comecar-anuncio">
          Começar um anúncio
        </ButtonLink>
      </section>

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
