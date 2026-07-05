"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  User,
  Mail,
  Lock,
  Globe,
  Calculator,
  Loader2,
  CheckCircle2,
  Gift,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { BrandImage } from "@/components/brand-image";
import { PHOTOS } from "@/lib/media";
import { TaxSimulator } from "@/components/tax-simulator";
import { useAuthStore } from "@/lib/store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { SITE_URL } from "@/lib/site";
import { friendlyAuthError, isEmailSendError, isValidEmail, MIN_PASSWORD } from "@/lib/auth-errors";
import type { UserRole } from "@/lib/types";
import type { PersonType } from "@/lib/tax";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup" | "forgot";

export default function AuthPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [mode, setMode] = useState<Mode>("login");
  // Sem papel pré-selecionado: o usuário escolhe conscientemente proprietário
  // OU inquilino no cadastro (evita criar proprietário sem querer).
  const [role, setRole] = useState<UserRole | null>(null);
  const [personType, setPersonType] = useState<PersonType>("pf");
  const [showSimulator, setShowSimulator] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false); // aceite explícito no cadastro
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // pós-cadastro / reset enviado
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  // Login falhou porque NÃO existe conta com este e-mail → oferece cadastro
  // (em vez de "e-mail ou senha incorretos", que faz o usuário resetar senha à toa).
  const [semConta, setSemConta] = useState(false);

  // Destino pós-login: honra ?redirect=… (definido pelo proxy ao barrar rota
  // protegida), aceitando SÓ caminhos internos ("/algo") — nunca URLs externas
  // (evita open redirect). Lê window.location no clique (client-only) para não
  // exigir Suspense e manter /auth estático.
  function postAuthTarget(): string {
    if (typeof window === "undefined") return "/dashboard";
    const r = new URLSearchParams(window.location.search).get("redirect");
    if (r && r.startsWith("/") && !r.startsWith("//")) return r;
    return "/dashboard";
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setNotice(null);
    setAwaitingConfirm(false);
    setSemConta(false);
  }

  /**
   * Blindagem contra "spinner infinito": se o Supabase não responder em ~20s
   * (projeto pausado, rede bloqueada, credenciais de ambiente erradas), a
   * promessa nunca resolveria e o botão giraria para sempre. Aqui forçamos um
   * erro claro para o usuário — em vez de travar a tela.
   */
  function withTimeout<T>(promise: PromiseLike<T>, ms = 20000): Promise<T> {
    return Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "O servidor de acesso não respondeu. Verifique sua conexão e tente novamente."
              )
            ),
          ms
        )
      ),
    ]);
  }

  async function handleGoogle() {
    const supabase = createClient();
    if (!supabase) {
      setError("Login com Google requer Supabase configurado.");
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${SITE_URL}/auth/callback` },
    });
  }

  /** Reenvia o e-mail de confirmação (Atualização 20.4). */
  async function resendConfirmation() {
    const supabase = createClient();
    setError(null);
    if (!supabase) {
      setNotice("Modo demonstração: e-mail de confirmação não é enviado.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        // O link reenviado volta para o callback do site (igual ao cadastro).
        options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
      });
      if (error) throw error;
      setNotice(
        "Reenviamos o e-mail de confirmação. Verifique a caixa de entrada e o spam. " +
          "Se não chegar e a conta já estiver confirmada, é só entrar."
      );
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  }

  /** Recuperação de senha (Atualização 20.3). */
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setError("Digite um e-mail válido para receber o link.");
      return;
    }
    const supabase = createClient();
    setLoading(true);
    try {
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${SITE_URL}/auth/reset`,
        });
        if (error) throw error;
      }
      setNotice(
        "Enviamos um link de recuperação para seu e-mail. Abra-o para definir uma nova senha."
      );
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  }

  /** Validação local antes de enviar (Atualizações 20.1 e 20.2). */
  function validate(): string | null {
    if (!isValidEmail(email)) return "E-mail inválido. Confira o endereço digitado.";
    if (mode === "signup") {
      if (!role) return "Escolha se você é proprietário ou inquilino.";
      if (name.trim().length < 2) return "Informe seu nome completo.";
      if (password.length < MIN_PASSWORD)
        return `A senha deve ter pelo menos ${MIN_PASSWORD} caracteres.`;
      if (password !== confirmPassword) return "A senha e a confirmação não coincidem.";
      if (!acceptedTerms) return "É preciso aceitar os Termos de Uso e a Política de Privacidade.";
    } else if (!password) {
      return "Digite sua senha.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSemConta(false);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    try {
      if (supabase) {
        if (mode === "signup") {
          const { data, error } = await withTimeout(
            supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  full_name: name,
                  role,
                  person_type: personType,
                  referred_by: referral || null,
                },
                emailRedirectTo: `${SITE_URL}/auth/callback`,
              },
            })
          );
          if (error) throw error;
          // E-mail JÁ cadastrado: com "Confirm email" ligado, o Supabase NÃO
          // devolve erro no signUp — retorna um usuário "ofuscado" sem
          // identities (anti-enumeração interna). Sem checar isso, um e-mail
          // repetido cairia na tela "confirme seu e-mail" em vez de avisar que
          // a conta já existe (Caso 3 do QA). Aqui o sinal é claro ao usuário.
          if (data.user && data.user.identities && data.user.identities.length === 0) {
            setError("Este e-mail já possui uma conta. Faça login ou recupere a senha.");
            setLoading(false);
            return;
          }
          // Sem sessão imediata = precisa confirmar o e-mail (Atualização 20.4).
          if (!data.session) {
            setAwaitingConfirm(true);
            setLoading(false);
            return;
          }
        } else {
          const { data, error } = await withTimeout(
            supabase.auth.signInWithPassword({ email, password })
          );
          if (error) {
            const m = (error.message || "").toLowerCase();
            // E-mail ainda não confirmado → orienta a confirmar (não é senha errada).
            if (m.includes("not confirmed") || m.includes("confirm")) {
              setError("Seu e-mail ainda não foi confirmado. Verifique a caixa de entrada (e o spam).");
              setLoading(false);
              return;
            }
            // Credenciais inválidas: descobre se é conta INEXISTENTE (pede cadastro)
            // ou senha incorreta (conta existe). Degrada para o genérico se a RPC
            // ainda não estiver aplicada no banco.
            let existe = true;
            try {
              const { data: ex } = await supabase.rpc("email_existe", { e: email });
              if (ex === false) existe = false;
            } catch {
              /* migração 0031 ausente — mantém comportamento genérico */
            }
            if (!existe) {
              setSemConta(true);
              setError(null);
              setLoading(false);
              return;
            }
            throw error; // conta existe → senha incorreta (mensagem padrão)
          }
          // Seta o usuário SÍNCRONO a partir da sessão VALIDADA pelo Supabase —
          // não é "fabricar" sessão (o login já passou). Sem isto, o painel
          // dependia do AuthProvider (assíncrono) e o AuthGuard podia quicar de
          // volta para /auth (hidratado && sem usuário) — o login "não entrava".
          const u = data.user;
          if (u) {
            setUser({
              id: u.id,
              name: (u.user_metadata?.full_name as string | undefined) ?? u.email ?? "Usuário",
              fullName: u.user_metadata?.full_name as string | undefined,
              email: u.email ?? "",
              role: (u.user_metadata?.role as UserRole) ?? "tenant",
            });
          }
        }
        // Navega já com o usuário na store (o AuthProvider enriquece depois).
        router.push(postAuthTarget());
        return;
      }

      // Sem Supabase configurado (apenas dev/preview): sessão de demonstração
      // local. Em produção o Supabase está sempre presente, então este caminho
      // não existe — não há porta dos fundos de demo no acesso real.
      setUser({
        id: crypto.randomUUID(),
        name: name || email,
        fullName: name || undefined,
        email,
        role: role ?? "tenant",
      });
      router.push(postAuthTarget());
    } catch (err) {
      // Diagnóstico (DevTools do navegador) — erro COMPLETO do Supabase, não
      // exposto ao usuário. status/code identificam a causa real (trigger de
      // profiles, e-mail duplicado, SMTP de confirmação, etc.).
      const e = err as { message?: string; status?: number; code?: string; name?: string };
      console.error("[auth] falha no cadastro/login:", {
        mode,
        name: e?.name,
        status: e?.status,
        code: e?.code,
        message: e?.message,
        error: err,
      });
      const msg = err instanceof Error ? err.message : "";
      // Cadastro com falha de ENVIO do e-mail de confirmação: a conta foi
      // criada — leva à tela "verifique seu e-mail" (com reenviar), não a erro.
      if (mode === "signup" && isEmailSendError(msg)) {
        setNotice(
          "Conta criada! Não conseguimos enviar o e-mail de confirmação agora — use “Reenviar” abaixo."
        );
        setAwaitingConfirm(true);
      } else {
        setError(friendlyAuthError(msg));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Lado da marca — foto distinta para login e cadastro (plano C1/C2) */}
      <div className="relative hidden overflow-hidden lg:block">
        <BrandImage
          src={mode === "login" ? PHOTOS.authLogin : PHOTOS.authSignup}
          alt={
            mode === "login"
              ? "Profissional trabalhando concentrado em apartamento mobiliado ao anoitecer"
              : "Pessoa abrindo a porta de um novo apartamento mobiliado, mala ao lado"
          }
          rounded="rounded-none"
          sizes="50vw"
          priority
          treat={false}
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-night/65" />
        <div className="absolute inset-0 flex flex-col justify-between p-12 text-white">
          <Logo href="/home" light />
          <div>
            <h1 className="font-title text-4xl font-bold leading-tight">
              {mode === "login" ? "Bem-vindo de volta." : "Sua nova fase começa aqui."}
            </h1>
            <p className="mt-4 max-w-md text-white/75">
              Locação mobiliada por temporada para profissionais em transição. Estadia de
              meses, com contrato de verdade e inquilino verificado.
            </p>
          </div>
          <p className="text-sm text-white/50">Locação por temporada · art. 48, Lei 8.245/91</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo href="/home" />
          </div>

          {/* ── Pós-cadastro: confirmar e-mail (Atualização 20.4) ── */}
          {awaitingConfirm ? (
            <div className="text-center">
              <div className="mx-auto mt-4 grid h-14 w-14 place-items-center rounded-full bg-sage-100">
                <Mail className="h-7 w-7 text-forest" />
              </div>
              <h2 className="mt-4 font-title text-2xl font-bold text-ink">Confirme seu e-mail</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                Enviamos um link de confirmação para <strong className="text-ink">{email}</strong>.
                Abra-o para ativar sua conta e poder entrar.
              </p>
              {notice && (
                <p className="mt-4 rounded-lg bg-sage-100 px-3 py-2 text-sm text-forest">{notice}</p>
              )}
              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
              <Button
                variant="outline"
                className="mt-6 w-full"
                onClick={resendConfirmation}
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Reenviar e-mail de confirmação
              </Button>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar para entrar
              </button>
            </div>
          ) : mode === "forgot" ? (
            /* ── Recuperação de senha (Atualização 20.3) ── */
            <div>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar para entrar
              </button>
              <h2 className="mt-6 font-title text-2xl font-bold text-ink">Recuperar senha</h2>
              <p className="mt-2 text-sm text-muted">
                Informe seu e-mail e enviaremos um link seguro para criar uma nova senha.
              </p>
              <form onSubmit={handleForgot} method="post" className="mt-6 space-y-4">
                <Input
                  icon={Mail}
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={setEmail}
                  required
                  name="email"
                  autoComplete="email"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                {notice && (
                  <p className="flex items-start gap-2 rounded-lg bg-sage-100 px-3 py-2 text-sm text-forest">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar link de recuperação
                </Button>
              </form>
            </div>
          ) : (
            <>
              {/* Abas */}
              <div className="flex rounded-full bg-surface-2 p-1">
                {(["login", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={cn(
                      "flex-1 rounded-full py-2.5 text-sm font-medium transition-colors",
                      mode === m ? "bg-forest text-white" : "text-muted hover:text-forest"
                    )}
                  >
                    {m === "login" ? "Entrar" : "Cadastrar"}
                  </button>
                ))}
              </div>

              <h2 className="mt-8 font-title text-2xl font-bold text-ink">
                {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
              </h2>

              {/* Seletor de perfil (cadastro) */}
              {mode === "signup" && (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <RoleCard
                    active={role === "owner"}
                    onClick={() => setRole("owner")}
                    icon={Building2}
                    title="Sou Proprietário"
                    text="Quero anunciar imóveis"
                  />
                  <RoleCard
                    active={role === "tenant"}
                    onClick={() => setRole("tenant")}
                    icon={User}
                    title="Sou Inquilino"
                    text="Quero alugar um imóvel"
                  />
                </div>
              )}

              {/* PF/PJ — só para proprietário (Atualização 2) */}
              {mode === "signup" && role === "owner" && (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-medium text-ink">
                    Como você vai receber os aluguéis?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <RoleCard
                      active={personType === "pf"}
                      onClick={() => setPersonType("pf")}
                      icon={User}
                      title="Pessoa Física"
                      text="CPF"
                    />
                    <RoleCard
                      active={personType === "pj"}
                      onClick={() => setPersonType("pj")}
                      icon={Building2}
                      title="Pessoa Jurídica"
                      text="CNPJ"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSimulator((v) => !v)}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:text-blue-700"
                  >
                    <Calculator className="h-4 w-4" />
                    {showSimulator ? "Fechar simulador" : "Não sei qual escolher? Simule aqui"}
                  </button>
                  {showSimulator && (
                    <div className="mt-3">
                      <TaxSimulator />
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} method="post" className="mt-6 space-y-4">
                {mode === "signup" && (
                  <Input
                    icon={User}
                    type="text"
                    placeholder="Nome completo"
                    value={name}
                    onChange={setName}
                    required
                  />
                )}
                <Input
                  icon={Mail}
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={setEmail}
                  required
                  name="email"
                  autoComplete="email"
                />
                <Input
                  icon={Lock}
                  type="password"
                  placeholder={mode === "signup" ? `Senha (mín. ${MIN_PASSWORD} caracteres)` : "Senha"}
                  value={password}
                  onChange={setPassword}
                  required
                  name="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                {mode === "signup" && (
                  <>
                    <Input
                      icon={Lock}
                      type="password"
                      placeholder="Confirmar senha"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      required
                      name="confirm-password"
                      autoComplete="new-password"
                    />
                    {showReferral ? (
                      <Input
                        icon={Gift}
                        type="text"
                        placeholder="Código de indicação"
                        value={referral}
                        onChange={setReferral}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowReferral(true)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:text-blue-700"
                      >
                        <Gift className="h-4 w-4" /> Tenho um código de indicação
                      </button>
                    )}
                  </>
                )}

                {mode === "login" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-sm font-medium text-forest hover:text-blue-700"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}

                {/* Aceite explícito dos Termos e da Privacidade (obrigatório no cadastro). */}
                {mode === "signup" && (
                  <label className="flex items-start gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      required
                      aria-label="Aceito os Termos de Uso e a Política de Privacidade"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
                    />
                    <span>
                      Li e aceito os{" "}
                      <a href="/termos" target="_blank" className="font-medium text-forest underline">
                        Termos de Uso
                      </a>{" "}
                      e a{" "}
                      <a
                        href="/privacidade"
                        target="_blank"
                        className="font-medium text-forest underline"
                      >
                        Política de Privacidade
                      </a>
                      .
                    </span>
                  </label>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}

                {/* Não há conta com este e-mail → convida a cadastrar (em vez de
                    ficar tentando senha/recuperação). */}
                {semConta && mode === "login" && (
                  <div className="rounded-xl border border-sage-200 bg-surface-2 p-4 text-sm">
                    <p className="font-medium text-ink">Ainda não há conta com este e-mail.</p>
                    <p className="mt-1 text-muted">
                      Confira se digitou certo — ou crie uma conta agora, é rápido.
                    </p>
                    <Button
                      type="button"
                      variant="gold"
                      className="mt-3 w-full"
                      onClick={() => switchMode("signup")}
                    >
                      Criar conta com {email}
                    </Button>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || (mode === "signup" && !acceptedTerms)}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-sage-200" /> ou{" "}
                <span className="h-px flex-1 bg-sage-200" />
              </div>
              <Button
                variant="outline"
                className="w-full"
                type="button"
                disabled={loading}
                onClick={handleGoogle}
              >
                <Globe className="h-4 w-4" /> Continuar com Google
              </Button>
            </>
          )}

          {!isSupabaseConfigured && (
            <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
              Modo demonstração: Supabase ainda não configurado. O login simula a sessão
              localmente.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  active,
  onClick,
  icon: Icon,
  title,
  text,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border-2 p-4 text-left transition-colors",
        active ? "border-forest bg-sage-100" : "border-sage-200 hover:border-sage"
      )}
    >
      <Icon className={cn("h-6 w-6", active ? "text-forest" : "text-sage")} />
      <p className="mt-2 font-title text-sm font-bold text-ink">{title}</p>
      <p className="text-xs text-muted">{text}</p>
    </button>
  );
}

function Input({
  icon: Icon,
  type,
  placeholder,
  value,
  onChange,
  required,
  name,
  autoComplete,
}: {
  icon: React.ComponentType<{ className?: string }>;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  name?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sage-200 bg-white px-4 py-3 focus-within:border-sage">
      <Icon className="h-4 w-4 text-sage" />
      <input
        type={isPassword && show ? "text" : type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        name={name}
        autoComplete={autoComplete}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
      />
      {isPassword && (
        <button
          type="button"
          // Segurança: revela a senha só ENQUANTO pressionado (segure para ver).
          onMouseDown={() => setShow(true)}
          onMouseUp={() => setShow(false)}
          onMouseLeave={() => setShow(false)}
          onTouchStart={() => setShow(true)}
          onTouchEnd={() => setShow(false)}
          onTouchCancel={() => setShow(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShow(true);
            }
          }}
          onKeyUp={() => setShow(false)}
          onBlur={() => setShow(false)}
          aria-label="Segure para ver a senha"
          title="Segure para ver a senha"
          className="shrink-0 text-muted transition-colors hover:text-ink"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
