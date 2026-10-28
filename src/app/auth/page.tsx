"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Globe, Loader2, CheckCircle2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { BrandImage } from "@/components/brand-image";
import { useAuthStore } from "@/lib/store";
import { resetPropertiesCache } from "@/lib/use-properties";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { SITE_URL } from "@/lib/site";
import { friendlyAuthError, isValidEmail } from "@/lib/auth-errors";
import type { UserRole } from "@/lib/types";
import { safeInternalPath } from "@/lib/safe-redirect";
import { ATRIBUTOS_EMAIL, limparEmail } from "@/lib/login-celular";
import { LOGIN_APPLE_ATIVO, LOGIN_GOOGLE_ATIVO } from "@/lib/flags";
import { useIsNative } from "@/lib/use-native";
import { registrarEvento } from "@/lib/eventos/registrar";
import { useCaptcha } from "@/components/seguranca/captcha";
import { MSG_CAPTCHA_PENDENTE, comCaptcha, podeEnviar } from "@/lib/seguranca/captcha";
import { LoginPorCodigo } from "@/components/auth/login-por-codigo";
import { BotaoApple } from "@/components/auth/botao-apple";
import { provedoresSociais } from "@/lib/auth/provedores-sociais";
import { chaveFalhas, exigeCaptchaPorFalhas, lerFalhas, segundosRestantes } from "@/lib/seguranca/tentativas-login";
import { destinoDepoisDaEntrada, motivoDaEntrada } from "@/lib/auth/entrada";
import { CARTAO_FORMULARIO_PORTA, FUNDO_FORMULARIO_PORTA, PRIMARIO_PORTA, VEU_BASE_PORTA, VEU_TOPO_PORTA } from "@/lib/auth/porta-visual";

/**
 * Prompt 49 — entrada única: "entrada" (e-mail + código; entra E cria conta) é a tela padrão. "senha" é o
 * fluxo antigo, atrás do link terciário "Entrar com senha" (?senha=1); "Esqueci a senha" só existe dentro dele.
 * Nenhuma conta nova cria senha: o cadastro com senha saiu, e os links antigos (?cadastro=1, ?codigo=1,
 * ?ref=) caem na entrada única.
 */
type Mode = "entrada" | "senha" | "forgot";

export default function AuthPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const startSession = useAuthStore((s) => s.startSession);
  const [mode, setMode] = useState<Mode>("entrada");
  // Dentro do app: o login social NÃO roda no WebView (o Google bloqueia); abre no navegador do
  // sistema via postMessage (handleSocial) e, no iPhone, vem junto com "Continuar com a Apple" (LOGIN-APPLE).
  const noApp = useIsNative();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [indicacao, setIndicacao] = useState("");
  const [motivo, setMotivo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Trava contra clique duplo: o estado só muda no próximo render; a ref, na hora.
  const enviandoRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // sessão expirada / reset enviado
  // F44: falhas seguidas de login (por e-mail, neste navegador) → atraso progressivo.
  const [espera, setEspera] = useState(0);
  const [falhas, setFalhas] = useState(0);
  // CAPTCHA (Turnstile): só aparece com NEXT_PUBLIC_TURNSTILE_SITE_KEY; o token vale uma vez.
  const captcha = useCaptcha();

  // Sessão de 24h expirou (o AuthProvider redireciona com ?expired=1).
  // Link de indicação (?ref=CÓDIGO): segue para a conta nova criada pelo código.
  // Momento de valor (?motivo=pedido|mensagem|…): a tela diz por que a conta é pedida agora.
  // (lê a URL só no cliente — sem useSearchParams, que exigiria Suspense)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice("Sua sessão de 24h expirou. Entre novamente para continuar.");
    }
    if (params.get("senha") === "1") setMode("senha");
    setMotivo(motivoDaEntrada(params.get("motivo")));
    const ref = params.get("ref")?.trim().slice(0, 40);
    if (ref) setIndicacao(ref);
  }, []);

  // Evento anônimo (0067): abriu a entrada (1 vez por visita). Conta nova registra "concluir_cadastro" ao entrar.
  const cadastroIniciado = useRef(false);
  useEffect(() => {
    if (mode !== "entrada" || cadastroIniciado.current) return;
    cadastroIniciado.current = true;
    registrarEvento("iniciar_cadastro");
  }, [mode]);

  // Destino pós-login: honra ?redirect=… (definido pelo proxy ao barrar rota
  // protegida), aceitando SÓ caminhos internos ("/algo") — nunca URLs externas
  // (evita open redirect). Lê window.location no clique (client-only) para não
  // exigir Suspense e manter /auth estático.
  function postAuthTarget(): string {
    if (typeof window === "undefined") return "/dashboard";
    // A7: só caminho interno (recusa //, \, tab/CR/LF, @host, esquemas…).
    return safeInternalPath(new URLSearchParams(window.location.search).get("redirect"));
  }

  /** Conta uma falha de login e inicia a espera (F44). Nunca depende de a conta existir. */
  function registrarFalha() {
    const chave = chaveFalhas(email);
    let atual = { falhas: 0, ultima: 0 };
    try {
      atual = lerFalhas(window.localStorage.getItem(chave));
    } catch {
      /* armazenamento bloqueado: segue sem persistir */
    }
    const novo = { falhas: atual.falhas + 1, ultima: Date.now() };
    try {
      window.localStorage.setItem(chave, JSON.stringify(novo));
    } catch {
      /* idem */
    }
    setFalhas(novo.falhas);
    setEspera(segundosRestantes(novo, Date.now()));
  }

  // Ao trocar o e-mail, lê as falhas dele; a contagem regressiva libera o botão sozinha.
  useEffect(() => {
    if (mode !== "senha") return;
    let e = { falhas: 0, ultima: 0 };
    try {
      e = lerFalhas(window.localStorage.getItem(chaveFalhas(email)));
    } catch {
      /* sem armazenamento */
    }
    // localStorage só existe no cliente: lido aqui, depois da hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFalhas(e.falhas);
    setEspera(segundosRestantes(e, Date.now()));
  }, [email, mode]);
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setNotice(null);
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

  /**
   * Login social. No site: navega para o provedor. No app: pede um `state` ao servidor, monta a URL do
   * provedor SEM navegar (skipBrowserRedirect) e avisa o app por postMessage; o app abre o navegador do
   * sistema e devolve ?code por vivanomads://auth/callback (ordem 1f65c73d).
   */
  async function handleSocial(provedor: "google" | "apple") {
    if (provedor === "google" ? !LOGIN_GOOGLE_ATIVO : !LOGIN_APPLE_ATIVO) return;
    const supabase = createClient();
    if (!supabase) {
      setError("Login social requer Supabase configurado.");
      return;
    }
    if (!noApp) {
      await supabase.auth.signInWithOAuth({ provider: provedor, options: { redirectTo: `${SITE_URL}/auth/callback` } });
      return;
    }
    try {
      const resp = await fetch("/api/app/login-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provedor }),
      });
      const { state } = (await resp.json()) as { state?: string };
      if (!resp.ok || !state) throw new Error("state");
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: provedor,
        options: {
          redirectTo: `${SITE_URL}/auth/app-callback?provedor=${provedor}&state=${encodeURIComponent(state)}`,
          skipBrowserRedirect: true,
        },
      });
      if (oauthError || !data?.url) throw new Error("oauth");
      const ponte = (window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView;
      if (!ponte) throw new Error("sem-app");
      ponte.postMessage(JSON.stringify({ tipo: "login-social", provedor, url: data.url, state }));
    } catch {
      setError("Não foi possível iniciar o login agora. Entre com o código por e-mail ou tente de novo.");
    }
  }

  /** Recuperação de senha (Atualização 20.3) — só a partir de "Entrar com senha". */
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setError("Digite um e-mail válido para receber o link.");
      return;
    }
    if (!podeEnviar(captcha.ligado, captcha.token)) {
      setError(MSG_CAPTCHA_PENDENTE);
      return;
    }
    const supabase = createClient();
    setLoading(true);
    try {
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, comCaptcha({ redirectTo: `${SITE_URL}/auth/reset` }, captcha.token));
        if (error) throw error;
      }
      setNotice(
        "Enviamos um link de recuperação para seu e-mail. Abra-o para definir uma nova senha."
      );
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
      captcha.reset();
    }
  }

  /** Sessão criada (código ou senha): guarda o usuário e navega com o cookie já gravado. */
  function entrou(u: { id: string; email: string; nome?: string; papel?: string }, destino: string) {
    // Seta o usuário SÍNCRONO a partir da sessão VALIDADA pelo Supabase —
    // não é "fabricar" sessão (o login já passou). Sem isto, o painel
    // dependia do AuthProvider (assíncrono) e o AuthGuard podia quicar de
    // volta para /auth (hidratado && sem usuário) — o login "não entrava".
    setUser({
      id: u.id,
      name: u.nome ?? u.email ?? "Usuário",
      fullName: u.nome,
      email: u.email,
      role: (u.papel as UserRole) ?? "tenant",
    });
    // Inicia o relógio de 24h da sessão (expira e pede login de novo).
    startSession();
    // Cache de imóveis começa limpo p/ o novo usuário (mesma aba).
    resetPropertiesCache();
    // Navegação COMPLETA (não router.push): garante que o cookie da sessão
    // já vai na 1ª requisição ao servidor — no Safari/iPhone a navegação
    // do cliente podia chegar antes do cookie e o proxy devolvia para /auth.
    window.location.assign(destino);
  }

  /** "Entrar com senha" (fluxo antigo, terciário). O atraso progressivo vale no servidor (/api/auth/entrar). */
  async function handleSenha(e: React.FormEvent) {
    e.preventDefault();
    if (enviandoRef.current) return;
    setError(null);
    setNotice(null);
    if (!isValidEmail(email)) {
      setError("E-mail inválido. Confira o endereço digitado.");
      return;
    }
    if (!password) {
      setError("Digite sua senha.");
      return;
    }
    if (!podeEnviar(captcha.ligado, captcha.token)) {
      setError(MSG_CAPTCHA_PENDENTE);
      return;
    }
    if (espera > 0) {
      setError(`Muitas tentativas. Aguarde ${espera} s para tentar de novo.`);
      return;
    }

    enviandoRef.current = true;
    setLoading(true);
    // Depois do sucesso o botão fica "Entrando…" até a página nova abrir.
    let navegando = false;
    const emailLimpo = limparEmail(email);
    const supabase = createClient();
    try {
      if (supabase) {
        const resp = await withTimeout(
          fetch("/api/auth/entrar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailLimpo, password, captchaToken: captcha.token }),
          })
        );
        const res = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          codigo?: string;
          error?: string;
          espera?: number;
          user?: { id: string; email: string; fullName: string | null; role: string };
        };
        if (!res.ok) {
          // E-mail ainda não confirmado: o código por e-mail confirma e entra (não é senha errada).
          if (res.codigo === "nao_confirmado") {
            setMode("entrada");
            setNotice("Seu e-mail ainda não foi confirmado. Peça o código abaixo: ele confirma o e-mail e entra.");
            return;
          }
          if (res.codigo === "espera") {
            setEspera(Math.max(1, Math.min(res.espera ?? 60, 60)));
            throw new Error("Muitas tentativas. Aguarde um pouco para tentar de novo.");
          }
          if (res.codigo === "captcha") throw new Error(res.error || "captcha");
          // Credenciais inválidas: SEMPRE a mesma mensagem (F43) — nunca revela
          // se o e-mail tem conta. Conta a falha para o atraso progressivo (F44).
          registrarFalha();
          throw new Error("Invalid login credentials");
        }
        try {
          window.localStorage.removeItem(chaveFalhas(email));
        } catch {
          /* sem armazenamento */
        }
        navegando = true;
        const u = res.user;
        if (u) entrou({ id: u.id, email: u.email, nome: u.fullName ?? undefined, papel: u.role }, postAuthTarget());
        else window.location.assign(postAuthTarget());
        return;
      }

      // Sem Supabase configurado (apenas dev/preview): sessão de demonstração
      // local. Em produção o Supabase está sempre presente, então este caminho
      // não existe — não há porta dos fundos de demo no acesso real.
      setUser({ id: crypto.randomUUID(), name: email, email, role: "tenant" });
      startSession();
      router.push(postAuthTarget());
    } catch (err) {
      // Diagnóstico (DevTools do navegador) — erro COMPLETO do Supabase, não exposto ao usuário.
      const e = err as { message?: string; status?: number; code?: string; name?: string };
      console.error("[auth] falha no login:", { name: e?.name, status: e?.status, code: e?.code, message: e?.message, error: err });
      setError(friendlyAuthError(err instanceof Error ? err.message : "", "login"));
    } finally {
      if (!navegando) {
        enviandoRef.current = false;
        setLoading(false);
      }
      captcha.reset();
    }
  }

  const linkTexto = "inline-flex min-h-11 items-center gap-2 text-sm font-medium text-forest hover:text-blue-700";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Lado da marca — foto distinta para login e cadastro (plano C1/C2) */}
      <div className="relative hidden overflow-hidden lg:block">
        {/* Fase 2.3 — imagem lateral serena (vertical), só em >= 1024px. */}
        <BrandImage
          src="/media/auth-lateral.webp"
          alt="Pessoa relaxando junto à janela em um imóvel mobiliado e tranquilo"
          rounded="rounded-none"
          sizes="50vw"
          priority
          treat={false}
          className="absolute inset-0 h-full w-full"
        />
        {/* Escuro só atrás do texto: a foto fica clara e quente (alinhamento visual da porta, 23/10). */}
        <div className="absolute inset-0 flex flex-col items-start justify-between p-12 text-white">
          <div className={VEU_TOPO_PORTA} data-testid="porta-veu-topo">
            <Logo href="/" light />
          </div>
          <div className={VEU_BASE_PORTA} data-testid="porta-veu-base">
            <h1 className="font-title text-[28px] font-semibold leading-tight">
              {mode === "entrada" ? "Sua nova fase começa aqui." : "Bem-vindo de volta."}
            </h1>
            <p className="mt-4 max-w-md text-white/90">
              Imóveis mobiliados para estadias de 30 a 180 dias, para profissionais em transição. Estadia de
              meses, com contrato de verdade e conversa registrada.
            </p>
            <p className="mt-6 text-sm text-white/80">Estadias de 30 a 180 dias</p>
          </div>
        </div>
      </div>

      {/* Formulário: fundo quente e o formulário num cartão (sem o branco vazio). */}
      <div className={`flex items-center justify-center px-4 py-8 sm:p-12 ${FUNDO_FORMULARIO_PORTA}`} data-testid="porta-formulario">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden">
            <Logo href="/" />
          </div>
          {/* E176 (PUBLICO-A): a porta tem saída rotulada — volta ao site (além do logo clicável). */}
          <Link href="/" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest hover:underline" data-testid="auth-voltar-site">
            <span aria-hidden>‹</span> Voltar ao site
          </Link>
          <div className={CARTAO_FORMULARIO_PORTA} data-testid="porta-cartao">

          {mode === "entrada" ? (
            /* ── Entrada única: e-mail + código (Prompt 49) ── */
            <>
              {notice && (
                <p className="mb-2 flex items-start gap-2 rounded-lg bg-sage-100 px-3 py-2 text-sm text-forest">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" /> {notice}
                </p>
              )}
              <LoginPorCodigo
                email={email}
                onEmail={setEmail}
                indicacao={indicacao}
                motivo={motivo}
                onEntrou={(u) => {
                  if (u.novo) registrarEvento("concluir_cadastro");
                  entrou(u, destinoDepoisDaEntrada(postAuthTarget(), u.novo));
                }}
              />
              {/* Login social só com o provedor ativado no Supabase (flags desligadas por padrão). */}
              {(LOGIN_GOOGLE_ATIVO || LOGIN_APPLE_ATIVO) && (
                <>
                  <div className="my-6 flex items-center gap-3 text-xs text-muted">
                    <span className="h-px flex-1 bg-sage-200" /> ou{" "}
                    <span className="h-px flex-1 bg-sage-200" />
                  </div>
                  <div className="space-y-3">
                    {/* LOGIN-APPLE: a Apple vem primeiro e só com LOGIN_APPLE_ATIVO; com a flag desligada, só o Google, como antes. */}
                    {provedoresSociais({ google: LOGIN_GOOGLE_ATIVO, apple: LOGIN_APPLE_ATIVO }).map((p) =>
                      p === "apple" ? (
                        <BotaoApple key={p} disabled={loading} onClick={() => handleSocial("apple")} />
                      ) : (
                        <Button key={p} variant="outline" className="w-full" type="button" disabled={loading} onClick={() => handleSocial("google")}>
                          <Globe className="h-4 w-4" /> Continuar com Google
                        </Button>
                      )
                    )}
                  </div>
                </>
              )}
              {error && (
                <p role="alert" data-testid="auth-erro" className="mt-4 text-sm text-red-600">
                  {error}
                </p>
              )}
              {/* Terciário: o fluxo antigo de senha (contas que já têm senha). */}
              <div className="mt-6 text-center">
                <button type="button" data-testid="entrar-com-senha" onClick={() => switchMode("senha")} className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-ink">
                  Entrar com senha
                </button>
              </div>
            </>
          ) : mode === "forgot" ? (
            /* ── Recuperação de senha (Atualização 20.3) ── */
            <div>
              <button type="button" onClick={() => switchMode("senha")} className={linkTexto}>
                <ArrowLeft className="h-4 w-4" /> Voltar para entrar com senha
              </button>
              <h2 className="mt-6 font-title text-2xl font-semibold text-ink">Recuperar senha</h2>
              <p className="mt-2 text-sm text-muted">
                Informe seu e-mail e enviaremos um link seguro para criar uma nova senha.
              </p>
              <form onSubmit={handleForgot} method="post" className="mt-6 space-y-4">
                <Input icon={Mail} type="email" placeholder="E-mail" value={email} onChange={setEmail} required name="email" autoComplete="email" />
                {error && (
                  <p role="alert" data-testid="auth-erro" className="text-sm text-red-600">
                    {error}
                  </p>
                )}
                {notice && (
                  <p className="flex items-start gap-2 rounded-lg bg-sage-100 px-3 py-2 text-sm text-forest">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" /> {notice}
                  </p>
                )}
                {captcha.widget}
                <Button type="submit" className={`w-full ${PRIMARIO_PORTA}`} aria-busy={loading} disabled={loading || !podeEnviar(captcha.ligado, captcha.token)}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar link de recuperação
                </Button>
              </form>
            </div>
          ) : (
            /* ── Entrar com senha (terciário) ── */
            <div data-testid="login-com-senha">
              <button type="button" onClick={() => switchMode("entrada")} className={linkTexto}>
                <ArrowLeft className="h-4 w-4" /> Entrar com código por e-mail
              </button>
              <h2 className="mt-6 font-title text-2xl font-semibold text-ink">Entrar com senha</h2>
              <form onSubmit={handleSenha} method="post" className="mt-6 space-y-4">
                <Input icon={Mail} type="email" placeholder="E-mail" value={email} onChange={setEmail} required name="email" autoComplete="email" />
                <Input icon={Lock} type="password" placeholder="Senha" value={password} onChange={setPassword} required name="password" autoComplete="current-password" />
                <div className="flex justify-end">
                  <button type="button" onClick={() => switchMode("forgot")} className="inline-flex min-h-11 items-center text-sm font-medium text-forest hover:text-blue-700">
                    Esqueci minha senha
                  </button>
                </div>
                {noApp && !LOGIN_GOOGLE_ATIVO && (
                  <p className="text-xs text-muted" data-testid="dica-google-app">
                    Entrou com Google no site? Use &quot;Entrar com código por e-mail&quot;: o código chega no mesmo e-mail.
                  </p>
                )}

                {error && (
                  <p role="alert" data-testid="auth-erro" className="text-sm text-red-600">
                    {error}
                  </p>
                )}

                {/* Links FIXOS no login (F43): iguais com ou sem conta, nunca dizem se o e-mail existe. */}
                {error === friendlyAuthError("invalid login credentials") && (
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted" data-testid="login-links-fixos">
                    <button type="button" onClick={() => switchMode("entrada")} className="inline-flex min-h-11 items-center font-medium text-forest hover:text-blue-700">
                      Entrar com código
                    </button>{" "}
                    ·{" "}
                    <button type="button" onClick={() => switchMode("forgot")} className="inline-flex min-h-11 items-center font-medium text-forest hover:text-blue-700">
                      Esqueci minha senha
                    </button>
                  </p>
                )}
                {exigeCaptchaPorFalhas(falhas) && (
                  <p className="text-xs text-muted" data-testid="login-aviso-tentativas">
                    Por segurança, confirme a verificação anti-robô a cada tentativa.
                    {espera > 0 && ` Aguarde ${espera} s para tentar de novo.`}
                  </p>
                )}

                {/* Aviso informativo (ex.: sessão de 24h expirou). */}
                {notice && (
                  <p className="flex items-start gap-2 rounded-lg bg-sage-100 px-3 py-2 text-sm text-forest">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" /> {notice}
                  </p>
                )}

                {captcha.widget}
                <Button type="submit" className={`w-full ${PRIMARIO_PORTA}`} aria-busy={loading} disabled={loading || espera > 0 || !podeEnviar(captcha.ligado, captcha.token)}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
              </form>
            </div>
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
    </div>
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
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        name={name}
        autoComplete={autoComplete}
        {...(type === "email" ? ATRIBUTOS_EMAIL : {})}
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
          // Ícone de 16 px, área de toque de 44 px (t259); a margem negativa mantém o ícone no mesmo lugar do campo.
          className="-mr-3 grid h-11 w-11 shrink-0 place-items-center text-muted transition-colors hover:text-ink"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
