"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Formulário de contato corporativo (B2B) → e-mail ao admin. */
export function EmpresasForm() {
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [volumeAno, setVolumeAno] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, empresa, email, volumeAno, mensagem }),
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
      <div className="flex items-start gap-3 rounded-2xl border border-sage-200 bg-sage-50 p-6">
        <Check className="mt-0.5 h-5 w-5 shrink-0 text-forest" />
        <div>
          <p className="font-title font-bold text-ink">Recebemos seu contato.</p>
          <p className="mt-1 text-sm text-muted">
            Nosso time responde no e-mail informado. Obrigado pelo interesse.
          </p>
        </div>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-sm outline-none focus:border-sage";

  return (
    <form onSubmit={enviar} className="grid gap-4 rounded-2xl border border-sage-200 bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Nome</span>
          <input required value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Empresa</span>
          <input required value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">E-mail corporativo</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Estadias por ano (estimativa)</span>
          <input value={volumeAno} onChange={(e) => setVolumeAno(e.target.value)} placeholder="ex.: 20" className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Mensagem (opcional)</span>
        <textarea
          rows={3}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Conte um pouco da sua necessidade de mobilidade corporativa."
          className={inputCls}
        />
      </label>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div>
        <Button type="submit" variant="gold" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Enviando…" : "Fale com a gente"}
        </Button>
      </div>
    </form>
  );
}
