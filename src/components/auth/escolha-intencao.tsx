"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIMARIO_PORTA } from "@/lib/auth/porta-visual";
import { getMinhaIntencao, salvarMinhaIntencao } from "@/lib/data/intencao-actions";
import { INTENCOES, ROTULO_INTENCAO, painelInicial, type Intencao } from "@/lib/auth/entrada";

const DICA: Record<Intencao, string> = {
  morar: "Buscar imóvel mobiliado por meses",
  anunciar: "Anunciar e receber pedidos",
  servicos: "Limpeza, fotos, gestão e outros",
};

function Opcoes({ marcadas, alternar }: { marcadas: Intencao[]; alternar: (i: Intencao) => void }) {
  return (
    <div className="grid gap-3" role="group" aria-label="O que você quer fazer na Viva">
      {INTENCOES.map((i) => {
        const ativa = marcadas.includes(i);
        return (
          <button
            key={i}
            type="button"
            aria-pressed={ativa}
            data-testid={`intencao-${i}`}
            onClick={() => alternar(i)}
            className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
              ativa ? "border-forest bg-sage-100" : "border-sage-200 hover:border-sage"
            }`}
          >
            <span>
              <span className="block font-title text-base font-semibold text-ink">{ROTULO_INTENCAO[i]}</span>
              <span className="block text-xs text-muted">{DICA[i]}</span>
            </span>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${ativa ? "border-forest bg-forest text-white" : "border-sage-200"}`} aria-hidden>
              {ativa && <Check className="h-4 w-4" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Tela de 1 toque depois do 1º código de uma conta nova (Prompt 49). Multi-escolha; "Agora não" grava a resposta
 * vazia (não pergunta de novo). O destino é o painel da intenção — ou a ação que pediu a conta, se houver.
 */
export function EscolhaIntencaoEntrada({ destino }: { destino: string }) {
  const [marcadas, setMarcadas] = useState<Intencao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alternar = (i: Intencao) => setMarcadas((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]));

  async function concluir(escolha: Intencao[]) {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    const alvo = painelInicial(escolha, destino);
    const r = await salvarMinhaIntencao(escolha, alvo.modo).catch(() => ({ ok: false, error: "Não foi possível salvar agora." }));
    if (!r.ok) {
      setErro(r.error ?? "Não foi possível salvar agora.");
      setSalvando(false);
      return;
    }
    window.location.assign(alvo.destino);
  }

  return (
    <div data-testid="tela-intencao">
      <h1 className="font-title text-2xl font-semibold text-ink">O que você quer fazer na Viva?</h1>
      <p className="mt-2 text-sm text-muted">Pode marcar mais de um. Muda só o que aparece primeiro no seu painel; dá para trocar depois no Perfil.</p>
      <div className="mt-6">
        <Opcoes marcadas={marcadas} alternar={alternar} />
      </div>
      {erro && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {erro}
        </p>
      )}
      <Button type="button" className={`mt-6 w-full ${PRIMARIO_PORTA}`} data-testid="intencao-continuar" aria-busy={salvando} disabled={salvando || marcadas.length === 0} onClick={() => concluir(marcadas)}>
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
        Continuar
      </Button>
      <div className="mt-2 text-center">
        <button type="button" data-testid="intencao-agora-nao" disabled={salvando} onClick={() => concluir([])} className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-ink">
          Agora não
        </button>
      </div>
    </div>
  );
}

/** No Perfil (Conta): a mesma escolha, editável. Salvar não mexe em papel nem em permissão. */
export function MinhaIntencao() {
  const [marcadas, setMarcadas] = useState<Intencao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    getMinhaIntencao()
      .then((v) => vivo && setMarcadas(v ?? []))
      .catch(() => {})
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const alternar = (i: Intencao) => {
    setOk(false);
    setMarcadas((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]));
  };

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setOk(false);
    const r = await salvarMinhaIntencao(marcadas, null).catch(() => ({ ok: false, error: "Não foi possível salvar agora." }));
    setSalvando(false);
    if (r.ok) setOk(true);
    else setErro(r.error ?? "Não foi possível salvar agora.");
  }

  return (
    <div className="rounded-xl border border-sage-200 p-4" data-testid="minha-intencao">
      <h3 className="font-title text-base font-semibold text-ink">O que você quer fazer na Viva</h3>
      <p className="mt-1 text-sm text-muted">Define o que aparece primeiro no painel. Não muda o que você pode fazer na conta.</p>
      {carregando ? (
        // C6 (Conta): as três opções já ocupam o lugar enquanto a escolha salva chega — sem ícone girando e sem pulo.
        <div className="mt-4 grid gap-3" aria-busy="true" data-testid="minha-intencao-carregando">
          {[0, 1, 2].map((n) => (
            <span key={n} className="block h-14 rounded-xl border-2 border-sage-200 bg-surface-2" aria-hidden />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-4">
            <Opcoes marcadas={marcadas} alternar={alternar} />
          </div>
          {erro && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {erro}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={salvar} disabled={salvando} data-testid="minha-intencao-salvar">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
            {ok && <span className="text-sm text-forest">Salvo.</span>}
          </div>
        </>
      )}
    </div>
  );
}
