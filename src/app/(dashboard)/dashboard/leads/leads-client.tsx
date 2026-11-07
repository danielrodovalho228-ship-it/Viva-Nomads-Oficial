"use client";

import { dataBRT } from "@/lib/datas-brasilia";
import { VazioOnboardingBloco } from "@/components/onboarding/vazio-onboarding";
import { VAZIOS_ONBOARDING } from "@/lib/onboarding/vazios";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Lock, X, Check, Send, ArrowDownWideNarrow, MessageSquare, UserRound, BadgeCheck, Star, Dot } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { OwnerDecisionNotice } from "@/components/legal-notice";
import { leadScore, leadSummary, type Lead, type Light } from "@/lib/data/lead-types";
import { FichaPetCandidatura } from "@/components/pets/ficha-pet-candidatura";
import { aceitarCandidatura, recusarCandidatura } from "@/lib/data/leads-actions";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_LEADS } from "@/lib/demo/seed";
import { cn } from "@/lib/utils";
import { LINK_DOCUMENTO, MSG_DOCUMENTO } from "@/lib/documento-pessoa";
import { SeloLinkedin } from "@/components/confianca/selo-linkedin";
import { ehSeloLinkedin } from "@/lib/linkedin/textos";
import { SeloVinculo } from "@/components/confianca/selo-vinculo";
import { dominioDoSelo, ehSeloVinculo } from "@/lib/vinculo/textos";
import { identidadeParaOutraParte } from "@/lib/identidade/estado";
import { textoDoErro } from "@/lib/erro-de-rede";
import { MSG_APROVAR_FALHOU, MSG_RECUSAR_FALHOU } from "@/lib/interessados/erros";
import { hrefPerfilCandidato } from "@/lib/notifications/dados-candidatura";

/** E553: o perfil completo só existe para candidatura real (a mesma regra UUID_LEAD de perfilDoCandidato). */
const UUID_CANDIDATURA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Motivos de recusa pré-definidos (quick win #3). */
const REJECT_REASONS = [
  "Período não combina",
  "Imóvel já alugado",
  "Perfil não atende",
  "Aguardando outro interessado",
];

const LIGHT: Record<Light, { tone: string; label: string }> = {
  green: { tone: "bg-emerald-100 text-emerald-700", label: "Perfil limpo" },
  yellow: { tone: "bg-amber-100 text-amber-700", label: "Atenção" },
  red: { tone: "bg-red-100 text-red-700", label: "Alto risco" },
};

type LeadStatus = "open" | "approved" | "rejecting" | "rejected";

/** E541: abre a conversa DESTA candidatura (antes, a caixa abria a primeira da lista — de outra pessoa). */
function hrefResponder(l: { conversaId?: string }): string {
  return l.conversaId ? `/dashboard/mensagens?conversa=${l.conversaId}` : "/dashboard/mensagens";
}

/** Estado inicial da UI a partir do status PERSISTIDO (sobrevive a refresh). */
function uiInicial(persisted: string | undefined): LeadStatus {
  if (persisted === "accepted") return "approved";
  if (persisted === "rejected") return "rejected";
  return "open";
}

/** E569: o que falta ao dono para aceitar (documento), mostrado antes de qualquer clique. */
type PendenciaDono = { texto: string; href: string; rotulo: string } | null;

export function LeadsClient({ leads: realLeads, pendencia = null }: { leads: Lead[]; pendencia?: PendenciaDono }) {
  const [status, setStatus] = useState<Record<string, LeadStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Modo demonstração (admin): lê o seed em memória; desligado, volta ao real.
  const { on: demoOn } = useDemoMode();
  const leads = demoOn ? DEMO_LEADS : realLeads;

  function set(id: string, s: LeadStatus) {
    setStatus((prev) => ({ ...prev, [id]: s }));
  }

  /** Aprova: persiste no servidor (real) e atualiza a UI. Demo: só UI. */
  function aprovar(id: string) {
    // E569: o cartão só muda para "aprovado" depois que o servidor confirma — antes, o "Responder pela plataforma"
    // aparecia por um instante e sumia quando o servidor recusava (ex.: falta o documento do dono).
    if (demoOn) return set(id, "approved");
    startTransition(async () => {
      // Auditoria de erros (achado nº 3): sem conexão a ação REJEITA dentro da transição — sem o try, o erro subia ao
      // limite de erro e a tela inteira caía. Agora reverte o cartão e diz o motivo em português.
      let r: Awaited<ReturnType<typeof aceitarCandidatura>>;
      try {
        r = await aceitarCandidatura(id);
      } catch (e) {
        set(id, "open");
        setErro(textoDoErro(e, MSG_APROVAR_FALHOU));
        return;
      }
      if (!r.ok) {
        set(id, "open"); // o servidor recusou — o cartão segue aberto e diz por quê
        setErro(r.error ?? MSG_APROVAR_FALHOU);
      } else {
        set(id, "approved");
        setErro(null);
      }
    });
  }

  /** Recusa: persiste no servidor (real, silencioso) e atualiza a UI. */
  function recusar(id: string) {
    set(id, "rejected");
    if (demoOn) return;
    const motivo = reasons[id];
    startTransition(async () => {
      // Achado nº 3: a recusa também não derruba a tela sem conexão, e a falha agora é dita (antes só voltava, calada).
      let r: Awaited<ReturnType<typeof recusarCandidatura>>;
      try {
        r = await recusarCandidatura(id, motivo);
      } catch (e) {
        set(id, "rejecting");
        setErro(textoDoErro(e, MSG_RECUSAR_FALHOU));
        return;
      }
      if (!r.ok) {
        set(id, "rejecting");
        setErro(r.error ?? MSG_RECUSAR_FALHOU);
      } else setErro(null);
    });
  }

  // Ordena por qualidade: verificados e de perfil verde no topo (quick win).
  const ordered = [...leads].sort((a, b) => leadScore(a) - leadScore(b));

  return (
    <>
      <PageTitle
        title="Interessados"
        subtitle="Moradores interessados. Você vê o necessário para decidir; ao aprovar, responda pela plataforma — onde a conversa fica registrada e protegida."
        action={demoOn ? <DemoBadge /> : undefined}
      />

      {erro && (
        <div role="alert" data-testid="aceite-erro" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{erro}</p>
          {erro === MSG_DOCUMENTO.aceitar && (
            <Link href={LINK_DOCUMENTO} className="mt-2 inline-block font-semibold text-forest underline">
              Informar meu documento
            </Link>
          )}
        </div>
      )}

      {/* E569: requisito pendente do dono, ANTES de qualquer clique, com o caminho para resolver. */}
      {pendencia && !demoOn && leads.some((l) => (status[l.id] ?? uiInicial(l.status)) === "open") && (
        <div role="status" id="pendencia-dono-aceite" data-testid="pendencia-dono-aceite" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{pendencia.texto}</p>
          <Link href={pendencia.href} className="mt-2 inline-block font-semibold text-forest underline" data-testid="pendencia-dono-link">
            {pendencia.rotulo}
          </Link>
        </div>
      )}

      {leads.length === 0 ? (
        <VazioOnboardingBloco vazio={VAZIOS_ONBOARDING.interessados} />
      ) : (
        <>
          <p className="mb-3 flex items-center gap-2 text-xs text-muted">
            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
            Ordenados por qualidade — verificados e compatíveis no topo.
          </p>
          <div className="grid gap-4">
            {ordered.map((l) => {
            const st = status[l.id] ?? uiInicial(l.status);
            const open = st === "approved";
            const perfilHref = !demoOn && UUID_CANDIDATURA.test(l.id) ? hrefPerfilCandidato(l.id) : null;
            return (
              // E202 (candidatura): o e-mail ao dono aponta para este cartão (#candidato-<id>).
              <Panel key={l.id} id={`candidato-${l.id}`} className="scroll-mt-24">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3" data-testid="cartao-candidato">
                    {/* Foto só depois do aceite; antes, um avatar neutro (sem inicial nem nome). */}
                    {(() => {
                      const foto = l.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.fotoUrl} alt={`Foto de ${l.name}`} className="h-12 w-12 shrink-0 rounded-full object-cover" data-testid="candidato-foto" />
                      ) : (
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-sage-100 text-forest" aria-hidden>
                          <UserRound className="h-6 w-6" />
                        </span>
                      );
                      // E553: a foto abre o mesmo perfil do nome (fora da ordem do Tab: o nome já é o link).
                      return perfilHref ? (
                        <Link href={perfilHref} tabIndex={-1} aria-hidden className="shrink-0 rounded-full" data-testid="candidato-perfil-foto">
                          {foto}
                        </Link>
                      ) : (
                        foto
                      );
                    })()}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Semáforo em destaque, primeiro (o que decide) */}
                      <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", LIGHT[l.light].tone)}>
                        {LIGHT[l.light].label}
                      </span>
                      <h2 className="font-title text-lg font-semibold text-ink" data-testid="candidato-nome">
                        {/* E553: o nome abre o perfil completo do candidato (padrão dos títulos clicáveis do painel). */}
                        {perfilHref ? (
                          <Link href={perfilHref} className="alvo-toque hover:text-forest focus-visible:text-forest" data-testid="candidato-perfil-link">
                            {l.name}
                          </Link>
                        ) : (
                          l.name
                        )}
                      </h2>
                      {/* PROP-3 (E118): verificada/pendente pela MESMA função do Fechamento; sem os textos "para mim". */}
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-xs font-semibold",
                          identidadeParaOutraParte(l.identidade).verificada ? "bg-champagne text-night" : "bg-surface-2 text-muted",
                        )}
                        data-testid="candidato-identidade"
                        data-estado={l.identidade?.estado ?? "pendente"}
                      >
                        {identidadeParaOutraParte(l.identidade).rotulo}
                      </span>
                    </div>
                    {/* Resumo do candidato em uma linha */}
                    <p className="mt-1 text-sm font-medium text-ink">{leadSummary(l)}</p>
                    <p className="text-xs text-muted">interesse em {l.property}</p>
                    {l.enviadaEm && (
                      <p className="text-xs text-muted" data-testid="lead-enviada-em">
                        Enviada em {dataBRT(l.enviadaEm)}
                        {l.reenviada && l.primeiroEnvioEm ? ` · reenviada (primeiro envio em ${dataBRT(l.primeiroEnvioEm)})` : ""}
                      </p>
                    )}
                    {l.moradorVerificado && (
                      <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-forest" data-testid="selo-morador-verificado">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {l.moradorVerificado}
                      </p>
                    )}
                    {(l.sinais?.length || l.selos?.length || l.reputacao) && (
                      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink" data-testid="candidato-sinais">
                        {l.selos?.map((x) =>
                          ehSeloLinkedin(x) ? (
                            <li key={x}>
                              <SeloLinkedin />
                            </li>
                          ) : ehSeloVinculo(x) ? (
                            <li key={x}>
                              <SeloVinculo dominio={dominioDoSelo(x)} />
                            </li>
                          ) : (
                            <li key={x} className="inline-flex items-center gap-1 font-semibold text-forest">
                              <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {x}
                            </li>
                          ),
                        )}
                        {l.reputacao && (
                          <li className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-champagne text-champagne" aria-hidden />
                            {l.reputacao.media.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} · {l.reputacao.n}{" "}
                            {l.reputacao.n === 1 ? "avaliação de proprietário" : "avaliações de proprietários"}
                          </li>
                        )}
                        {l.sinais?.map((x) => (
                          <li key={x} className="inline-flex items-center gap-1 text-muted">
                            <Dot className="h-3.5 w-3.5" aria-hidden /> {x}
                          </li>
                        ))}
                      </ul>
                    )}
                    {l.fichaPet && <FichaPetCandidatura alvo={{ leadId: l.id }} resumo={l.fichaPet} className="mt-2" />}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {l.riskCategories.map((c) => (
                        <span key={c} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 text-right">
                    {/* E569: o "Responder pela plataforma" fica visível no cartão (antes e depois do aceite) e abre a
                        conversa DESTE morador neste imóvel (a lista de Mensagens já traz a conversa da candidatura). */}
                    {st !== "rejected" && (
                      <ButtonLink href={hrefResponder(l)} variant={open ? "secondary" : "outline"} size="sm" data-testid="responder-pela-plataforma">
                        <MessageSquare className="h-4 w-4" /> Responder pela plataforma
                      </ButtonLink>
                    )}
                    {open ? null : st === "rejected" ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                        <X className="h-4 w-4" /> Recusado
                      </span>
                    ) : st !== "rejecting" ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => set(l.id, "rejecting")}
                          className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" /> Recusar
                        </button>
                        <button
                          onClick={() => aprovar(l.id)}
                          disabled={pending}
                          aria-describedby={pendencia && !demoOn ? "pendencia-dono-aceite" : undefined}
                          className={buttonClasses({ variant: "secondary", size: "sm" })}
                          data-testid="aprovar-candidatura"
                        >
                          <Check className="h-4 w-4" /> Aprovar e responder
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Formulário de recusa com motivo (Fluxo 7 + motivos rápidos) */}
                {st === "rejecting" && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">
                      Recusar {l.name} — escolha um motivo (fica registrado para seu controle;
                      o interessado vê apenas que a candidatura não seguiu adiante)
                    </p>
                    {/* Motivos pré-definidos em um clique (quick win #3) */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {REJECT_REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReasons((p) => ({ ...p, [l.id]: r }))}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            reasons[l.id] === r
                              ? "border-red-400 bg-red-100 text-red-700"
                              : "border-red-200 bg-white text-red-600 hover:bg-red-100"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reasons[l.id] ?? ""}
                      onChange={(e) => setReasons((p) => ({ ...p, [l.id]: e.target.value }))}
                      rows={2}
                      placeholder="Ou escreva um motivo personalizado…"
                      className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        onClick={() => set(l.id, "open")}
                        className="rounded-full px-4 py-2 text-sm font-medium text-muted hover:text-ink"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => recusar(l.id)}
                        disabled={!(reasons[l.id] ?? "").trim() || pending}
                        className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" /> Confirmar recusa
                      </button>
                    </div>
                  </div>
                )}

                {st === "rejected" && reasons[l.id] && (
                  <p className="mt-3 flex items-start gap-2 text-xs text-muted">
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0" />
                    Motivo registrado (não enviado ao interessado): “{reasons[l.id]}”
                  </p>
                )}

                {st === "open" && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                    <Lock className="h-3.5 w-3.5" />
                    Telefone e e-mail nunca são exibidos — a conversa segue pela plataforma. O
                    endereço exato do imóvel é liberado após o aceite.
                  </p>
                )}

                {(st === "open" || open) && (
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {/* Prompt 17: a proposta nasce do interessado real (sem nome ou contato digitado à mão). */}
                    <ButtonLink href={`/dashboard/orcamentos/nova?interessado=${l.id}`} variant="secondary" size="sm" data-testid="enviar-proposta-lead">
                      Enviar proposta
                    </ButtonLink>
                    {open && (
                      <ButtonLink href={`/dashboard/fechamento?c=${l.id}`} variant="secondary" size="sm">
                        Iniciar fechamento
                      </ButtonLink>
                    )}
                  </div>
                )}
              </Panel>
            );
          })}
          </div>
        </>
      )}

      <OwnerDecisionNotice className="mt-4" />
    </>
  );
}
