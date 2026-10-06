"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Bell, Trash2, Check } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useViewMode } from "@/lib/roles";
import { useDisplayUser } from "@/lib/demo/demo-mode";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { TaxSimulator } from "@/components/tax-simulator";
import { CategoriaProfissional } from "@/components/account/categoria-profissional";
import { createClient } from "@/lib/supabase/client";
import { nomeCompletoLimpo } from "@/lib/display-name";
import { friendlyAuthError, MIN_PASSWORD } from "@/lib/auth-errors";
import { Switch } from "@/components/ui/switch";
import { getMeusDados, salvarMeusDados } from "@/lib/data/perfil-actions";
import { getNotifPrefs, setNotifPrefs } from "@/lib/data/pedidos-actions";


/*
 * Seções da página Conta — compartilhadas pela página completa (site) e pelas
 * subtelas do app (/dashboard/conta/[secao]).
 */

export function DadosPessoais() {
  const user = useDisplayUser();
  const { mode } = useViewMode();
  const setUser = useAuthStore((s) => s.setUser);
  const [nome, setNome] = useState(nomeCompletoLimpo(user?.fullName));
  const [telefone, setTelefone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Carrega os dados GRAVADOS (antes o formulário só mostrava valores locais).
  useEffect(() => {
    let vivo = true;
    getMeusDados()
      .then((d) => {
        if (!vivo || !d) return;
        setNome(nomeCompletoLimpo(d.fullName));
        setTelefone(d.phone);
        setLinkedin(d.linkedin);
        setEmail(d.email);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    setSalvando(true);
    const r = await salvarMeusDados({
      fullName: nome,
      phone: telefone,
      ...(mode === "tenant" ? { linkedin } : {}),
    }).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo.", dados: undefined }));
    setSalvando(false);
    if (!r.ok || !r.dados) {
      setErro(r.error ?? "Não foi possível salvar.");
      return;
    }
    setNome(r.dados.fullName);
    setTelefone(r.dados.phone ?? "");
    if (mode === "tenant") setLinkedin(r.dados.linkedin ?? "");
    // O nome novo aparece já no menu e no topo.
    const atual = useAuthStore.getState().user;
    if (atual) setUser({ ...atual, name: r.dados.fullName, fullName: r.dados.fullName });
    setOk(true);
  }

  return (
    <Panel title="Dados pessoais">
      <form onSubmit={salvar}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome completo"
            autoComplete="name"
            required
          />
          <Field label="E-mail" value={email} type="email" readOnly title="Para trocar o e-mail, fale com a gente." />
          <Field
            label="Telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(34) 99999-0000 ou +1 …"
            inputMode="tel"
            autoComplete="tel"
          />
          <Field label="Perfil" defaultValue={roleLabel(user?.role)} readOnly />
          {mode === "tenant" && (
            <Field
              label="LinkedIn (opcional)"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://linkedin.com/in/seu-perfil"
              inputMode="url"
            />
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          O telefone não aparece para outros usuários: é usado só para avisos da plataforma.
        </p>
        {erro && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {erro}
          </p>
        )}
        {ok && (
          <p className="mt-3 flex items-center gap-2 text-sm text-forest">
            <Check className="h-4 w-4" /> Dados salvos.
          </p>
        )}
        <div className="mt-6">
          <Button type="submit" disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar alterações
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function PerfilDoModo() {
  const { mode } = useViewMode();
  return (
    <>
      {mode !== "tenant" && (
        <div className="mt-6">
          <h2 className="mb-3 font-title text-lg font-bold text-ink">Tributação dos aluguéis</h2>
          <TaxSimulator />
        </div>
      )}

      {mode === "tenant" && (
        <Panel title="Perfil profissional" className="mt-6">
          <p className="text-sm text-muted">
            Estes dados ajudam o proprietário a conhecer você. Complementam a verificação de identidade — não
            o substituem.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CategoriaProfissional />
            <p className="self-end text-xs text-muted">O LinkedIn fica em Dados pessoais.</p>
          </div>
        </Panel>
      )}
    </>
  );
}

export function AjudaContato() {
  return (
    <Panel title="Ajuda & contato" className="mt-6">
      <p className="text-sm text-muted">
        Dúvidas, problemas ou segurança: a Central de Ajuda tem respostas rápidas e abre um chamado com uma pessoa da
        equipe quando precisar.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href="/ajuda"
          className="inline-flex items-center gap-2 rounded-xl border border-sage-200 px-4 py-2.5 text-sm font-medium text-forest hover:border-sage"
        >
          Central de Ajuda
        </a>
        <a
          href="/ajuda?novo=1"
          className="inline-flex items-center gap-2 rounded-xl border border-sage-200 px-4 py-2.5 text-sm font-medium text-forest hover:border-sage"
        >
          Abrir chamado
        </a>
      </div>
    </Panel>
  );
}

export function ChangePassword() {
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
    if (!current) {
      setError("Informe a senha atual.");
      return;
    }
    if (next === current) {
      setError("A nova senha precisa ser diferente da atual.");
      return;
    }
    const supabase = createClient();
    setLoading(true);
    try {
      if (supabase) {
        // Confere a senha ATUAL antes de trocar (antes era ignorada: qualquer
        // pessoa com o aparelho desbloqueado trocava a senha).
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.email) throw new Error("Sessão expirada. Entre de novo.");
        const { error: atualErro } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: current,
        });
        if (atualErro) {
          setError("Senha atual incorreta.");
          return;
        }
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
        <PwdField label="Senha atual" value={current} onChange={setCurrent} autoComplete="current-password" />
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
  autoComplete = "new-password",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <PasswordInput
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="rounded-xl border border-sage-200 bg-white px-3.5 py-2.5 focus-within:border-sage"
        inputClassName="text-sm"
      />
    </label>
  );
}

export function NotificationsPanel() {
  // Preferências GRAVADAS no perfil (notif_email / notif_whatsapp). Antes os
  // interruptores só mudavam na tela e não correspondiam a nada no banco.
  const [prefs, setPrefs] = useState<{ email: boolean; whatsapp: boolean } | null>(null);
  const [salvando, setSalvando] = useState<"email" | "whatsapp" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let vivo = true;
    getNotifPrefs()
      .then((p) => vivo && setPrefs(p))
      .catch(() => vivo && setPrefs({ email: true, whatsapp: true }));
    return () => {
      vivo = false;
    };
  }, []);

  async function alternar(chave: "email" | "whatsapp") {
    if (!prefs) return;
    const anterior = prefs;
    const novo = { ...prefs, [chave]: !prefs[chave] };
    setPrefs(novo);
    setErro(null);
    setOk(false);
    setSalvando(chave);
    const r = await setNotifPrefs(novo).catch(() => ({ ok: false, error: "Sem conexão." }));
    setSalvando(null);
    if (!r.ok) {
      setPrefs(anterior); // volta o interruptor: não gravou
      setErro("Não foi possível salvar a preferência. Tente de novo.");
      return;
    }
    setOk(true);
  }

  const items: { key: "email" | "whatsapp"; label: string; hint: string }[] = [
    {
      key: "email",
      label: "Avisos por e-mail",
      hint: "Novos interessados, mensagens e respostas aos seus pedidos.",
    },
    {
      key: "whatsapp",
      label: "Avisos por WhatsApp",
      hint: "Os mesmos avisos pelo WhatsApp, quando o canal estiver ativo.",
    },
  ];
  return (
    <Panel title="Notificações" className="mt-6">
      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.key}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-sage-200 px-4 py-3 text-left"
          >
            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <Bell className="h-4 w-4 text-sage" /> {it.label}
                {salvando === it.key && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{it.hint}</span>
            </span>
            <Switch
              checked={prefs ? prefs[it.key] : false}
              onChange={() => alternar(it.key)}
              label={it.label}
              disabled={!prefs || salvando !== null}
            />
          </div>
        ))}
      </div>
      {erro && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {erro}
        </p>
      )}
      {ok && (
        <p className="mt-3 flex items-center gap-2 text-sm text-forest">
          <Check className="h-4 w-4" /> Preferência salva.
        </p>
      )}
    </Panel>
  );
}

export function DangerZone() {
  const router = useRouter();
  const user = useDisplayUser();
  const signOut = useAuthStore((s) => s.signOut);
  const [step, setStep] = useState(0); // 0 = botão, 1 = consequências, 2 = senha
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep(0);
    setPassword("");
    setError(null);
  }

  async function confirmDelete() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      if (supabase) {
        // Confirma a identidade reautenticando com a senha atual.
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: user?.email ?? "",
          password,
        });
        if (authError) {
          setError("Senha incorreta. Tente novamente.");
          return;
        }
        // Apaga/anonimiza os dados pessoais (LGPD). O servidor decide: bloqueia
        // com locação ativa, anonimiza quem tem histórico de contratos, apaga o resto.
        const { error: delError } = await supabase.rpc("delete_user_account");
        if (delError) {
          if ((delError.message || "").includes("LOCACAO_ATIVA")) {
            setError(
              "Você tem uma locação ou contrato ativo. Encerre a locação antes de excluir a conta."
            );
          } else {
            setError("Não foi possível excluir agora. Tente novamente em instantes.");
          }
          return;
        }
        await supabase.auth.signOut();
      }
      signOut();
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="Excluir conta" className="mt-6 border-red-200">
      <p className="text-sm font-medium text-red-600">
        Esta ação remove seus dados pessoais (LGPD — direito ao esquecimento). Com locação
        ativa, a exclusão é bloqueada até o encerramento. Se você tiver histórico de contratos,
        sua identidade é removida e os contratos/pagamentos são mantidos sem identificação pelo
        prazo exigido por lei.
      </p>

      {step === 0 && (
        <Button variant="outline" className="mt-4 border-red-300 text-red-600 hover:bg-red-50" onClick={() => setStep(1)}>
          <Trash2 className="h-4 w-4" /> Quero excluir minha conta
        </Button>
      )}

      {step === 1 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">
            Ao excluir, você perde permanentemente:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
            <li>Dados pessoais e perfil de verificação</li>
            <li>Anúncios e imóveis cadastrados</li>
            <li>Favoritos, candidaturas e mensagens</li>
          </ul>
          <p className="mt-2 text-xs text-red-700">
            Contratos e pagamentos, se existirem, são mantidos sem identificação pelo prazo legal.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>
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
            Para confirmar sua identidade, digite sua <strong>senha atual</strong>.
          </p>
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Senha atual"
            autoComplete="current-password"
            className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-2 focus-within:border-red-500"
            inputClassName="text-sm"
          />
          {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={password.length === 0 || loading}
              onClick={confirmDelete}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sim, excluir permanentemente
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
