"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Circle } from "lucide-react";
import { confirmarVinculo, meuVinculo, pedirVinculo } from "@/lib/vinculo/actions";
import { TEXTO_OPCIONAL_VINCULO, TEXTO_O_QUE_E_VINCULO, detalheVinculo } from "@/lib/vinculo/textos";
import { cn } from "@/lib/utils";

type Passo = "carregando" | "inicio" | "email" | "codigo" | "ok";

/** Linha "Vínculo profissional" da lista de confiança: e-mail corporativo → código de 6 dígitos → selo com o domínio. */
export function VinculoProfissional() {
  const [passo, setPasso] = useState<Passo>("carregando");
  const [dominio, setDominio] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    meuVinculo()
      .then((v) => {
        if (!vivo) return;
        setDominio(v?.dominio ?? null);
        setPasso(v ? "ok" : "inicio");
      })
      .catch(() => vivo && setPasso("inicio"));
    return () => {
      vivo = false;
    };
  }, []);

  const pedir = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      const r = await pedirVinculo(email);
      if (r.ok) {
        setDominio(r.dominio);
        setCodigo("");
        setPasso("codigo");
      } else setErro(r.error);
    } catch {
      setErro("Não foi possível agora. Tente de novo em instantes.");
    } finally {
      setOcupado(false);
    }
  };

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      const r = await confirmarVinculo(codigo);
      if (r.ok) {
        setDominio(r.dominio);
        setPasso("ok");
      } else setErro(r.error);
    } catch {
      setErro("Não foi possível agora. Tente de novo em instantes.");
    } finally {
      setOcupado(false);
    }
  };

  const ok = passo === "ok" && dominio;
  const campo = "min-h-11 w-full rounded-lg border border-line px-3 text-sm text-ink";
  const botao = "inline-flex min-h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-semibold text-white disabled:opacity-60";

  return (
    <li className="py-3" data-testid="confianca-vinculo" data-situacao={passo === "carregando" ? "carregando" : ok ? "ok" : "falta"}>
      <div className="flex min-h-[2.75rem] items-center gap-3">
        <Building2 className="h-5 w-5 shrink-0 text-sage" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Vínculo profissional</p>
          {passo === "carregando" ? (
            <span className="mt-1 block h-3 w-28 rounded-lg bg-surface-2" aria-hidden />
          ) : (
            <p className={cn("flex items-center gap-1 break-words text-xs", ok ? "text-forest" : "text-muted")} data-testid="vinculo-detalhe">
              {ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              {ok ? detalheVinculo(dominio) : TEXTO_OPCIONAL_VINCULO}
            </p>
          )}
          {passo !== "carregando" && <p className="mt-1 text-xs text-muted">{TEXTO_O_QUE_E_VINCULO}</p>}
        </div>
        {(passo === "inicio" || passo === "ok") && (
          <button
            type="button"
            onClick={() => {
              setErro(null);
              setPasso("email");
            }}
            className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-forest underline underline-offset-2"
            data-testid="vinculo-abrir"
          >
            {ok ? "Trocar" : "Confirmar"}
          </button>
        )}
      </div>
      {passo === "email" && (
        <form onSubmit={pedir} className="mt-2 grid gap-2 rounded-lg border border-line p-3" data-testid="vinculo-form-email">
          <label className="text-sm text-ink" htmlFor="vinculo-email">
            E-mail da empresa, hospital ou universidade
          </label>
          <input id="vinculo-email" type="email" inputMode="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
          <button type="submit" disabled={ocupado} className={botao}>
            {ocupado ? "Enviando…" : "Enviar código"}
          </button>
        </form>
      )}
      {passo === "codigo" && (
        <form onSubmit={confirmar} className="mt-2 grid gap-2 rounded-lg border border-line p-3" data-testid="vinculo-form-codigo">
          <label className="text-sm text-ink" htmlFor="vinculo-codigo">
            Código de 6 dígitos enviado para o seu e-mail
          </label>
          <input id="vinculo-codigo" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} pattern="[0-9]{6}" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={campo} />
          <button type="submit" disabled={ocupado} className={botao}>
            {ocupado ? "Conferindo…" : "Confirmar código"}
          </button>
        </form>
      )}
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-700" data-testid="vinculo-erro">
          {erro}
        </p>
      )}
    </li>
  );
}
