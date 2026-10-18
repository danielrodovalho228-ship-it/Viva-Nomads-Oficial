"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { TIPOS_PARCEIRO } from "@/lib/parceiros/interesse";
import { buttonClasses } from "@/components/ui/button";

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const campo = "mt-1 w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-base outline-none focus:border-sage";

/** Formulário "Quero ser parceiro" → /api/parceiros-interesse. `tipoInicial` vem de ?tipo=. */
export function ParceiroForm({ tipoInicial }: { tipoInicial: string }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/parceiros-interesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: f.get("tipo"), nome: f.get("nome"), cidade: f.get("cidade"), uf: f.get("uf"),
          contato: f.get("contato"), site: f.get("site"), aceite: f.get("aceite") === "on", armadilha: f.get("armadilha"),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setErro(data.error ?? "Não foi possível enviar agora. Tente de novo.");
      else setOk(true);
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-sage-200 bg-sage-50 p-6">
        <Check className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
        <div>
          <p className="font-bold text-ink">Recebemos seu interesse.</p>
          <p className="mt-1 text-sm text-ink/70">A equipe da Viva Nomads entra em contato. Obrigado!</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="grid gap-4 rounded-2xl border border-sage-200 bg-white p-5 sm:p-6">
      <div>
        <label htmlFor="p-tipo" className="block text-sm font-medium text-ink">Tipo de parceria</label>
        <select id="p-tipo" name="tipo" required defaultValue={TIPOS_PARCEIRO.some((t) => t.valor === tipoInicial) ? tipoInicial : ""} className={campo}>
          <option value="" disabled>Escolha…</option>
          {TIPOS_PARCEIRO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="p-nome" className="block text-sm font-medium text-ink">Seu nome ou nome da empresa</label>
        <input id="p-nome" name="nome" required minLength={2} maxLength={80} autoComplete="organization" className={campo} />
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div>
          <label htmlFor="p-cidade" className="block text-sm font-medium text-ink">Cidade</label>
          <input id="p-cidade" name="cidade" required minLength={2} maxLength={80} autoComplete="address-level2" className={campo} />
        </div>
        <div>
          <label htmlFor="p-uf" className="block text-sm font-medium text-ink">UF</label>
          <select id="p-uf" name="uf" required defaultValue="" className={campo}>
            <option value="" disabled>UF</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="p-contato" className="block text-sm font-medium text-ink">WhatsApp (com DDD) ou e-mail</label>
        <input id="p-contato" name="contato" required maxLength={200} autoComplete="off" className={campo} />
      </div>
      <div>
        <label htmlFor="p-site" className="block text-sm font-medium text-ink">Site, Instagram ou portfólio (opcional)</label>
        <input id="p-site" name="site" autoComplete="url" maxLength={300} inputMode="url" className={campo} />
      </div>
      {/* Armadilha para robôs: pessoas não veem nem preenchem. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Não preencha<input name="armadilha" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" name="aceite" required className="mt-1 h-4 w-4" />
        <span>Aceito que a Viva Nomads entre em contato comigo sobre a parceria.</span>
      </label>
      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
      <button type="submit" disabled={enviando} className={buttonClasses({ size: "md" })}>
        {enviando ? "Enviando…" : "Quero ser parceiro"}
      </button>
    </form>
  );
}
