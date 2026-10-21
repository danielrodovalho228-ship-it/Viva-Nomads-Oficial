"use client";

import { useEffect, useState } from "react";
import { gravarLocalStorageBruto, useLocalStorageBruto } from "@/lib/use-client-state";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  ShieldAlert,
  BadgeCheck,
  Fingerprint,
  ScanFace,
  FileCheck2,
  Zap,
  Loader2,
  Info,
  Lock,
  BellRing,
  Check,
  Search,
  Megaphone,
} from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { OwnerDecisionNotice } from "@/components/legal-notice";
import { VerificationBadge } from "@/components/verification-badge";
import { TRAFFIC_LIGHT_META, type CafResult } from "@/lib/closing";
import { useAuthStore } from "@/lib/store";
import { useViewMode } from "@/lib/roles";
import { useDashDemo, DemoBadge } from "@/lib/demo/demo-mode";
import { cn } from "@/lib/utils";
import type { EstadoIdentidade } from "@/lib/identidade/estado";
import { NOTA_VERIFICACAO_TESTE, ramoVerificacao } from "@/lib/contas-de-teste";
import { validadeDoLaudo } from "@/lib/caf/validade";

/**
 * Estados futuros da verificação (preparados; a integração real entra depois):
 *   nao_verificado → em_andamento → verificado → expirado
 * Hoje: conta REAL fica sempre em `nao_verificado` (parceiro em estruturação);
 * o modo DEMONSTRAÇÃO (admin) simula o fluxo até `verificado` para vitrine.
 */
export type VerifStatus = "nao_verificado" | "em_andamento" | "verificado" | "expirado";

type VerifyCopy = {
  title: string;
  subtitle: string;
  heading: string;
  badge: string;
  button: string;
  ctaTitle: string;
  ctaBody: string;
  unlocks: readonly string[];
};

const VERIFY_COPY: Record<"tenant" | "owner", VerifyCopy> = {
  tenant: {
    title: "Verificação",
    subtitle: "Verifique uma vez e candidate-se com um clique em qualquer imóvel.",
    heading: "Crie seu passaporte de locação",
    badge: "Identidade conferida",
    button: "Verificar identidade como inquilino",
    ctaTitle: "Candidatura com um clique ativada",
    ctaBody:
      "Ao encontrar um imóvel, basta clicar em Candidatar-se: enviamos o resumo do resultado (sem seus documentos) e uma mensagem ao proprietário automaticamente.",
    unlocks: [
      "Candidatura com 1 clique em qualquer imóvel",
      "O resumo do resultado enviado ao proprietário automaticamente",
    ],
  },
  owner: {
    title: "Verificação",
    subtitle: "Verifique seu perfil para gerar mais confiança e converter mais interessados.",
    heading: "Construa a confiança do seu anúncio",
    badge: "Proprietário Verificado",
    button: "Verificar meu perfil de proprietário",
    ctaTitle: "Selo de confiança ativado",
    ctaBody:
      "Seu selo Proprietário Verificado passa a aparecer nos seus anúncios — mais confiança e melhor conversão dos interessados.",
    unlocks: [
      "Selo Proprietário Verificado nos seus anúncios",
      "Mais confiança e conversão dos interessados",
    ],
  },
}

export default function VerificationPage() {
  const demo = useDashDemo();
  const { mode } = useViewMode();
  // Intenção explícita (?como=inquilino|proprietario) tem prioridade sobre o
  // modo atual: um proprietário-admin que chega aqui por um CTA de CANDIDATURA
  // (ação de inquilino) precisa ver a cópia de inquilino, não a de proprietário.
  const params = useSearchParams();
  const como = params.get("como");
  const perfilCopy: "tenant" | "owner" =
    como === "inquilino" ? "tenant" : como === "proprietario" ? "owner" : mode;
  const C = VERIFY_COPY[perfilCopy];

  return (
    <div className="w-full">
      <PageTitle capa="verificacao" title={C.title} subtitle={C.subtitle} />
      {demo ? <DemoFlow copy={C} mode={mode} /> : <VerificacaoDaConta copy={C} perfil={perfilCopy} />}
    </div>
  );
}

type StatusCaf = { teste: boolean; feita: boolean; ok: boolean; validoAte: string | null; identidade: EstadoIdentidade | null };

/** A linha do estado da identidade: o texto vem SEMPRE da fonte única (complemento do prompt 23). */
function LinhaIdentidade({ id }: { id: EstadoIdentidade }) {
  return (
    <p
      className={cn(
        "rounded-xl px-4 py-3 text-sm font-semibold",
        id.estado === "confirmada" ? "bg-green-50 text-green-900" : id.estado === "em_breve" ? "bg-amber-50 text-amber-900" : "bg-surface-2 text-ink",
      )}
      data-testid="identidade-estado"
      data-estado={id.estado}
    >
      {id.texto}
    </p>
  );
}

/**
 * Prompt 23 (item 3): o servidor diz se a conta é de teste (/api/caf/status lê profiles.is_teste). Conta de teste →
 * laudo SIMULADO pela /api/caf/verify, rotulado "TESTE — verificação simulada"; conta real → segue "em breve".
 */
function VerificacaoDaConta({ copy, perfil }: { copy: VerifyCopy; perfil: "tenant" | "owner" }) {
  const [status, setStatus] = useState<StatusCaf | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let vivo = true;
    fetch("/api/caf/status")
      .then((r) => (r.ok ? (r.json() as Promise<Partial<StatusCaf>>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (vivo) setStatus({ teste: d.teste === true, feita: d.feita === true, ok: d.ok === true, validoAte: d.validoAte ?? null, identidade: d.identidade ?? null });
      })
      .catch(() => {
        if (vivo) setErro(true);
      });
    return () => {
      vivo = false;
    };
  }, []);
  // O ramo segue o estado único: "em breve" → conta real sem a CAF; os demais (confirmada, vencida, simulável) → laudo.
  const ramo = ramoVerificacao({ demo: false, teste: erro ? false : status ? status.identidade?.estado !== "em_breve" : null });
  if (ramo === "carregando") {
    return (
      <Panel className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando a sua verificação…
      </Panel>
    );
  }
  return (
    <div className="space-y-4">
      {status?.identidade && <LinhaIdentidade id={status.identidade} />}
      {ramo === "teste" && status ? (
        <TesteFlow copy={copy} perfil={perfil} inicial={status} onStatus={(st) => setStatus(st)} />
      ) : (
        <RealNaoVerificado copy={copy} perfil={perfil} />
      )}
    </div>
  );
}

/* Conta de TESTE (is_teste): laudo simulado de ponta a ponta, sempre rotulado — nunca vale como verificação real. */
function TesteFlow({ copy, perfil, inicial, onStatus }: { copy: VerifyCopy; perfil: "tenant" | "owner"; inicial: StatusCaf; onStatus: (s: StatusCaf) => void }) {
  const [laudo, setLaudo] = useState<{ ok: boolean; validoAte: string | null } | null>(
    inicial.feita ? { ok: inicial.ok, validoAte: inicial.validoAte } : null
  );
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function verificar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/caf/verify", { method: "POST" });
      const r = (await res.json().catch(() => ({}))) as Partial<CafResult> & { error?: string };
      if (!res.ok || !r.light) {
        setErro(r.error ?? "Não foi possível fazer a verificação simulada agora. Tente de novo.");
        return;
      }
      const st = (await fetch("/api/caf/status").then((x) => x.json()).catch(() => ({}))) as Partial<StatusCaf>;
      setLaudo({ ok: r.identity === true && r.liveness === true && r.document === true, validoAte: st.validoAte ?? null });
      // A linha do estado (topo) passa a "Identidade confirmada · válida até …", pela fonte única.
      onStatus({ teste: st.teste === true, feita: st.feita === true, ok: st.ok === true, validoAte: st.validoAte ?? null, identidade: st.identidade ?? null });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="verificacao-teste">
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase text-amber-800">
        Conta de teste
      </span>
      {!laudo ? (
        <Panel className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage-100">
            <ShieldCheck className="h-8 w-8 text-forest" />
          </div>
          <h2 className="mt-4 font-title text-xl font-semibold text-ink">{copy.heading}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Esta é uma conta de teste: a verificação é <strong>simulada</strong>, sem documento, sem CPF e sem consulta ao
            parceiro. Serve para seguir a jornada até a assinatura.
          </p>
          <Button variant="gold" className="mt-6" onClick={verificar} disabled={carregando} data-testid="verificacao-teste-verificar">
            {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
            {carregando ? "Verificando..." : "Fazer a verificação simulada"}
          </Button>
          {erro && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {erro}
            </p>
          )}
        </Panel>
      ) : (
        <>
          <Panel data-testid="verificacao-teste-laudo">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-champagne text-forest">
                <BadgeCheck className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <h2 className="font-title text-lg font-semibold text-ink">{laudo.ok ? copy.badge : "Verificação simulada"}</h2>
                <p className="text-sm font-semibold text-amber-800" data-testid="verificacao-teste-rotulo">
                  {NOTA_VERIFICACAO_TESTE}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <Item icon={Fingerprint} label="Identidade" ok={laudo.ok} />
              <Item icon={ScanFace} label="Prova de vida" ok={laudo.ok} />
              <Item icon={FileCheck2} label="Documento" ok={laudo.ok} />
            </div>

          </Panel>
          {perfil === "tenant" && (
            <Panel>
              <h3 className="font-title font-semibold text-ink">Siga a jornada</h3>
              <p className="mt-1 text-sm text-muted">
                Candidate-se a um imóvel; depois do aceite, o fechamento usa este resultado simulado até a assinatura.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href="/dashboard/candidaturas" variant="primary" data-testid="verificacao-teste-continuar">
                  Minhas candidaturas
                </ButtonLink>
                <ButtonLink href="/buscar" variant="outline">
                  <Search className="h-4 w-4" /> Buscar imóveis
                </ButtonLink>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   CONTA REAL — integração via parceiro EM ESTRUTURAÇÃO.
   Nunca nasce verificada nem exibe selo sem verificação real concluída.
   ───────────────────────────────────────────────────────────────────────── */
function RealNaoVerificado({ copy, perfil }: { copy: VerifyCopy; perfil: "tenant" | "owner" }) {
  const [avisarLocal, setAvisar] = useState(false);
  const interesseGravado = useLocalStorageBruto("vivanomads-verif-interesse");
  const avisar = avisarLocal || !!interesseGravado;

  function registrarInteresse() {
    // Placeholder honesto: registra o interesse no navegador. Quando existir a
    // lista de espera no servidor, este clique passa a gravá-la também.
    gravarLocalStorageBruto("vivanomads-verif-interesse", "1");
    setAvisar(true);
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">
              <ShieldAlert className="h-7 w-7" />
            </span>
            <div>
              <h2 className="font-title text-lg font-semibold text-ink">Não verificado</h2>
              <p className="text-sm text-muted">A verificação de identidade ainda não abriu para contas reais.</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
            <Info className="h-3.5 w-3.5" /> Disponível em breve
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-sage-200 bg-surface-2 p-4">
          <p className="text-sm font-medium text-ink">O que a verificação destrava:</p>
          <ul className="mt-2 space-y-2">
            {copy.unlocks.map((u) => (
              <li key={u} className="flex items-start gap-2 text-sm text-muted">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-sage" /> {u}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {avisar ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-4 py-2 text-sm font-medium text-forest">
              <Check className="h-4 w-4" /> Avisaremos você assim que abrir.
            </span>
          ) : (
            <Button variant="gold" onClick={registrarInteresse}>
              <BellRing className="h-4 w-4" /> Avisar-me quando abrir
            </Button>
          )}
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          <Lock className="mt-1 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">
            Você já pode se candidatar sem o selo — o proprietário vê{" "}
            <strong className="text-ink">verificação pendente</strong> no lugar do resultado até a
            verificação abrir. Seus dados serão tratados apenas para a verificação (LGPD).
          </span>
        </p>

        {/* Inquilino: caminho REAL de conclusão — a candidatura acontece no
            anúncio, não aqui. Sem selo é permitido; damos o atalho. */}
        {perfil === "tenant" && (
          <div className="mt-4 border-t border-sage-200 pt-4">
            <p className="text-sm font-medium text-ink">Quer se candidatar agora?</p>
            <p className="mt-1 text-xs text-muted">
              Você não precisa esperar a verificação. Abra um imóvel e toque em{" "}
              <strong className="text-ink">Candidatar-se</strong> — o proprietário recebe seu perfil
              com a verificação marcada como pendente.
            </p>
            <ButtonLink href="/buscar" variant="secondary" className="mt-3">
              <Search className="h-4 w-4" /> Explorar imóveis
            </ButtonLink>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MODO DEMONSTRAÇÃO (admin) — simula o fluxo até "verificado" para vitrine.
   O selo aqui é SEMPRE rotulado como demonstração e não vale para conta real.
   ───────────────────────────────────────────────────────────────────────── */
function DemoFlow({
  copy,
  mode,
}: {
  copy: VerifyCopy;
  mode: "tenant" | "owner";
}) {
  const user = useAuthStore((s) => s.user);
  const [result, setResult] = useState<CafResult | null>(null);
  const [validUntil, setValidUntil] = useState("");
  const [loading, setLoading] = useState(false);

  async function verify() {
    setLoading(true);
    try {
      const res = await fetch("/api/caf/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Laudo usa o NOME COMPLETO do perfil (nunca o e-mail cru que o campo
        // `name` carrega como fallback técnico) — item 1 do fechamento do QA.
        body: JSON.stringify({ name: user?.fullName ?? "Inquilino" }),
      });
      setResult((await res.json()) as CafResult);
      setValidUntil(validadeDoLaudo(new Date()).toLocaleDateString("pt-BR"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <DemoBadge />
      </div>

      {!result ? (
        <Panel className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage-100">
            <ShieldCheck className="h-8 w-8 text-forest" />
          </div>
          <h2 className="mt-4 font-title text-xl font-semibold text-ink">{copy.heading}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Confirmamos sua <strong>identidade</strong> (documento + foto) para dar segurança à
            negociação.
          </p>
          <div className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm">
            <Bullet>Identidade confirmada por documento oficial e foto (selfie).</Bullet>
            <Bullet>Análise antifraude, com um resumo do resultado para o proprietário (sem os documentos).</Bullet>
            <Bullet>Cobre brasileiros e estrangeiros (documento de estrangeiro CRNM/RNE).</Bullet>
          </div>
          <Button variant="gold" className="mt-6" onClick={verify} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Verificando..." : copy.button}
          </Button>
        </Panel>
      ) : (
        <>
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-champagne text-forest">
                  <BadgeCheck className="h-7 w-7" />
                </span>
                <div>
                  <h2 className="font-title text-lg font-semibold text-ink">
                    {copy.badge} {TRAFFIC_LIGHT_META[result.light].emoji}
                  </h2>
                  <p className="text-sm text-muted">Verificação de demonstração</p>
                </div>
              </div>
              <VerificationBadge />
            </div>

            <div className="mt-4 grid gap-2">
              <Item icon={Fingerprint} label="Identidade" ok={result.identity} />
              <Item icon={ScanFace} label="Prova de vida" ok={result.liveness} />
              <Item icon={FileCheck2} label="Documento" ok={result.document} />
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Info className="mt-1 h-3.5 w-3.5 shrink-0" />
              Verificação de <strong>demonstração</strong> (válida só nesta vitrine). A real é
              feita <strong>via parceiro — em estruturação</strong>; só então o selo vale de fato
              e a validade de {validUntil ? `até ${validUntil}` : "12 meses"} passa a contar.
            </p>
          </Panel>

          <Panel className="flex items-start gap-3 bg-forest text-white">
            <Zap className="mt-1 h-5 w-5 shrink-0 text-champagne" />
            <div>
              <h3 className="font-title font-semibold">{copy.ctaTitle}</h3>
              <p className="text-sm text-white/80">{copy.ctaBody}</p>
            </div>
          </Panel>

          {/* Tela de sucesso do "verificado" termina com os dois caminhos
              (emenda no passo 2 do checklist de primeiro acesso do inquilino). */}
          {mode === "tenant" && (
            <Panel>
              <h3 className="font-title font-semibold text-ink">Agora é encontrar seu lugar</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href="/buscar" variant="primary">
                  <Search className="h-4 w-4" /> Buscar imóveis
                </ButtonLink>
                <ButtonLink href="/pedidos/novo" variant="outline">
                  <Megaphone className="h-4 w-4" /> Publicar um Pedido de Moradia
                </ButtonLink>
              </div>
            </Panel>
          )}

          <OwnerDecisionNotice />
        </>
      )}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-muted">
      <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-sage" />
      <span>{children}</span>
    </p>
  );
}

function Item({
  icon: Icon,
  label,
  ok,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  ok: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        ok ? "border-sage bg-sage-100 text-forest" : "border-sage-200 text-muted"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}
