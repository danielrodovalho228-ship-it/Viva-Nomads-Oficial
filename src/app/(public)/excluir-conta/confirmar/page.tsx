"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { confirmarExclusaoConta } from "@/lib/data/account-delete";

type Fase = "pronto" | "sem-token" | "apagando" | "ok" | "erro";

/**
 * Confirmação da exclusão. A exclusão SÓ acontece no CLIQUE do botão — nunca no
 * carregamento — para que pré-carregadores de link (webmail/antivírus) não apaguem
 * a conta sozinhos.
 */
export default function ConfirmarExclusaoPage() {
  const [token, setToken] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("pronto");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let t: string | null = null;
    try {
      t = new URLSearchParams(window.location.search).get("token");
    } catch {
      t = null;
    }
    // Lê o token do link uma vez, no cliente (não existe no SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t) setToken(t);
    else setFase("sem-token");
  }, []);

  async function apagar() {
    if (!token) return;
    setErro(null);
    setFase("apagando");
    try {
      const r = await confirmarExclusaoConta(token);
      if (r.ok) setFase("ok");
      else {
        setErro(r.error ?? "Não foi possível excluir agora.");
        setFase("erro");
      }
    } catch {
      setErro("Não foi possível excluir agora.");
      setFase("erro");
    }
  }

  return (
    <div className="container-page section-y max-w-lg">
      {fase === "ok" ? (
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-100">
            <CheckCircle2 className="h-7 w-7 text-forest" />
          </div>
          <h1 className="mt-4 font-title text-2xl font-bold text-ink">Conta excluída</h1>
          <p className="mt-2 text-sm text-muted">
            Sua conta e seus dados foram apagados. Sentiremos sua falta — você é bem-vindo de volta
            quando quiser.
          </p>
          <Link href="/home" className="mt-6 inline-flex rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white">
            Voltar ao início
          </Link>
        </div>
      ) : fase === "sem-token" ? (
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <h1 className="mt-4 font-title text-2xl font-bold text-ink">Link incompleto</h1>
          <p className="mt-2 text-sm text-muted">
            Abra o link exatamente como chegou no e-mail. Se preferir, peça um novo.
          </p>
          <Link href="/excluir-conta" className="mt-6 inline-flex rounded-xl border border-sage-200 px-4 py-2.5 text-sm font-medium text-forest">
            Pedir novo link
          </Link>
        </div>
      ) : (
        <>
          <h1 className="font-title text-2xl font-bold text-ink">Confirmar exclusão da conta</h1>
          <p className="mt-2 text-sm text-muted">
            Esta ação é <strong className="text-ink">definitiva</strong>. Ao confirmar, sua conta e
            todos os dados (perfil, anúncios, candidaturas, mensagens, contratos, favoritos) serão
            apagados e não poderão ser recuperados.
          </p>
          {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={apagar}
              disabled={fase === "apagando"}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {fase === "apagando" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Excluir minha conta definitivamente
            </button>
            <Link
              href="/home"
              className="inline-flex items-center justify-center rounded-xl border border-sage-200 px-4 py-2.5 text-sm font-medium text-muted"
            >
              Cancelar
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
