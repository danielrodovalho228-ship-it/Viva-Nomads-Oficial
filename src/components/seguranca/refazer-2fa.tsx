"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useCaptcha } from "@/components/seguranca/captcha";
import { MSG_CAPTCHA_PENDENTE, comCaptcha, podeEnviar } from "@/lib/seguranca/captcha";
import { friendlyAuthError } from "@/lib/auth-errors";
import { confirmarRefazer, pedirCodigoRefazer } from "@/lib/seguranca/recuperacao-actions";

const CAMPO = "h-12 w-full rounded-xl border border-sage-300 bg-white px-4 text-ink focus:border-forest focus:outline-none";

/** Passo 1: senha (confere de verdade no Supabase). Passo 2: código de 6 dígitos que chegou por e-mail. */
export function RefazerDuasEtapasForm({ email }: { email: string }) {
  const [passo, setPasso] = useState<"senha" | "codigo">("senha");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const captcha = useCaptcha();

  async function enviarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!podeEnviar(captcha.ligado, captcha.token)) return setErro(MSG_CAPTCHA_PENDENTE);
    const supabase = createClient();
    if (!supabase) return setErro("Indisponível agora.");
    setOcupado(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha, options: comCaptcha({}, captcha.token) });
    captcha.reset();
    if (error) {
      setOcupado(false);
      return setErro(friendlyAuthError(error.message));
    }
    const r = await pedirCodigoRefazer();
    setOcupado(false);
    setSenha("");
    if (!r.ok) return setErro(r.error);
    setPasso("codigo");
  }

  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    const r = await confirmarRefazer(codigo);
    setOcupado(false);
    if (!r.ok) return setErro(r.error);
    window.location.assign(r.proximo);
  }

  if (passo === "senha") {
    return (
      <form onSubmit={enviarSenha} className="mt-6 space-y-4 text-left">
        <p className="text-sm text-muted">Conta: <strong>{email}</strong></p>
        <label htmlFor="senha-refazer" className="block text-sm font-medium text-ink">Sua senha</label>
        <input id="senha-refazer" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={CAMPO} />
        {captcha.widget && <div className="flex justify-center">{captcha.widget}</div>}
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
        <Button type="submit" className="w-full" disabled={ocupado || !senha}>
          {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar senha e enviar código por e-mail
        </Button>
      </form>
    );
  }
  return (
    <form onSubmit={enviarCodigo} className="mt-6 space-y-4 text-left">
      <p role="status" className="text-sm text-muted">Enviamos um código de 6 números para <strong>{email}</strong>. Vale por 15 minutos.</p>
      <label htmlFor="codigo-refazer" className="block text-sm font-medium text-ink">Código do e-mail</label>
      <input id="codigo-refazer" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/[^\d\s]/g, ""))} className={`${CAMPO} text-center text-xl tracking-[0.4em]`} placeholder="000000" />
      <p className="text-xs text-muted">Ao confirmar, o app autenticador antigo é desligado e você cadastra um novo.</p>
      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
      <Button type="submit" className="w-full" disabled={ocupado || codigo.replace(/\s/g, "").length !== 6}>
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Confirmar e refazer
      </Button>
    </form>
  );
}
