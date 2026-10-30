"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

/** Nada a assinar: no servidor (e no HTML antes do JavaScript) vale false; no navegador hidratado, true. */
const semAssinatura = () => () => {};

const campo = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink";

/** A chave fica só neste campo de senha e no corpo do POST; nunca na URL nem guardada no navegador. */
export function QaEntrarForm({ email: emailInicial, destino }: { email: string; destino: string }) {
  const [email, setEmail] = useState(emailInicial);
  const [chave, setChave] = useState("");
  const [papel, setPapel] = useState<"tenant" | "owner">("tenant");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  // E256-B: antes de o JavaScript carregar, o botão fica travado. Sem isso, um toque cedo fazia o navegador enviar o
  // formulário sozinho (sem passar pelo fetch) e a porta respondia 404 sem nunca ter conferido a chave.
  const pronto = useSyncExternalStore(semAssinatura, () => true, () => false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    // POST relativo: vai ao mesmo host da página, sem redirecionamento no caminho.
    const r = await fetch("/api/qa/entrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, chave, papel, destino }),
      cache: "no-store",
    }).catch(() => null);
    setChave("");
    if (r?.ok) {
      window.location.assign(destino);
      return;
    }
    setEnviando(false);
    setErro(r?.status === 429 ? "Muitas entradas nesta hora. Tente mais tarde." : "Não foi possível entrar.");
  }

  return (
    <form onSubmit={enviar} className="mt-4 grid gap-3" data-testid="qa-entrar-form" autoComplete="off">
      <label className="grid gap-1 text-sm font-semibold text-ink">
        E-mail da conta de teste
        <input className={campo} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="qa-email" />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-ink">
        Chave da QA
        <input className={campo} type="password" required autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)} data-testid="qa-chave" />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-ink">
        Papel (só para conta nova)
        <select className={campo} value={papel} onChange={(e) => setPapel(e.target.value === "owner" ? "owner" : "tenant")} data-testid="qa-papel">
          <option value="tenant">Morador</option>
          <option value="owner">Proprietário</option>
        </select>
      </label>
      {erro ? (
        <p role="alert" className="text-sm text-red-700" data-testid="qa-erro">
          {erro}
        </p>
      ) : null}
      <Button type="submit" disabled={enviando || !pronto} data-testid="qa-entrar" data-pronto={pronto ? "1" : "0"}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
