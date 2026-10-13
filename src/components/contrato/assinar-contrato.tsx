"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useCaptcha } from "@/components/seguranca/captcha";
import { MSG_CAPTCHA_PENDENTE, comCaptcha, podeEnviar } from "@/lib/seguranca/captcha";
import { assinarContrato } from "@/lib/data/contrato-assinar-actions";

/** “Li e concordo” + confirmação pela senha da conta (a mesma checagem da troca de senha) → assina. */
export function AssinarContrato({ contratoId }: { contratoId: string }) {
  const router = useRouter();
  const captcha = useCaptcha();
  const [aceite, setAceite] = useState(false);
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function assinar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!podeEnviar(captcha.ligado, captcha.token)) {
      setErro(MSG_CAPTCHA_PENDENTE);
      return;
    }
    setEnviando(true);
    try {
      const supabase = createClient();
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.email) {
          setErro("Sessão expirada. Entre de novo.");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: senha,
          options: comCaptcha({}, captcha.token),
        });
        if (error) {
          setErro("Senha incorreta.");
          return;
        }
      }
      const r = await assinarContrato({ contratoId, aceite });
      if (!r.ok) {
        setErro(r.error ?? "Não foi possível assinar.");
        return;
      }
      router.refresh();
    } finally {
      captcha.reset();
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={assinar} className="mt-5 space-y-3 border-t border-line pt-4" data-testid="form-assinar">
      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={aceite}
          onChange={(e) => setAceite(e.target.checked)}
          className="mt-0.5 h-4 w-4"
          data-testid="assinar-aceite"
        />
        Li e concordo com o contrato acima.
      </label>
      <div>
        <label htmlFor="assinar-senha" className="block text-sm font-medium text-ink">
          Sua senha, para confirmar
        </label>
        <input
          id="assinar-senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mt-1 w-full max-w-sm rounded-xl border border-line bg-white px-3 py-2.5 text-base"
        />
      </div>
      {captcha.widget && <div>{captcha.widget}</div>}
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
      <Button type="submit" variant="gold" disabled={!aceite || senha.length === 0 || enviando} data-testid="assinar-enviar">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar contrato"}
      </Button>
    </form>
  );
}
