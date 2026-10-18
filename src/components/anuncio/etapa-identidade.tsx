"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { TEXTO_VALIDADE_CAF } from "@/lib/caf/validade";

type Situacao = { feita: boolean; ok: boolean; temCpf: boolean; validoAte: string | null; refazer?: boolean };

/**
 * Etapa "Confirme sua identidade" do cadastro do anúncio (decisão do Daniel, 18/10): vem DEPOIS do endereço e ANTES
 * da matrícula. Com laudo válido (12 meses) a etapa aparece já concluída e não pede nada; conta de teste e laboratório
 * usam o laudo simulado. Enquanto a CAF não estiver ligada em produção, o aviso "em breve" aparece e o cadastro segue
 * (a matrícula fica "em revisão" até 48 h).
 */
export function EtapaIdentidade({ onConfirmada }: { onConfirmada?: () => void }) {
  const [s, setS] = useState<Situacao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/caf/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Situacao | null) => vivo && setS(j ?? { feita: false, ok: false, temCpf: false, validoAte: null }))
      .catch(() => vivo && setS({ feita: false, ok: false, temCpf: false, validoAte: null }));
    return () => {
      vivo = false;
    };
  }, []);

  async function confirmar() {
    setAviso(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/caf/verify", { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string; identity?: boolean; document?: boolean; liveness?: boolean };
      if (!r.ok) return setAviso(j.error ?? "Não foi possível confirmar sua identidade agora.");
      const ok = j.identity === true && j.document === true && j.liveness === true;
      setS((x) => ({ feita: true, ok, temCpf: x?.temCpf ?? true, validoAte: x?.validoAte ?? null }));
      if (ok) onConfirmada?.();
      else setAviso("Não conseguimos confirmar sua identidade. A equipe confere a matrícula em até 48 horas.");
    } catch {
      setAviso("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const estado = !s ? "carregando" : s.ok ? "ok" : !s.temCpf ? "sem_cpf" : "pendente";
  return (
    <section className="rounded-xl border border-sage-200 p-4" data-testid="etapa-identidade" data-estado={estado} aria-labelledby="etapa-identidade-titulo">
      <p id="etapa-identidade-titulo" className="text-sm font-semibold text-ink">
        Confirme sua identidade
      </p>
      <p className="mt-0.5 text-xs text-muted">
        É o que permite conferir a matrícula na hora: comparamos o CPF do seu cadastro com o do proprietário. {TEXTO_VALIDADE_CAF}
      </p>
      {estado === "carregando" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Verificando…
        </p>
      )}
      {estado === "ok" && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-900" data-testid="identidade-confirmada">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Identidade confirmada
          {s?.validoAte && <span className="font-normal"> · até {new Date(s.validoAte).toLocaleDateString("pt-BR")}</span>}
        </p>
      )}
      {estado === "sem_cpf" && (
        <p className="mt-3 text-sm text-ink" data-testid="identidade-sem-cpf">
          Cadastre seu CPF em{" "}
          <Link href="/dashboard/conta#documento" className="font-semibold text-forest underline">
            Conta
          </Link>{" "}
          para confirmar a identidade. Você pode seguir o cadastro enquanto isso.
        </p>
      )}
      {estado === "pendente" && s?.refazer && (
        <p className="mt-3 text-sm text-ink" data-testid="identidade-refazer">
          A confirmação anterior deixou de valer (venceu ou o nome/CPF do cadastro mudou). Confirme de novo.
        </p>
      )}
      {estado === "pendente" && (
        <button type="button" onClick={() => void confirmar()} disabled={enviando} className={buttonClasses({ className: "mt-3 w-full sm:w-auto disabled:opacity-60" })} data-testid="identidade-confirmar">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />} {s?.refazer ? "Confirmar de novo" : "Confirmar minha identidade"}
        </button>
      )}
      {aviso && (
        <p className="mt-2 text-xs text-amber-900" role="status" data-testid="identidade-aviso">
          {aviso}
        </p>
      )}
    </section>
  );
}
