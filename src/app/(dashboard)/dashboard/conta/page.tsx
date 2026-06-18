"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Bell, Trash2, Check } from "lucide-react";
import { useAuthStore, DEMO_USER } from "@/lib/store";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { TaxSimulator } from "@/components/tax-simulator";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError, MIN_PASSWORD } from "@/lib/auth-errors";
import { cn } from "@/lib/utils";

export default function AccountPage() {
  // Identidade exibida — usa a sessão (ou a demo) para pré-preencher os campos.
  const user = useAuthStore((s) => s.user) ?? DEMO_USER;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Conta" subtitle="Seus dados pessoais e preferências." />

      <Panel title="Dados pessoais">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" defaultValue={user?.name ?? ""} />
          <Field label="E-mail" defaultValue={user?.email ?? ""} type="email" />
          <Field label="Telefone" placeholder="(34) 90000-0000" />
          <Field label="Perfil" defaultValue={roleLabel(user?.role)} readOnly />
        </div>
        <div className="mt-6">
          <Button>Salvar alterações</Button>
        </div>
      </Panel>

      {user?.role !== "tenant" && (
        <div className="mt-6">
          <h2 className="mb-3 font-title text-lg font-bold text-ink">Tributação dos aluguéis</h2>
          <TaxSimulator />
        </div>
      )}

      {user?.role === "tenant" && (
        <Panel title="Perfil profissional" className="mt-6">
          <p className="text-sm text-muted">
            Estes dados ajudam o proprietário a conhecer você. Complementam o laudo CAF — não
            o substituem.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Categoria profissional</span>
              <select className="w-full rounded-xl border border-sage-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sage">
                <option>Médico / saúde</option>
                <option>Executivo / corporativo</option>
                <option>Nômade digital / remoto</option>
                <option>Estudante / intercâmbio</option>
                <option>Outro</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">LinkedIn (opcional)</span>
              <input
                type="url"
                placeholder="https://linkedin.com/in/seu-perfil"
                className="w-full rounded-xl border border-sage-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sage"
              />
            </label>
          </div>
          <Button className="mt-4">Salvar perfil</Button>
        </Panel>
      )}

      <Panel title="Verificação" className="mt-6">
        <p className="text-sm text-muted">
          Complete a verificação de identidade para gerar mais confiança. Progresso atual:{" "}
          <strong className="text-forest">60%</strong>.
        </p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sage-100">
          <div className="h-full w-[60%] rounded-full bg-champagne" />
        </div>
        <ButtonLink href="/dashboard/verificacao" variant="outline" className="mt-5">
          Continuar verificação
        </ButtonLink>
      </Panel>

      {/* Alterar senha (Atualização 20.7) */}
      <ChangePassword />

      {/* Notificações (Atualização 20.7) */}
      <NotificationsPanel />

      {/* Zona de risco — excluir conta com dupla confirmação (Atualização 20.7) */}
      <DangerZone />
    </div>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (next.length < MIN_PASSWORD) {
      setError(`A nova senha deve ter pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (next !== confirm) {
      setError("A nova senha e a confirmação não coincidem.");
      return;
    }
    const supabase = createClient();
    setLoading(true);
    try {
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ password: next });
        if (error) throw error;
      }
      setOk(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="Alterar senha" className="mt-6">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <PwdField label="Senha atual" value={current} onChange={setCurrent} />
        <span className="hidden sm:block" />
        <PwdField label="Nova senha" value={next} onChange={setNext} />
        <PwdField label="Confirmar nova senha" value={confirm} onChange={setConfirm} />
        <div className="sm:col-span-2">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          {ok && (
            <p className="mb-3 flex items-center gap-2 text-sm text-forest">
              <Check className="h-4 w-4" /> Senha atualizada com sucesso.
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Salvar nova senha
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function PwdField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-sage-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sage"
      />
    </label>
  );
}

function NotificationsPanel() {
  const [prefs, setPrefs] = useState({
    leads: true,
    messages: true,
    marketing: false,
  });
  const items: { key: keyof typeof prefs; label: string; hint: string }[] = [
    { key: "leads", label: "Novos leads e consultas", hint: "Avise quando um interessado entrar em contato." },
    { key: "messages", label: "Mensagens", hint: "Notificações de novas mensagens no chat." },
    { key: "marketing", label: "Novidades e dicas", hint: "E-mails ocasionais sobre a plataforma." },
  ];
  return (
    <Panel title="Notificações" className="mt-6">
      <div className="space-y-2">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => setPrefs((p) => ({ ...p, [it.key]: !p[it.key] }))}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-sage-200 px-4 py-3 text-left hover:border-sage"
          >
            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <Bell className="h-4 w-4 text-sage" /> {it.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{it.hint}</span>
            </span>
            <span
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                prefs[it.key] ? "bg-forest" : "bg-sage-200"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                  prefs[it.key] ? "left-[1.375rem]" : "left-0.5"
                )}
              />
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function DangerZone() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const [step, setStep] = useState(0); // 0 = botão, 1 = 1ª confirmação, 2 = digitar EXCLUIR
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);

  async function confirmDelete() {
    setLoading(true);
    // Em produção: chamar rota server-side que apaga os dados (LGPD).
    signOut();
    router.push("/home");
  }

  return (
    <Panel title="Excluir conta" className="mt-6 border-red-200">
      <p className="text-sm text-muted">
        A exclusão é permanente e remove seus dados conforme a LGPD. Esta ação não pode ser
        desfeita.
      </p>

      {step === 0 && (
        <Button variant="outline" className="mt-4 border-red-300 text-red-600 hover:bg-red-50" onClick={() => setStep(1)}>
          <Trash2 className="h-4 w-4" /> Quero excluir minha conta
        </Button>
      )}

      {step === 1 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">
            Tem certeza? Você perderá anúncios, documentos e histórico.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-600 hover:bg-red-100"
              onClick={() => setStep(2)}
            >
              Continuar a exclusão
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            Para confirmar, digite <strong>EXCLUIR</strong> abaixo.
          </p>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="EXCLUIR"
            className="mt-2 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
          />
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setStep(0); setTyped(""); }}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={typed !== "EXCLUIR" || loading}
              onClick={confirmDelete}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir definitivamente
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function roleLabel(role?: string) {
  if (role === "owner") return "Proprietário";
  if (role === "tenant") return "Inquilino";
  if (role === "admin") return "Administrador";
  return "—";
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-sage-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sage read-only:bg-surface-2 read-only:text-muted"
      />
    </label>
  );
}
