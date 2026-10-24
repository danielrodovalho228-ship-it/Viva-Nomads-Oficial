"use client";

import { AtivarNotificacoes } from "@/components/app/push-app";
import { TEXTO_EXCLUSAO } from "@/lib/saida/regras";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Bell, Trash2, Check, BadgeCheck } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useViewMode } from "@/lib/roles";
import { useDisplayUser } from "@/lib/demo/demo-mode";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PasswordInput } from "@/components/ui/password-input";
import { CategoriaProfissional } from "@/components/account/categoria-profissional";
import { createClient } from "@/lib/supabase/client";
import { nomeCompletoLimpo } from "@/lib/display-name";
import { friendlyAuthError, MIN_PASSWORD } from "@/lib/auth-errors";
import { elevarParaAal2 } from "@/lib/seguranca/elevar-aal2";
import { Switch } from "@/components/ui/switch";
import { getMeusDados, salvarMeusDados, getMeuDocumento, salvarMeuDocumento, type MeuDocumento } from "@/lib/data/perfil-actions";
import { getAlertasEquipe, getNotifPrefs, setAlertasEquipe, setNotifPrefs } from "@/lib/data/pedidos-actions";
import { getCategoriasDesligadas, setCategoriasDesligadas } from "@/lib/data/notif-categorias-actions";
import { CATEGORIAS_COM_INTERRUPTOR, ROTULO_CATEGORIA, type CategoriaComInterruptor } from "@/config/matriz-notificacoes";
import { MOTIVOS } from "@/lib/pedidos/pedidos";
import { useCaptcha } from "@/components/seguranca/captcha";
import { MSG_CAPTCHA_PENDENTE, comCaptcha, podeEnviar } from "@/lib/seguranca/captcha";
import { PERFIL_ATUALIZADO } from "@/components/account/foto-perfil";
import { getNascimento, salvarNascimento } from "@/lib/data/nascimento-actions";
import { mascararNascimento, validarNascimento } from "@/lib/conta/nascimento";
import { cn } from "@/lib/utils";
import { PILULA_EMAIL } from "@/lib/perfil/espelho";


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
  const [motivoEstadia, setMotivoEstadia] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailConfirmado, setEmailConfirmado] = useState(false);
  const [nascimento, setNascimento] = useState("");
  const [documento, setDocumento] = useState<MeuDocumento | null>(null);
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
        setMotivoEstadia(d.motivoEstadia);
        setEmail(d.email);
        setEmailConfirmado(d.emailConfirmado);
      })
      .catch(() => {});
    getNascimento()
      .then((n) => vivo && setNascimento(n))
      .catch(() => {});
    getMeuDocumento()
      .then((d) => vivo && setDocumento(d))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    const nasc = validarNascimento(nascimento);
    if (!nasc.ok) {
      setErro(nasc.erro);
      return;
    }
    setSalvando(true);
    const [r, rn] = await Promise.all([
      salvarMeusDados({
        fullName: nome,
        phone: telefone,
        ...(mode === "tenant" ? { linkedin, motivoEstadia } : {}),
      }).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo.", dados: undefined })),
      salvarNascimento(nascimento).catch(() => ({ ok: false, error: "Sem conexão. Tente de novo." })),
    ]);
    setSalvando(false);
    if (!r.ok || !r.dados) {
      setErro(r.error ?? "Não foi possível salvar.");
      return;
    }
    if (!rn.ok) {
      setErro(rn.error ?? "Não foi possível salvar a data de nascimento.");
      return;
    }
    setNome(r.dados.fullName);
    setTelefone(r.dados.phone ?? "");
    if (mode === "tenant") {
      setLinkedin(r.dados.linkedin ?? "");
      setMotivoEstadia(r.dados.motivoEstadia ?? "");
    }
    // O nome novo aparece já no menu e no topo.
    const atual = useAuthStore.getState().user;
    if (atual) setUser({ ...atual, name: r.dados.fullName, fullName: r.dados.fullName });
    // CONTA-A, item 5: o topo, o espelho e o progresso do perfil releem na hora.
    window.dispatchEvent(new Event(PERFIL_ATUALIZADO));
    setOk(true);
  }

  const pj = documento?.tipo === "pj";
  const docMascarado = pj ? documento?.cnpj : documento?.cpf;

  // A4 — mockup perfil-04 ("Meus dados"): um cartão, campos um embaixo do outro, e-mail com a pílula e "Salvar".
  return (
    <section className="rounded-xl bg-white p-4 sm:p-6" aria-label="Meus dados" data-testid="meus-dados">
      <form onSubmit={salvar} className="grid gap-4">
        <CampoDados
          label="Nome completo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome completo"
          autoComplete="name"
          required
        />
        <div>
          <CampoDados label={pj ? "CNPJ" : "CPF"} value={docMascarado ?? ""} readOnly placeholder="Ainda não informado" data-testid="dados-documento" />
          {documento && !docMascarado && (
            <a href="#documento" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-forest underline underline-offset-2">
              Informar {pj ? "CNPJ" : "CPF"}
            </a>
          )}
        </div>
        <CampoDados
          label="Data de nascimento"
          value={nascimento}
          onChange={(e) => setNascimento(mascararNascimento(e.target.value))}
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          autoComplete="bday"
          data-testid="dados-nascimento"
        />
        <CampoDados
          label="Telefone"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(34) 99999-0000 ou +1 …"
          inputMode="tel"
          autoComplete="tel"
        />
        <label className="block">
          <span className="mb-1 block text-sm text-muted">E-mail:</span>
          <span className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 py-2">
            <input
              value={email}
              type="email"
              readOnly
              title="Para trocar o e-mail, fale com a gente."
              className="min-w-0 flex-1 bg-transparent py-1 text-base text-ink outline-none"
            />
            {emailConfirmado && (
              <span className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1 text-xs font-semibold text-white" data-testid="dados-email-confirmado">
                <BadgeCheck className="h-4 w-4" aria-hidden /> {PILULA_EMAIL}
              </span>
            )}
          </span>
        </label>
        {mode === "tenant" && (
          <CampoDados
            // 63-B: o endereço do perfil é PRIVADO (só a Viva vê); o selo de confiança é o "Conectar LinkedIn".
            label="Endereço do perfil no LinkedIn (opcional, só a Viva vê)"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="https://linkedin.com/in/seu-perfil"
            inputMode="url"
          />
        )}
        {mode === "tenant" && (
          <label className="block text-sm text-muted">
            Motivo da estadia (opcional):
            <select
              data-testid="perfil-motivo-estadia"
              value={motivoEstadia}
              onChange={(e) => setMotivoEstadia(e.target.value)}
              className={cn(CAMPO_DADOS, "mt-1 min-h-11")}
            >
              <option value="">Prefiro não informar</option>
              {MOTIVOS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted">
              Já vem preenchido nos seus próximos pedidos. Você pode trocar a qualquer hora.
            </span>
          </label>
        )}
        <p className="text-xs text-muted">O telefone não aparece para outros usuários: é usado só para avisos da plataforma.</p>
        {erro && (
          <p role="alert" className="text-sm text-red-600">
            {erro}
          </p>
        )}
        {ok && (
          <p className="flex items-center gap-2 text-sm text-forest" role="status">
            <Check className="h-4 w-4" /> Dados salvos.
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={salvando} data-testid="dados-salvar">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar
        </Button>
      </form>
    </section>
  );
}

const CAMPO_DADOS = "w-full rounded-lg border border-line bg-white px-4 py-3 text-base text-ink outline-none focus:border-forest read-only:bg-surface-2";

function CampoDados({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}:</span>
      <input {...props} className={CAMPO_DADOS} />
    </label>
  );
}

/**
 * Documento (CPF ou CNPJ) — Cadastro confiável. Vai no contrato, na cobrança e
 * na nota. Depois de salvo aparece só MASCARADO; para trocar, fala com o suporte.
 */
export function DocumentoPessoa() {
  const [doc, setDoc] = useState<MeuDocumento | null | undefined>(undefined);
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [razao, setRazao] = useState("");
  const [cpfRep, setCpfRep] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    getMeuDocumento()
      .then((d) => {
        if (!vivo) return;
        // null = sessão ainda não resolvida: nunca esconde a seção, oferece tentar de novo.
        setFalhou(d === null);
        setDoc(d);
      })
      .catch(() => {
        if (!vivo) return;
        setFalhou(true);
        setDoc(null);
      });
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const r = await salvarMeuDocumento(doc?.tipo === "pj" ? { cnpj, razaoSocial: razao, cpfRepresentante: cpfRep } : { cpf }).catch(() => ({
      ok: false as const,
      error: "Sem conexão. Tente de novo.",
      documento: undefined,
    }));
    setSalvando(false);
    if (!r.ok) return setErro(r.error ?? "Não foi possível salvar.");
    if (r.documento) setDoc(r.documento);
    setOk(true);
  }

  if (doc === undefined || doc === null) {
    // Nunca some da tela: esqueleto enquanto carrega; mensagem + "Tentar de novo" se falhar.
    return (
      <section id="documento" className="scroll-mt-24" data-testid="documento-secao">
        <Panel title="Documento (CPF)" className="mt-6">
          {doc === undefined ? (
            // Mesma altura do bloco carregado (texto + campo + confirmação): a tela não "pula" quando o CPF chega.
            <div role="status" aria-label="Carregando documento" data-testid="documento-carregando" className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="!mt-4 h-5 w-16" />
              <Skeleton className="h-11 w-full sm:w-1/2" />
              <Skeleton className="!mt-3 h-5 w-3/4" />
            </div>
          ) : (
            <div data-testid="documento-erro">
              <p role="alert" className="text-sm text-muted">
                {falhou ? "Não conseguimos carregar seu documento agora." : "Seu documento ainda não carregou."}
              </p>
              <div className="mt-4">
                <Button variant="secondary"
                  type="button"
                  onClick={() => {
                    setDoc(undefined);
                    setTentativa((n) => n + 1);
                  }}
                >
                  Tentar de novo
                </Button>
              </div>
            </div>
          )}
        </Panel>
      </section>
    );
  }
  const pj = doc.tipo === "pj";
  return (
    <section id="documento" className="scroll-mt-24" data-testid="documento-secao">
      <Panel title={pj ? "Documento da empresa (CNPJ)" : "Documento (CPF)"} className="mt-6">
        <p className="text-sm text-muted">
          Vai no contrato, na cobrança e na nota fiscal. Fica guardado com segurança: só você e a equipe da Viva Nomads
          veem, e aqui ele aparece mascarado. É pedido antes de aceitar uma candidatura, assinar um plano ou fechar contrato.
        </p>
        {doc.completo ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="documento-cadastrado">
            {pj ? (
              <>
                <Field label="CNPJ" value={doc.cnpj ?? ""} readOnly />
                <Field label="Razão social" value={doc.razaoSocial ?? ""} readOnly />
                <Field label="CPF do representante" value={doc.cpfRepresentante ?? ""} readOnly />
              </>
            ) : (
              <Field label="CPF" value={doc.cpf ?? ""} readOnly />
            )}
            <p className="flex items-center gap-2 text-sm text-forest sm:col-span-2">
              <Check className="h-4 w-4" /> Documento cadastrado. Para trocar, fale com o suporte.
            </p>
          </div>
        ) : (
          <form onSubmit={salvar} className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {pj ? (
                <>
                  <Field label="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" inputMode="numeric" required />
                  <Field label="Razão social" value={razao} onChange={(e) => setRazao(e.target.value)} placeholder="Como está no cartão do CNPJ" required />
                  <Field label="CPF do representante" value={cpfRep} onChange={(e) => setCpfRep(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" required />
                </>
              ) : (
                <Field label="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" autoComplete="off" required />
              )}
            </div>
            {erro && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {erro}
              </p>
            )}
            {ok && <p className="mt-3 text-sm text-forest">Documento salvo.</p>}
            <div className="mt-4">
              <Button variant="secondary" type="submit" disabled={salvando}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Salvar documento
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </section>
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
          className="inline-flex items-center gap-2 rounded-xl border border-sage-200 px-4 py-3 text-sm font-medium text-forest hover:border-sage"
        >
          Central de Ajuda
        </a>
        <a
          href="/ajuda?novo=1"
          className="inline-flex items-center gap-2 rounded-xl border border-sage-200 px-4 py-3 text-sm font-medium text-forest hover:border-sage"
        >
          Abrir chamado
        </a>
      </div>
    </Panel>
  );
}

/** Prompt 31a: "Quero ser parceiro" — abre o mesmo formulário do site, pré-preenchido pela conta (papel extra). */
export function QueroSerParceiro() {
  return (
    <Panel title="Quero ser parceiro" className="mt-6" data-testid="conta-quero-ser-parceiro">
      <p className="text-sm text-muted">
        Faz fotografia, mudança, limpeza, montagem ou manutenção? Peça a parceria com esta mesma conta: você continua
        alugando ou anunciando normalmente.
      </p>
      <a href="/dashboard/parceiro" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-sage-200 px-4 py-3 text-sm font-medium text-forest hover:border-sage">
        Quero ser parceiro
      </a>
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
  const [pedirCodigo, setPedirCodigo] = useState(false); // 2FA ativo e sessão só com senha
  const [codigo, setCodigo] = useState("");
  const captcha = useCaptcha(); // reautenticação também passa pelo CAPTCHA do Supabase

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
    if (!podeEnviar(captcha.ligado, captcha.token)) {
      setError(MSG_CAPTCHA_PENDENTE);
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
          options: comCaptcha({}, captcha.token),
        });
        if (atualErro) {
          setError("Senha atual incorreta.");
          return;
        }
        // 2FA ativo + sessão aal1: o Supabase recusa a troca (401 insufficient_aal). Pede o código aqui mesmo.
        const elevacao = await elevarParaAal2(supabase, codigo);
        if (!elevacao.ok) {
          setPedirCodigo(elevacao.pedirCodigo);
          setError(elevacao.erro);
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: next });
        if (error) throw error;
      }
      setOk(true);
      setPedirCodigo(false);
      setCodigo("");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
      captcha.reset();
    }
  }

  return (
    <Panel title="Alterar senha" className="mt-6">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <PwdField label="Senha atual" value={current} onChange={setCurrent} autoComplete="current-password" />
        <span className="hidden sm:block" />
        <PwdField label="Nova senha" value={next} onChange={setNext} />
        <PwdField label="Confirmar nova senha" value={confirm} onChange={setConfirm} />
        {pedirCodigo && (
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-ink">Código de 6 dígitos do app autenticador</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/[^\d\s]/g, ""))}
              placeholder="000000"
              className="h-11 w-full rounded-xl border border-sage-200 bg-white px-4 text-sm tracking-[0.3em] focus:border-sage focus:outline-none sm:max-w-xs"
            />
          </label>
        )}
        <div className="sm:col-span-2">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          {ok && (
            <p className="mb-3 flex items-center gap-2 text-sm text-forest">
              <Check className="h-4 w-4" /> Senha atualizada com sucesso.
            </p>
          )}
          {captcha.widget && <div className="mb-3">{captcha.widget}</div>}
          <Button variant="secondary" type="submit" disabled={loading || !podeEnviar(captcha.ligado, captcha.token)}>
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
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      <PasswordInput
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="rounded-xl border border-sage-200 bg-white px-4 py-3 focus-within:border-sage"
        inputClassName="text-sm"
      />
    </label>
  );
}

const DICA_CATEGORIA: Record<"decisao" | "seguranca" | CategoriaComInterruptor, string> = {
  decisao: "Propostas, visitas, manutenção e prazos que dependem de você.",
  seguranca: "Verificação, códigos e acesso à conta.",
  mensagens: "Mensagens novas nas conversas.",
  lembretes: "Entrada, saída, renovação e avaliações.",
  outros: "Novidades de buscas, pedidos e parceiros.",
};

/** `titulo`: a Conta e a subtela já têm o título "Notificações" — lá o cartão não repete (CONTA-A, C3a). */
export function NotificationsPanel({ titulo = "Notificações" }: { titulo?: string | null } = {}) {
  // Preferência GRAVADA no perfil (notif_email). Prompt 30, item 8: sem aviso por WhatsApp (ficam e-mail e o aviso
  // no app; o canal da Viva é "Falar com a Viva").
  const [prefs, setPrefs] = useState<{ email: boolean } | null>(null);
  const [salvando, setSalvando] = useState<"email" | "equipe" | CategoriaComInterruptor | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  // null = não é admin (o interruptor nem aparece). Alertas da equipe: ordem 27cfd36a.
  const [alertasEquipe, setAlertasEquipeUi] = useState<boolean | null>(null);
  // Prompt 44 (item 4): categorias desligadas (null = carregando). Decisões e segurança não desligam.
  const [desligadas, setDesligadas] = useState<CategoriaComInterruptor[] | null>(null);

  useEffect(() => {
    let vivo = true;
    getNotifPrefs()
      .then((p) => vivo && setPrefs(p))
      .catch(() => vivo && setPrefs({ email: true }));
    getAlertasEquipe()
      .then((v) => vivo && setAlertasEquipeUi(v))
      .catch(() => vivo && setAlertasEquipeUi(null));
    getCategoriasDesligadas()
      .then((v) => vivo && setDesligadas(v))
      .catch(() => vivo && setDesligadas([]));
    return () => {
      vivo = false;
    };
  }, []);

  async function alternar(chave: "email") {
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

  async function alternarEquipe() {
    if (alertasEquipe === null) return;
    const anterior = alertasEquipe;
    setAlertasEquipeUi(!anterior);
    setErro(null);
    setOk(false);
    setSalvando("equipe");
    const r = await setAlertasEquipe(!anterior).catch(() => ({ ok: false as const, error: "Sem conexão." }));
    setSalvando(null);
    if (!r.ok) {
      setAlertasEquipeUi(anterior);
      setErro("Não foi possível salvar a preferência. Tente de novo.");
      return;
    }
    setOk(true);
  }

  async function alternarCategoria(c: CategoriaComInterruptor) {
    if (!desligadas) return;
    const anterior = desligadas;
    const novo = anterior.includes(c) ? anterior.filter((x) => x !== c) : [...anterior, c];
    setDesligadas(novo);
    setErro(null);
    setOk(false);
    setSalvando(c);
    const r = await setCategoriasDesligadas(novo).catch(() => ({ ok: false as const, error: "Sem conexão." }));
    setSalvando(null);
    if (!r.ok) {
      setDesligadas(anterior);
      setErro("Não foi possível salvar a preferência. Tente de novo.");
      return;
    }
    setOk(true);
  }

  const items: { key: "email"; label: string; hint: string }[] = [
    {
      key: "email",
      label: "Avisos por e-mail",
      hint: "Manutenção, novos interessados, mensagens e respostas aos seus pedidos. Ligado por padrão. Os avisos no app sempre aparecem.",
    },
  ];
  return (
    <Panel title={titulo ?? undefined} className="mt-6" data-testid="notificacoes-painel">
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
              <span className="mt-1 block text-xs text-muted">{it.hint}</span>
            </span>
            <Switch
              checked={prefs ? prefs[it.key] : false}
              onChange={() => alternar(it.key)}
              label={it.label}
              disabled={!prefs || salvando !== null}
            />
          </div>
        ))}
        <div className="rounded-xl border border-sage-200 px-4 py-3" data-testid="notif-categorias">
          <p className="text-sm font-medium text-ink">Por tipo de aviso</p>
          <p className="mt-1 text-xs text-muted">Desligado, o tipo não chega por push nem por e-mail.</p>
          <ul className="mt-2 divide-y divide-sage-100">
            {(["decisao", "seguranca"] as const).map((c) => (
              <li key={c} className="flex items-center justify-between gap-3 py-2" data-testid={`notif-categoria-${c}`}>
                <span>
                  <span className="block text-sm text-ink">{ROTULO_CATEGORIA[c]}</span>
                  <span className="block text-xs text-muted">{DICA_CATEGORIA[c]}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">Sempre chegam</span>
              </li>
            ))}
            {CATEGORIAS_COM_INTERRUPTOR.map((c) => (
              <li key={c} className="flex items-center justify-between gap-3 py-2" data-testid={`notif-categoria-${c}`}>
                <span>
                  <span className="flex items-center gap-2 text-sm text-ink">
                    {ROTULO_CATEGORIA[c]}
                    {salvando === c && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
                  </span>
                  <span className="block text-xs text-muted">{DICA_CATEGORIA[c]}</span>
                </span>
                <Switch
                  checked={desligadas ? !desligadas.includes(c) : true}
                  onChange={() => alternarCategoria(c)}
                  label={ROTULO_CATEGORIA[c]}
                  disabled={!desligadas || salvando !== null}
                />
              </li>
            ))}
          </ul>
        </div>
        {alertasEquipe !== null && (
          <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-sage-200 px-4 py-3 text-left">
            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <Bell className="h-4 w-4 text-sage" /> Receber alertas da equipe
                {salvando === "equipe" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
              </span>
              <span className="mt-1 block text-xs text-muted">Documento na fila, chamados e parceiros em análise.</span>
            </span>
            <Switch checked={alertasEquipe} onChange={alternarEquipe} label="Receber alertas da equipe" disabled={salvando !== null} />
          </div>
        )}
      </div>
      <AtivarNotificacoes className="mt-3" />
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
  const captcha = useCaptcha();

  function reset() {
    setStep(0);
    setPassword("");
    setError(null);
  }

  async function confirmDelete() {
    setError(null);
    if (!podeEnviar(captcha.ligado, captcha.token)) {
      setError(MSG_CAPTCHA_PENDENTE);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      if (supabase) {
        // Confirma a identidade reautenticando com a senha atual.
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: user?.email ?? "",
          password,
          options: comCaptcha({}, captcha.token),
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
      captcha.reset();
    }
  }

  return (
    <Panel title="Excluir conta" className="mt-6 border-red-200">
      <p className="text-sm font-medium text-red-600">
        {TEXTO_EXCLUSAO} Com locação ativa, a exclusão é bloqueada até o encerramento.
      </p>

      {step === 0 && (
        <Button variant="destructive" className="mt-4" onClick={() => setStep(1)}>
          <Trash2 className="h-4 w-4" /> Quero excluir minha conta
        </Button>
      )}

      {step === 1 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">
            Ao excluir, apagamos sua conta e seus dados pessoais:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-red-700">
            <li>Dados pessoais e perfil de verificação</li>
            <li>Anúncios e imóveis cadastrados</li>
            <li>Favoritos, candidaturas e mensagens</li>
          </ul>
          <p className="mt-2 text-xs text-red-700">
            Contratos assinados e registros financeiros são guardados pelo prazo legal, com acesso restrito.
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
          {captcha.widget && <div className="mt-3">{captcha.widget}</div>}
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={password.length === 0 || loading || !podeEnviar(captcha.ligado, captcha.token)}
              onClick={confirmDelete}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sim, excluir minha conta
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-sage-200 bg-white px-4 py-3 text-sm outline-none focus:border-sage read-only:bg-surface-2 read-only:text-muted"
      />
    </label>
  );
}
