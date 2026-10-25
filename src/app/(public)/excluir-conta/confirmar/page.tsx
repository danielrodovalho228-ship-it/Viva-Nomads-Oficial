"use client";

import { useEffect, useState } from "react";
import { TEXTO_EXCLUSAO } from "@/lib/saida/regras";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { confirmarExclusaoConta } from "@/lib/data/account-delete";
import { buttonClasses } from "@/components/ui/button";

type Fase = "pronto" | "sem-token" | "apagando" | "ok" | "bloqueado" | "erro";

/**
 * Confirmação da exclusão. A exclusão SÓ acontece no CLIQUE do botão — nunca no
 * carregamento — para que pré-carregadores de link (webmail/antivírus) não apaguem
 * a conta sozinhos.
 */
export default function ConfirmarExclusaoPage() {
  const [token, setToken] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("pronto");
  const [erro, setErro] = useState<string | null>(null);
  const [anonimizado, setAnonimizado] = useState(false);

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
      if (r.ok) {
        setAnonimizado(!!r.anonymized);
        setFase("ok");
      } else if (r.blocked) {
        setErro(r.error ?? "");
        setFase("bloqueado");
      } else {
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
          <h1 className="mt-4 font-title text-2xl font-semibold text-ink">
            {anonimizado ? "Dados removidos" : "Conta excluída"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {anonimizado
              ? "Seus dados pessoais (nome, e-mail, telefone e foto) foram removidos e o acesso foi encerrado. Registros de contratos são mantidos sem identificação pelo prazo exigido por lei."
              : "Sua conta e seus dados pessoais foram apagados. Contratos assinados e registros financeiros ficam guardados pelo prazo legal, com acesso restrito. Sentiremos sua falta — você é bem-vindo de volta quando quiser."}
          </p>
          <Link href="/" className={buttonClasses({ size: "md", className: "mt-6" })}>
            Voltar ao início
          </Link>
        </div>
      ) : fase === "bloqueado" ? (
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <h1 className="mt-4 font-title text-2xl font-semibold text-ink">Encerre a locação primeiro</h1>
          <p className="mt-2 text-sm text-muted">{erro}</p>
          <Link
            href="/dashboard/contratos"
            className="mt-6 inline-flex rounded-xl border border-sage-200 px-4 py-3 text-sm font-medium text-forest"
          >
            Ver meus contratos
          </Link>
        </div>
      ) : fase === "sem-token" ? (
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <h1 className="mt-4 font-title text-2xl font-semibold text-ink">Link incompleto</h1>
          <p className="mt-2 text-sm text-muted">
            Abra o link exatamente como chegou no e-mail. Se preferir, peça um novo.
          </p>
          <Link href="/excluir-conta" className="mt-6 inline-flex rounded-xl border border-sage-200 px-4 py-3 text-sm font-medium text-forest">
            Pedir novo link
          </Link>
        </div>
      ) : (
        <>
          <h1 className="font-title text-2xl font-semibold text-ink">Confirmar exclusão da conta</h1>
          <p className="mt-2 text-sm text-muted">
            Esta ação é <strong className="text-ink">definitiva</strong>: a conta não pode ser recuperada. {TEXTO_EXCLUSAO}
          </p>
          {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={apagar}
              disabled={fase === "apagando"}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {fase === "apagando" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Excluir minha conta definitivamente
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-sage-200 px-4 py-3 text-sm font-medium text-muted"
            >
              Cancelar
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
