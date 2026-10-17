"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail } from "@/lib/auth-errors";
import { useCaptcha } from "@/components/seguranca/captcha";
import { MSG_CAPTCHA_PENDENTE, comCaptcha, podeEnviar } from "@/lib/seguranca/captcha";
import {
  codigoCompleto,
  mensagemEnvioCodigo,
  mensagemVerificarCodigo,
  normalizarCodigo,
  segundosParaReenviar,
  tentativasRestantes,
} from "@/lib/seguranca/codigo-acesso";

/**
 * "Entrar com código por e-mail" (ordem d250ea2f, item 4): sem senha. Pede o código de 6 dígitos
 * (shouldCreateUser=false: não cria conta; quem não tem conta usa o cadastro) e confere com verifyOtp.
 * Reenvio com espera de 60 s; 5 códigos errados travam esta tela até pedir um novo.
 */
export function LoginPorCodigo({
  email,
  onEmail,
  onVoltar,
  onEntrou,
}: {
  email: string;
  onEmail: (v: string) => void;
  onVoltar: () => void;
  /** Sessão criada: a página guarda o usuário e navega para o destino. */
  onEntrou: (u: { id: string; email: string; nome?: string; papel?: string }) => void;
}) {
  const captcha = useCaptcha();
  const [enviadoEm, setEnviadoEm] = useState<number | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erradas, setErradas] = useState(0);
  const [espera, setEspera] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ocupado = useRef(false);

  useEffect(() => {
    if (enviadoEm == null) return;
    const atualiza = () => setEspera(segundosParaReenviar(enviadoEm, Date.now()));
    atualiza();
    const t = setInterval(atualiza, 1000);
    return () => clearInterval(t);
  }, [enviadoEm]);

  async function pedirCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    if (ocupado.current) return;
    setErro(null);
    const alvo = email.trim();
    if (!isValidEmail(alvo)) {
      setErro("Digite um e-mail válido para receber o código.");
      return;
    }
    if (!podeEnviar(captcha.ligado, captcha.token)) {
      setErro(MSG_CAPTCHA_PENDENTE);
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setErro("Entrar por código não está disponível neste ambiente.");
      return;
    }
    ocupado.current = true;
    setCarregando(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: alvo,
        options: comCaptcha({ shouldCreateUser: false }, captcha.token),
      });
      const msg = error ? mensagemEnvioCodigo(error.message || "") : null;
      if (msg) {
        setErro(msg);
        return;
      }
      // Mesma tela com ou sem conta: nunca revela se o e-mail existe.
      setCodigo("");
      setErradas(0);
      setEnviadoEm(Date.now());
    } catch {
      setErro("Não foi possível enviar o código agora. Tente novamente em instantes.");
    } finally {
      ocupado.current = false;
      setCarregando(false);
      captcha.reset();
    }
  }

  async function conferir(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado.current) return;
    setErro(null);
    if (!codigoCompleto(codigo)) {
      setErro("Digite os 6 dígitos do código.");
      return;
    }
    if (tentativasRestantes(erradas) === 0) {
      setErro("Muitas tentativas erradas. Peça um novo código.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    ocupado.current = true;
    setCarregando(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: codigo, type: "email" });
      if (error || !data.user) {
        setErradas((n) => n + 1);
        setErro(mensagemVerificarCodigo(error?.message || "invalid"));
        return;
      }
      const u = data.user;
      onEntrou({
        id: u.id,
        email: u.email ?? "",
        nome: u.user_metadata?.full_name as string | undefined,
        papel: u.user_metadata?.role as string | undefined,
      });
    } catch {
      setErro("Não foi possível entrar com o código agora. Tente novamente em instantes.");
    } finally {
      ocupado.current = false;
      setCarregando(false);
    }
  }

  const enviado = enviadoEm != null;
  return (
    <div data-testid="login-por-codigo">
      <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:text-blue-700">
        <ArrowLeft className="h-4 w-4" /> Voltar para entrar
      </button>
      <h2 className="mt-6 font-title text-2xl font-bold text-ink">Entrar com código</h2>
      <p className="mt-2 text-sm text-muted">
        {enviado
          ? "Se este e-mail tiver conta, enviamos um código de 6 dígitos. Digite-o abaixo; ele vale por poucos minutos."
          : "Sem senha: enviamos um código de 6 dígitos para o seu e-mail."}
      </p>

      {!enviado ? (
        <form onSubmit={pedirCodigo} method="post" className="mt-6 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-sage-200 bg-white px-4 py-3 focus-within:border-sage">
            <Mail className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="E-mail"
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {captcha.widget}
          <Button type="submit" className="w-full" disabled={carregando || !podeEnviar(captcha.ligado, captcha.token)}>
            {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar código
          </Button>
        </form>
      ) : (
        <form onSubmit={conferir} method="post" className="mt-6 space-y-4">
          <p className="flex items-start gap-2 rounded-lg bg-sage-100 px-3 py-2 text-sm text-forest">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Código enviado para {email.trim()}.
          </p>
          <input
            data-testid="campo-codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            name="codigo"
            maxLength={9}
            placeholder="000000"
            aria-label="Código de 6 dígitos"
            value={codigo}
            onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
            className="w-full rounded-xl border border-sage-200 bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-ink outline-none focus:border-sage"
          />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <Button type="submit" className="w-full" disabled={carregando || !codigoCompleto(codigo) || tentativasRestantes(erradas) === 0}>
            {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar
          </Button>
          {captcha.widget}
          <button
            type="button"
            onClick={() => pedirCodigo()}
            disabled={carregando || espera > 0 || !podeEnviar(captcha.ligado, captcha.token)}
            className="w-full text-center text-sm font-medium text-forest hover:text-blue-700 disabled:cursor-not-allowed disabled:text-muted"
          >
            {espera > 0 ? `Reenviar código em ${espera} s` : "Reenviar código"}
          </button>
          <p className="text-center text-xs text-muted">Não pediu este código? Ignore o e-mail: ninguém entra sem ele.</p>
        </form>
      )}
    </div>
  );
}

