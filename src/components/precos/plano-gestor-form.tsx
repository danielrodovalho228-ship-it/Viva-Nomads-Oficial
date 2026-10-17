"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";

/**
 * "Falar sobre o Plano Gestor" (31+ imóveis): botão secundário que abre o formulário numa janela à parte
 * (gaveta no celular, modal no computador) — nunca se expande no meio da tabela (prompt 13).
 */
export function PlanoGestorForm({ className }: { className?: string }) {
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

  const inputCls = "h-12 w-full rounded-xl border border-line px-3.5 text-base outline-none focus:border-forest";
  return (
    <>
      <Button type="button" variant="secondary" size="lg" className={className} onClick={() => setAberto(true)} data-testid="plano-gestor-botao">
        Falar sobre o Plano Gestor
      </Button>
      <BottomSheet open={aberto} onClose={() => setAberto(false)} title="Plano Gestor: 31 imóveis ou mais">
        {ok ? (
          <p className="flex items-start gap-2 text-sm text-ink" role="status" data-testid="plano-gestor-ok">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden /> Recebemos seu contato. Nosso time responde no e-mail informado.
          </p>
        ) : (
          <form onSubmit={enviar} className="grid gap-3" data-testid="plano-gestor-form">
            <p className="text-sm text-muted">31 imóveis ou mais? Plano Gestor: condições negociadas, entre em contato.</p>
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
            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Enviando…" : "Enviar"}
            </Button>
          </form>
        )}
      </BottomSheet>
    </>
  );
}
