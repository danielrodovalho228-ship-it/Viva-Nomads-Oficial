"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { solicitarExclusaoConta } from "@/lib/data/account-delete";
import { isValidEmail } from "@/lib/auth-errors";

export function ExcluirContaForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!isValidEmail(email)) {
      setErro("Digite um e-mail válido.");
      return;
    }
    setLoading(true);
    try {
      await solicitarExclusaoConta(email.trim());
      // Resposta sempre neutra (não revela se a conta existe).
      setEnviado(true);
    } catch {
      setEnviado(true); // mesma mensagem neutra, mesmo em falha
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-sage-100 px-4 py-3 text-sm text-forest">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        Se existir uma conta com esse e-mail, enviamos um link para confirmar a exclusão. Verifique a
        caixa de entrada e o spam. O link vale por 30 minutos e só pode ser usado uma vez.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="email-exclusao" className="block text-sm font-medium text-ink">
        E-mail da conta
      </label>
      <div className="flex items-center gap-3 rounded-xl border border-sage-200 bg-white px-4 py-3 focus-within:border-sage">
        <Mail className="h-4 w-4 text-sage" />
        <input
          id="email-exclusao"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Enviar link de exclusão
      </button>
    </form>
  );
}
