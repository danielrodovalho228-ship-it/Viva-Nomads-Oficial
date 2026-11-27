"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mail, KeyRound } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { PRIMARIO_PORTA } from "@/lib/auth/porta-visual";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail } from "@/lib/auth-errors";
import { TEXTO_VALIDADE_CODIGO } from "@/lib/seguranca/codigo-acesso";
import { CHAVE_CODIGO_TELA, MSG_CODIGO_RECUPERACAO_INVALIDO, codigoParaTela, codigoRecuperacaoValido } from "@/lib/auth/recuperar-codigo";

/**
 * E917 (opção A): a recuperação de senha por CÓDIGO (contas de teste). O código é o OTP do tipo recovery do Supabase:
 * verifyOtp cria a sessão de recuperação e a pessoa segue para /auth/reset, que já tem o formulário da nova senha.
 * Mesma validade e uso único do link (o Supabase recusa código vencido ou já usado).
 */
export default function ResetPorCodigoPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // E917 (prova de 19/11): o código da conta de teste, mostrado na tela (veio do /auth pelo sessionStorage).
  const [codigoNaTela, setCodigoNaTela] = useState<string | null>(null);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("email");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (e) setEmail(e);
    let guardado: string | null = null;
    try {
      guardado = sessionStorage.getItem(CHAVE_CODIGO_TELA);
    } catch {}
    const c = e ? codigoParaTela(guardado, e, Date.now()) : null;
    if (c) setCodigoNaTela(c);
  }, []);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    const token = codigo.replace(/\s/g, "");
    if (!isValidEmail(email.trim())) return setError("Digite o e-mail da conta.");
    if (!codigoRecuperacaoValido(token)) return setError("Digite o código de 6 dígitos que chegou no seu e-mail.");
    const supabase = createClient();
    if (!supabase) return router.push("/auth/reset");
    setLoading(true);
    try {
      const { error: e } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: "recovery" });
      if (e) return setError(MSG_CODIGO_RECUPERACAO_INVALIDO);
      try {
        sessionStorage.removeItem(CHAVE_CODIGO_TELA);
      } catch {}
      router.push("/auth/reset");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md" data-testid="reset-codigo">
        <Logo href="/" />
        <h1 className="mt-12 font-title text-2xl font-semibold text-ink">Redefinir senha com o código</h1>
        <p className="mt-2 text-sm text-muted">
          Digite o e-mail da conta e o código de 6 dígitos que enviamos. Ele vale por {TEXTO_VALIDADE_CODIGO} e só funciona uma vez.
        </p>
        {codigoNaTela && (
          <div className="mt-6 rounded-xl border border-sage-200 bg-sage-100 p-4" data-testid="reset-codigo-exibido" role="status">
            <p className="text-sm text-muted">Conta de teste: o seu código de recuperação é</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-widest text-ink" data-testid="reset-codigo-valor">{codigoNaTela}</p>
            <p className="mt-1 text-xs text-muted">Vale por {TEXTO_VALIDADE_CODIGO} e só funciona uma vez. Também enviamos por e-mail.</p>
          </div>
        )}
        <form onSubmit={enviar} className="mt-6 space-y-4">
          <label className="flex items-center gap-2 rounded-xl border border-sage-200 bg-white px-4 focus-within:border-sage">
            <Mail className="h-4 w-4 text-muted" aria-hidden />
            <input type="email" autoComplete="email" required aria-label="E-mail da conta" placeholder="E-mail da conta" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11 w-full bg-transparent text-base outline-none sm:text-sm" data-testid="reset-codigo-email" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-sage-200 bg-white px-4 focus-within:border-sage">
            <KeyRound className="h-4 w-4 text-muted" aria-hidden />
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} required aria-label="Código de 6 dígitos" placeholder="Código de 6 dígitos" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/[^\d\s]/g, ""))} className="min-h-11 w-full bg-transparent text-base outline-none sm:text-sm" data-testid="reset-codigo-codigo" />
          </label>
          {error && <p className="text-sm text-red-600" role="alert" data-testid="reset-codigo-erro">{error}</p>}
          <Button type="submit" className={`w-full ${PRIMARIO_PORTA}`} aria-busy={loading} disabled={loading} data-testid="reset-codigo-enviar">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Continuar
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/auth" className="hover:text-forest">Pedir um novo código</Link>
        </p>
      </div>
    </div>
  );
}
