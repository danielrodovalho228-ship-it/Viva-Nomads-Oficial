"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError, MIN_PASSWORD } from "@/lib/auth-errors";

type Phase = "checking" | "ready" | "invalid" | "done";

/**
 * Redefinição de senha (destino do link enviado por e-mail).
 *
 * O link de recuperação chega como `?code=...` (PKCE). É preciso TROCAR esse
 * código por uma sessão de recuperação (`exchangeCodeForSession`) ANTES de
 * `updateUser` — sem isso, salvar a nova senha falha ("sessão ausente"). Link
 * expirado/já usado → mensagem clara, não tela de erro genérica.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estabelece a sessão de recuperação a partir do link antes de mostrar o form.
  useEffect(() => {
    const supabase = createClient();
    // Modo demonstração (sem Supabase): segue direto para o formulário.
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("ready");
      return;
    }
    (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setPhase("ready");
          return;
        }
        // Pode já ter sido trocado pelo cliente (detectSessionInUrl) — confirma.
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setPhase(session ? "ready" : "invalid");
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`A senha deve ter pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("A senha e a confirmação não coincidem.");
      return;
    }
    const supabase = createClient();
    setLoading(true);
    try {
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      }
      setPhase("done");
      setTimeout(() => router.push("/auth"), 2500);
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Logo href="/home" />

        {phase === "checking" && (
          <div className="mt-12 flex items-center justify-center gap-2 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" /> Validando o link…
          </div>
        )}

        {phase === "invalid" && (
          <div className="mt-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50">
              <AlertTriangle className="h-7 w-7 text-amber-600" />
            </div>
            <h1 className="mt-4 font-title text-2xl font-bold text-ink">Link inválido ou expirado</h1>
            <p className="mt-2 text-sm text-muted">
              Este link de recuperação não é mais válido (pode ter expirado ou já ter sido usado).
              Peça um novo para redefinir sua senha.
            </p>
            <ButtonLink href="/auth" className="mt-6">
              Pedir novo link
            </ButtonLink>
          </div>
        )}

        {phase === "done" && (
          <div className="mt-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-100">
              <CheckCircle2 className="h-7 w-7 text-forest" />
            </div>
            <h1 className="mt-4 font-title text-2xl font-bold text-ink">Senha redefinida</h1>
            <p className="mt-2 text-sm text-muted">
              Tudo certo! Você já pode entrar com a nova senha. Redirecionando…
            </p>
          </div>
        )}

        {phase === "ready" && (
          <>
            <h1 className="mt-10 font-title text-2xl font-bold text-ink">Criar nova senha</h1>
            <p className="mt-2 text-sm text-muted">
              Escolha uma nova senha para sua conta. Mínimo de {MIN_PASSWORD} caracteres.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <PasswordInput
                leadingIcon={Lock}
                placeholder="Nova senha"
                value={password}
                onChange={setPassword}
                required
                autoComplete="new-password"
                className="rounded-xl border border-sage-200 bg-white px-4 py-3 focus-within:border-sage"
                inputClassName="text-sm"
              />
              <PasswordInput
                leadingIcon={Lock}
                placeholder="Confirmar nova senha"
                value={confirm}
                onChange={setConfirm}
                required
                autoComplete="new-password"
                className="rounded-xl border border-sage-200 bg-white px-4 py-3 focus-within:border-sage"
                inputClassName="text-sm"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar nova senha
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted">
              <Link href="/auth" className="hover:text-forest">
                Voltar ao login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
