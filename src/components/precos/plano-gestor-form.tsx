"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Falar sobre o Plano Gestor" (31+ imóveis): deixa o contato e a equipe responde. */
export function PlanoGestorForm() {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [imoveis, setImoveis] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/plano-gestor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, telefone, imoveis }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível enviar agora. Tente novamente.");
        return;
      }
      setOk(true);
    } catch {
      setErro("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (ok) {
    return (
      <p className="mt-3 flex items-start gap-2 text-sm text-ink" role="status" data-testid="plano-gestor-ok">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden /> Recebemos seu contato. Nosso time responde no e-mail informado.
      </p>
    );
  }
  if (!aberto) {
    return (
      <Button type="button" variant="gold" className="mt-3 w-full sm:w-auto" onClick={() => setAberto(true)} data-testid="plano-gestor-botao">
        Falar sobre o Plano Gestor
      </Button>
    );
  }
  const inputCls = "w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-base outline-none focus:border-sage";
  return (
    <form onSubmit={enviar} className="mt-3 grid gap-3" data-testid="plano-gestor-form">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Nome</span>
        <input required maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} autoComplete="name" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">E-mail</span>
        <input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="email" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Telefone (opcional)</span>
        <input type="tel" maxLength={20} value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputCls} autoComplete="tel" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Quantos imóveis ativos (opcional)</span>
        <input inputMode="numeric" value={imoveis} onChange={(e) => setImoveis(e.target.value)} className={inputCls} />
      </label>
      {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}
      <div>
        <Button type="submit" variant="gold" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
