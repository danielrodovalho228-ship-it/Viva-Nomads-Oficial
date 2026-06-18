"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError, MIN_PASSWORD } from "@/lib/auth-errors";

/**
 * Redefinição de senha (Atualização 20.3) — destino do link enviado por e-mail.
 * O Supabase cria uma sessão de recuperação ao abrir o link; aqui o usuário
 * define a nova senha e é levado ao login.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
      setDone(true);
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
        {done ? (
          <div className="mt-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-100">
              <CheckCircle2 className="h-7 w-7 text-forest" />
            </div>
            <h1 className="mt-4 font-title text-2xl font-bold text-ink">Senha redefinida</h1>
            <p className="mt-2 text-sm text-muted">
              Tudo certo! Você já pode entrar com a nova senha. Redirecionando…
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-10 font-title text-2xl font-bold text-ink">Criar nova senha</h1>
            <p className="mt-2 text-sm text-muted">
              Escolha uma nova senha para sua conta. Mínimo de {MIN_PASSWORD} caracteres.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Field
                placeholder="Nova senha"
                value={password}
                onChange={setPassword}
              />
              <Field
                placeholder="Confirmar nova senha"
                value={confirm}
                onChange={setConfirm}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar nova senha
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sage-200 bg-white px-4 py-3 focus-within:border-sage">
      <Lock className="h-4 w-4 text-sage" />
      <input
        type="password"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
      />
    </div>
  );
}
