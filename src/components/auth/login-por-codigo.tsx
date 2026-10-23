"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail } from "@/lib/auth-errors";
import { ATRIBUTOS_EMAIL } from "@/lib/login-celular";
import { useCaptcha } from "@/components/seguranca/captcha";
import { MSG_CAPTCHA_PENDENTE, podeEnviar } from "@/lib/seguranca/captcha";
import {
  MSG_CODIGO_VENCIDO,
  codigoCompleto,
  codigoVencido,
  contaNova,
  mensagemVerificarCodigo,
  normalizarCodigo,
  segundosParaReenviar,
  tentativasRestantes,
} from "@/lib/seguranca/codigo-acesso";

/**
 * Entrada única do Viva Nomads (Prompt 49): um campo de e-mail e "Continuar". O código de 6 dígitos sai por
 * /api/auth/codigo (limite de envios no servidor; entra E cria conta, sem senha) e é conferido aqui com verifyOtp.
 * Vale 10 minutos; vencido, pedimos outro sozinhos. Reenvio com espera de 60 s; 5 códigos errados travam a tela
 * até pedir um novo. A mesma tela aparece com ou sem conta: nunca revela se o e-mail existe.
 */
export function LoginPorCodigo({
  email,
  onEmail,
  onVoltar,
  onEntrou,
  indicacao,
  motivo,
}: {
  email: string;
  onEmail: (v: string) => void;
  /** Só quando a tela foi aberta a partir de outra (ex.: "Entrar com senha" → código). */
  onVoltar?: () => void;
  /** Sessão criada: a página guarda o usuário e navega (conta nova passa pela tela de intenção). */
  onEntrou: (u: { id: string; email: string; nome?: string; papel?: string; novo: boolean }) => void;
  /** Código de indicação do link ?ref= (vai para a conta nova). */
  indicacao?: string;
  /** Por que a conta é pedida agora (momento de valor), ex.: "Para enviar seu pedido, entre com seu e-mail". */
  motivo?: string | null;
}) {
  const captcha = useCaptcha();
  const [enviadoEm, setEnviadoEm] = useState<number | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erradas, setErradas] = useState(0);
  const [espera, setEspera] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ocupado = useRef(false);

  useEffect(() => {
    if (enviadoEm == null) return;
    const atualiza = () => setEspera(segundosParaReenviar(enviadoEm, Date.now()));
    atualiza();
    const t = setInterval(atualiza, 1000);
    return () => clearInterval(t);
  }, [enviadoEm]);

  /** Pede o código ao servidor. Devolve true se saiu (ou se a resposta neutra disse que saiu). */
  async function enviar(): Promise<boolean> {
    const resp = await fetch("/api/auth/codigo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), captchaToken: captcha.token, indicacao: indicacao || undefined }),
    });
    const r = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!resp.ok || !r.ok) {
      setErro(r.error || "Não foi possível enviar o código agora. Tente novamente em instantes.");
      return false;
    }
    setCodigo("");
    setErradas(0);
    setEnviadoEm(Date.now());
    return true;
  }

  async function pedirCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    if (ocupado.current) return;
    setErro(null);
    setAviso(null);
    if (!isValidEmail(email.trim())) {
      setErro("Digite um e-mail válido para receber o código.");
      return;
    }
    if (!podeEnviar(captcha.ligado, captcha.token)) {
      setErro(MSG_CAPTCHA_PENDENTE);
      return;
    }
    ocupado.current = true;
    setCarregando(true);
    try {
      await enviar();
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
    setAviso(null);
    if (!codigoCompleto(codigo)) {
      setErro("Digite os 6 dígitos do código.");
      return;
    }
    if (tentativasRestantes(erradas) === 0) {
      setErro("Muitas tentativas erradas. Peça um novo código.");
      return;
    }
    // Passou dos 10 minutos: o código não vale mais. Pede outro sozinho (se o CAPTCHA deixar) e diz a causa.
    if (enviadoEm != null && codigoVencido(enviadoEm, Date.now())) {
      if (podeEnviar(captcha.ligado, captcha.token)) {
        ocupado.current = true;
        setCarregando(true);
        try {
          if (await enviar()) setAviso(MSG_CODIGO_VENCIDO);
        } finally {
          ocupado.current = false;
          setCarregando(false);
          captcha.reset();
        }
      } else {
        setErro("Código vencido: confirme a verificação abaixo e toque em Reenviar código.");
      }
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
        novo: contaNova(u.created_at, Date.now()),
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
      {onVoltar && (
        <button type="button" onClick={onVoltar} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-forest hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      )}
      <h2 className="mt-6 font-title text-2xl font-semibold text-ink">{enviado ? "Digite o código" : "Entre ou crie sua conta"}</h2>
      {motivo && !enviado && (
        <p className="mt-2 text-sm font-medium text-ink" data-testid="entrada-motivo">
          {motivo}
        </p>
      )}
      <p className="mt-2 text-sm text-muted">
        {enviado
          ? `Enviamos um código de 6 dígitos para ${email.trim()}. Ele vale por 10 minutos.`
          : "Sem senha: enviamos um código de 6 dígitos para o seu e-mail. Se ainda não tem conta, ela é criada aqui."}
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
              aria-label="E-mail"
              {...ATRIBUTOS_EMAIL}
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            />
          </div>
          {erro && (
            <p role="alert" data-testid="auth-erro" className="text-sm text-red-600">
              {erro}
            </p>
          )}
          {captcha.widget}
          <Button type="submit" className="w-full" data-testid="entrada-continuar" disabled={carregando || !podeEnviar(captcha.ligado, captcha.token)}>
            {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
            Continuar
          </Button>
          <p className="text-xs text-muted">
            Ao continuar, você aceita os{" "}
            <a href="/termos" target="_blank" className="font-medium text-forest underline">
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a href="/privacidade" target="_blank" className="font-medium text-forest underline">
              Política de Privacidade
            </a>
            .
          </p>
        </form>
      ) : (
        <form onSubmit={conferir} method="post" className="mt-6 space-y-4">
          {aviso ? (
            <p className="flex items-start gap-2 rounded-lg bg-sage-100 px-3 py-2 text-sm text-forest" data-testid="codigo-aviso">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" /> {aviso}
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-lg bg-sage-100 px-3 py-2 text-sm text-forest">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" /> Código enviado para {email.trim()}.
            </p>
          )}
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
          {erro && (
            <p role="alert" data-testid="auth-erro" className="text-sm text-red-600">
              {erro}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={carregando || !codigoCompleto(codigo) || tentativasRestantes(erradas) === 0}>
            {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar
          </Button>
          {captcha.widget}
          <button
            type="button"
            onClick={() => pedirCodigo()}
            disabled={carregando || espera > 0 || !podeEnviar(captcha.ligado, captcha.token)}
            className="min-h-11 w-full text-center text-sm font-medium text-forest hover:text-blue-700 disabled:cursor-not-allowed disabled:text-muted"
          >
            {espera > 0 ? `Reenviar código em ${espera} s` : "Reenviar código"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEnviadoEm(null);
              setErro(null);
              setAviso(null);
            }}
            className="min-h-11 w-full text-center text-sm text-muted hover:text-ink"
          >
            Usar outro e-mail
          </button>
          <p className="text-center text-xs text-muted">Não pediu este código? Ignore o e-mail: ninguém entra sem ele.</p>
        </form>
      )}
    </div>
  );
}
