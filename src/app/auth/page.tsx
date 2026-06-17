"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, User, Mail, Lock, Globe, Calculator } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { BrandImage } from "@/components/brand-image";
import { PHOTOS } from "@/lib/media";
import { TaxSimulator } from "@/components/tax-simulator";
import { useAuthStore } from "@/lib/store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import type { PersonType } from "@/lib/tax";
import { cn } from "@/lib/utils";

export default function AuthPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<UserRole>("owner");
  const [personType, setPersonType] = useState<PersonType>("pf");
  const [showSimulator, setShowSimulator] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    const supabase = createClient();
    if (!supabase) {
      setError("Login com Google requer Supabase configurado.");
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    try {
      if (supabase) {
        if (mode === "signup") {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name, role, person_type: personType } },
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        }
      }
      // Define a sessão local (modo demo ou pós-login).
      setUser({
        id: crypto.randomUUID(),
        name: name || email.split("@")[0],
        email,
        role,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível autenticar.");
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
            <h1 className="font-title text-4xl font-extrabold leading-tight">
              {mode === "login" ? "Bem-vindo de volta." : "Sua nova fase começa aqui."}
            </h1>
            <p className="mt-4 max-w-md text-white/75">
              Locação mobiliada mensal para profissionais em transição. Não é Airbnb, não é
              QuintoAndar.
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

          {/* Abas */}
          <div className="flex rounded-full bg-surface-2 p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-full py-2.5 text-sm font-medium transition-colors",
                  mode === m ? "bg-forest text-white" : "text-muted hover:text-forest"
                )}
              >
                {m === "login" ? "Entrar" : "Cadastrar"}
              </button>
            ))}
          </div>

          <h2 className="mt-8 font-title text-2xl font-extrabold text-ink">
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
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:text-champagne-600"
              >
                <Calculator className="h-4 w-4" />
                {showSimulator ? "Fechar simulador" : "Não sei qual escolher? Simule aqui"}
              </button>
              {showSimulator && (
                <div className="mt-3">
                  <TaxSimulator onRecommend={(p) => setPersonType(p)} />
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            />
            <Input
              icon={Lock}
              type="password"
              placeholder="Senha"
              value={password}
              onChange={setPassword}
              required
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Aguarde..."
                : mode === "login"
                  ? "Entrar"
                  : "Criar conta"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-sage-200" /> ou <span className="h-px flex-1 bg-sage-200" />
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sage-200 bg-white px-4 py-3 focus-within:border-sage">
      <Icon className="h-4 w-4 text-sage" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
      />
    </div>
  );
}
