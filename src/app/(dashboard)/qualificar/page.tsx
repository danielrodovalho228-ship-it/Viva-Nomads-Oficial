"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Upload,
  Award,
  ArrowRight,
  AlertTriangle,
  Laptop,
  MapPin,
  Info,
  ShieldCheck,
  DoorOpen,
  Armchair,
  Wifi,
  Building2,
  Users,
  Coffee,
} from "lucide-react";
import Image from "next/image";
import { validarArquivoDoc } from "@/lib/upload-limits";
import {
  type EligibilityState,
  type QualityState,
  type TagItem,
  eligibilityChecks,
  isEligible,
  temPendenciaConvencao,
  readyToLiveItems,
  readyToLiveScore,
  homeOfficeItems,
  workLocatedItems,
  tagHomeOffice,
  tagWorkLocated,
  tagCondoApproved,
  READY_TO_LIVE_THRESHOLD,
} from "@/lib/qualification";
import { INTERNET_TIERS, INTERNET_META, type InternetTier } from "@/lib/internet";
import { Button } from "@/components/ui/button";
import { ReadyToLiveBadge, DocConferidaBadge } from "@/components/ui/badge";
import { saveQualification, getMyDocumentStatus, type DocumentStatus } from "@/lib/data/actions";
import { cn } from "@/lib/utils";

const initialEligibility: EligibilityState = {
  furnished: false,
  accepts30days: false,
  iptuOk: false,
  habitable: false,
  isOwnerOrAgent: false,
  hasDocument: false,
  condoAllows: "", // neutro: nada pré-selecionado (N3)
};

const initialQuality: QualityState = {
  furnishedFull: false,
  kitchenEquipped: false,
  beddingTowels: false,
  appliancesOk: false,
  internetTier: "basica",
  climateControl: false,
  cleanConserved: false,
  hasHomeOffice: false,
  hasDesk: false,
  hasChair: false,
  coworking2km: false,
  meetingRoom: false,
  cafe1km: false,
};

export default function QualificationChecklistPage() {
  const router = useRouter();
  const [elig, setElig] = useState<EligibilityState>(initialEligibility);
  const [quality, setQuality] = useState<QualityState>(initialQuality);
  const [docName, setDocName] = useState<string | null>(null);
  const [docPath, setDocPath] = useState<string | null>(null);
  const [docHash, setDocHash] = useState<string | null>(null);
  const [docErro, setDocErro] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // Estado da verificação do documento (reconciliar o veredito com a moderação —
  // ADENDO elegibilidade item 3). "none" até enviar; após salvar vira "pending".
  const [docStatus, setDocStatus] = useState<DocumentStatus>("none");
  const [docReason, setDocReason] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getMyDocumentStatus()
      .then((r) => {
        if (!alive) return;
        setDocStatus(r.status);
        setDocReason(r.reason);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // Só mostra o veredito (APROVADO/NÃO ELEGÍVEL) depois da 1ª interação — evita
  // banner vermelho prematuro num onboarding ainda neutro (N3).
  const [hasInteracted, setHasInteracted] = useState(false);

  const eligible = isEligible(elig);
  const score = useMemo(() => readyToLiveScore(quality), [quality]);
  const baseBadge = score >= READY_TO_LIVE_THRESHOLD;
  const condoBlocked = elig.condoAllows === "no";

  // Progresso e diagnóstico dos requisitos obrigatórios (item 1 do QA de
  // cadastro). Em vez da mensagem genérica quando tudo está satisfeito menos o
  // documento, apontamos EXATAMENTE o que falta.
  const reqChecks = eligibilityChecks(elig);
  const reqTotal = reqChecks.length; // 6 requisitos
  const reqDone = reqChecks.filter((c) => c.ok).length;
  const faltando = reqChecks.filter((c) => !c.ok);
  const soFaltaDoc =
    faltando.length === 1 && faltando[0].key === "hasDocument" && !condoBlocked;

  const requisitosOk = reqDone === reqTotal;
  const pendenciaConvencao = temPendenciaConvencao(elig); // "não sei"
  const precisaResponderConvencao = elig.condoAllows === "";

  function mensagemBasica(): string {
    if (soFaltaDoc)
      return "Envie a documentação do imóvel (matrícula ou contrato de gestão) para concluir.";
    if (faltando.length === 1) return `Falta 1 requisito: ${faltando[0].label}.`;
    if (faltando.length > 1)
      return `Faltam ${faltando.length} requisitos obrigatórios — complete os itens marcados acima.`;
    return "Complete os requisitos obrigatórios para concluir.";
  }

  type VeredictoTone = "green" | "amber" | "red" | "info";
  // Veredito reconciliado com a MODERAÇÃO (ADENDO elegibilidade): nunca diz
  // "APROVADO PARA PUBLICAR" no upload — só depois que o admin aprova.
  function veredito(): { tone: VeredictoTone; titulo: string; msg: string } {
    if (condoBlocked)
      return {
        tone: "red",
        titulo: "NÃO ELEGÍVEL",
        msg: "Se a convenção proíbe, não podemos publicar — anunciar contra a convenção expõe você a conflito com o condomínio e a cancelamento do contrato.",
      };
    if (!requisitosOk)
      return {
        tone: hasInteracted ? "red" : "info",
        titulo: hasInteracted
          ? soFaltaDoc
            ? "FALTA A DOCUMENTAÇÃO"
            : "REQUISITOS INCOMPLETOS"
          : "Vamos qualificar seu imóvel",
        msg: mensagemBasica(),
      };
    if (precisaResponderConvencao)
      return {
        tone: "info",
        titulo: "QUASE LÁ",
        msg: "Responda se o condomínio permite locação mobiliada de média duração para concluir.",
      };
    // Requisitos completos + convenção respondida (sim / não sei) → reflete a moderação.
    let base: { tone: VeredictoTone; titulo: string; msg: string };
    if (docStatus === "approved")
      base = { tone: "green", titulo: "APROVADO PARA PUBLICAR ✓", msg: "Documentação conferida. Seu anúncio pode ser publicado." };
    else if (docStatus === "rejected")
      base = { tone: "red", titulo: "DOCUMENTAÇÃO RECUSADA", msg: `${docReason ? docReason + ". " : ""}Envie o documento novamente.` };
    else
      base = {
        tone: "green",
        titulo: "REQUISITOS COMPLETOS",
        msg: "Documentação em análise pela equipe. Você já pode montar o anúncio; a publicação libera com a aprovação.",
      };
    if (pendenciaConvencao && docStatus !== "approved" && docStatus !== "rejected")
      base = {
        tone: "amber",
        titulo: "COMPLETO COM PENDÊNCIA",
        msg:
          base.msg +
          " Pendência: confirme a regra do seu condomínio antes do primeiro contrato — recomendamos resolver já (evita cancelamento e dor de cabeça com o síndico).",
      };
    return base;
  }

  const tHome = tagHomeOffice(quality);
  const tWork = tagWorkLocated(quality);
  const tCondo = tagCondoApproved(elig);

  function toggleElig(key: keyof EligibilityState) {
    setHasInteracted(true);
    setElig((s) => ({ ...s, [key]: !s[key as keyof EligibilityState] }));
  }
  function toggleQuality(key: keyof QualityState) {
    setQuality((s) => ({ ...s, [key]: !s[key] }));
  }

  async function save() {
    setSaving(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "vivanomads-qualification",
        JSON.stringify({ eligible, score, baseBadge, tHome, tWork, tCondo })
      );
    }
    await saveQualification(elig, quality, docPath, docHash);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Banner de topo (item 4): foto de interior SOB o gradiente da marca (lado
          esquerdo mais escuro), texto branco. Altura contida (~180px). */}
      <header
        className="relative mb-8 flex flex-col justify-center overflow-hidden rounded-2xl p-6 text-white sm:p-8"
        style={{ minHeight: 180 }}
      >
        <Image
          src="/media/banner-simulador.webp"
          alt=""
          aria-hidden
          fill
          sizes="100vw"
          className="pointer-events-none object-cover"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-night/90 via-forest/85 to-forest/60" />
        <div className="relative">
          <p className="font-title text-xs font-bold uppercase tracking-wide text-white/80">
            Antes de anunciar
          </p>
          <h1 className="mt-1 font-title text-2xl font-bold sm:text-3xl">Qualificação do imóvel</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
            Duas etapas rápidas: primeiro confirmamos que seu imóvel está pronto e regular para
            locação mobiliada de média duração. Depois, você soma pontos para conquistar o selo{" "}
            <span className="font-semibold">Pronto para Morar</span> — que dá destaque ao seu
            anúncio na busca.
          </p>
        </div>
      </header>

      {/* SEÇÃO 1 — REQUISITOS OBRIGATÓRIOS */}
      <section className="rounded-2xl border border-sage-200 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-sm font-bold text-white">
            1
          </span>
          <h2 className="font-title text-xl font-bold text-ink">Requisitos obrigatórios</h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          Se algum faltar, o imóvel não pode ser publicado.
        </p>

        <div className="mt-6 space-y-2">
          {/* Não exibe o item "Documentação enviada" como checkbox: ele é marcado
              automaticamente pelo campo de upload abaixo (evita confusão — item 4A). */}
          {eligibilityChecks(elig)
            .filter((c) => c.key !== "hasDocument")
            .map((c) => (
              <CheckRow
                key={c.key}
                checked={c.ok}
                label={c.label}
                onToggle={() => toggleElig(c.key as keyof EligibilityState)}
              />
            ))}

          <label
            className={cn(
              "flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors",
              "focus-within:outline-none focus-within:ring-2 focus-within:ring-forest focus-within:ring-offset-2",
              docName
                ? "border-sage bg-sage-100"
                : "border-sage-200 bg-surface-2 hover:border-sage"
            )}
          >
            <span className="flex items-center gap-3 text-sm">
              {docName ? (
                <CheckCircle2 className="h-5 w-5 text-forest" />
              ) : (
                <Upload className="h-5 w-5 text-sage" />
              )}
              <span>
                <span className="font-medium text-ink">
                  Documentação do imóvel{docName ? " — enviada ✓" : ""}
                </span>
                <span className="block text-xs text-muted">
                  {docName ?? "Matrícula ou contrato de gestão (PDF, JPG ou PNG)"}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {/* Estado do documento: pendente → enviado (a aprovação vem depois,
                  na revisão do anúncio). */}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  docName ? "bg-sage-100 text-forest" : "bg-amber-100 text-amber-800"
                )}
              >
                {docName ? "Enviado" : "Pendente"}
              </span>
              <span className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white">
                {docBusy ? "Enviando…" : docName ? "Trocar" : "Enviar"}
              </span>
            </span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              aria-label="Enviar documentação do imóvel (matrícula ou contrato de gestão)"
              className="sr-only"
              disabled={docBusy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = ""; // permite re-selecionar o mesmo arquivo
                setHasInteracted(true);
                if (!f) return;
                // Validação de tipo/tamanho no cliente; o bucket revalida no servidor.
                const invalido = validarArquivoDoc({ type: f.type, size: f.size });
                if (invalido) {
                  setDocErro(invalido);
                  return;
                }
                setDocErro(null);
                setDocBusy(true);
                try {
                  // Envia ao servidor, que valida o TIPO REAL (magic bytes) e o
                  // tamanho antes de gravar no bucket PRIVADO property-docs (RLS
                  // por dono, 0032). Guardamos só o PATH — a exibição usa URL
                  // assinada. Fecha o furo do "PDF de 2 KB aceito" (item 6).
                  const fd = new FormData();
                  fd.append("file", f);
                  const res = await fetch("/api/upload/documento", { method: "POST", body: fd });
                  const data = (await res.json().catch(() => ({}))) as { path?: string | null; hash?: string | null; error?: string };
                  if (!res.ok) {
                    setDocErro(data.error ?? "Não foi possível enviar o documento agora.");
                    return;
                  }
                  setDocName(`${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB`);
                  setDocPath(data.path ?? null);
                  setDocHash(data.hash ?? null);
                  setElig((s) => ({ ...s, hasDocument: true }));
                } catch {
                  setDocErro("Não foi possível enviar o documento agora. Tente novamente.");
                } finally {
                  setDocBusy(false);
                }
              }}
            />
          </label>
          {docErro && <p className="text-sm text-red-600">{docErro}</p>}

          {/* Nota de tratamento de dados (LGPD) — o documento pode conter CPF e
              matrícula. TODO(juridico): Beatriz revisar a redação final. */}
          <p className="flex items-start gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
            <span>
              Guardamos este documento em <strong className="text-ink">armazenamento privado</strong>,
              com <strong className="text-ink">acesso restrito</strong> a você e à nossa equipe de
              verificação, usado <strong className="text-ink">apenas</strong> para confirmar a
              titularidade/gestão do imóvel. O link é temporário e assinado — nunca público. Você pode
              solicitar a remoção a qualquer momento.
            </span>
          </p>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-ink">
            A convenção do condomínio permite locação mobiliada de média duração (30–180 dias)?
          </legend>
          <details className="group mt-1">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-forest">
              <Info className="h-3.5 w-3.5" /> Como descobrir?
            </summary>
            <p className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
              Pergunte ao síndico ou consulte a convenção — em geral está no capítulo de uso das
              unidades. Imóvel fora de condomínio: marque “Sim”.
            </p>
          </details>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                { v: "yes", label: "Sim, permite" },
                { v: "unknown", label: "Não sei" },
                { v: "no", label: "Não, proíbe" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => {
                  setHasInteracted(true);
                  setElig((s) => ({ ...s, condoAllows: opt.v }));
                }}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  elig.condoAllows === opt.v
                    ? "border-forest bg-forest text-white"
                    : "border-sage-200 bg-white text-ink hover:border-sage"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {condoBlocked && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Se a convenção proíbe a locação por temporada, o imóvel não pode ser anunciado.
            </p>
          )}
        </fieldset>

        {/* Barra de progresso dos requisitos (item 1 do QA) */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink">Progresso</span>
            <span className="tabular-nums text-muted">
              {reqDone}/{reqTotal} requisitos
              {pendenciaConvencao && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  +1 pendência
                </span>
              )}
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sage-100">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                eligible ? "bg-forest" : "bg-champagne"
              )}
              style={{ width: `${(reqDone / reqTotal) * 100}%` }}
            />
          </div>
        </div>

        {(() => {
          const v = veredito();
          const TONE = {
            green: { box: "bg-sage-100", title: "text-forest", icon: CheckCircle2, iconColor: "text-forest" },
            amber: { box: "bg-amber-50", title: "text-amber-800", icon: AlertTriangle, iconColor: "text-amber-600" },
            red: { box: "bg-red-50", title: "text-red-700", icon: XCircle, iconColor: "text-red-600" },
            info: { box: "bg-surface-2", title: "text-ink", icon: Info, iconColor: "text-blue-500" },
          }[v.tone];
          const VIcon = TONE.icon;
          return (
            <div className={cn("mt-4 flex items-center gap-3 rounded-xl px-4 py-4", TONE.box)}>
              <VIcon className={cn("h-6 w-6 shrink-0", TONE.iconColor)} />
              <div>
                <p className={cn("font-title font-bold", TONE.title)}>{v.titulo}</p>
                <p className="text-sm text-muted">{v.msg}</p>
                {/* Selo da conferência do documento (não da propriedade). */}
                {docStatus === "approved" && (
                  <div className="mt-2">
                    <DocConferidaBadge size="sm" />
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </section>

      {/* SEÇÃO 2 — SELO PRONTO PARA MORAR */}
      <section className="mt-6 rounded-2xl border border-sage-200 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-sm font-bold text-white">
            2
          </span>
          <h2 className="font-title text-xl font-bold text-ink">
            Selo Pronto para Morar{" "}
            <span className="text-base font-medium text-muted">(opcional, recomendado)</span>
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          Quanto mais itens, mais completo seu anúncio aparece para os inquilinos.
        </p>

        {/* Placar do selo — ESTÁTICO no fluxo (ancorado na seção). Nada de sticky:
            o placar não acompanha o scroll nem "flutua" sobre os itens. */}
        <div className="mt-6 rounded-xl border border-sage-200 bg-white p-4 shadow-sm">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-2">
              <Award className={cn("h-5 w-5", baseBadge ? "text-champagne-600" : "text-sage")} />
              <span className="font-title text-2xl font-bold text-forest">{score}</span>
              <span className="text-sm text-muted">/ 100</span>
            </div>
            {baseBadge && <ReadyToLiveBadge />}
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-sage-100">
            <div
              className="h-full rounded-full bg-champagne transition-all duration-300"
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-muted">
            {baseBadge
              ? "Parabéns! Seu imóvel ganhou o selo Pronto para Morar e será bem ranqueado. 🏅"
              : `Some ${READY_TO_LIVE_THRESHOLD - score} ponto(s) para conquistar o selo Pronto para Morar.`}
          </p>
        </div>

        {/* Faixa de imagem motivacional (ADENDO): resultado que o selo promete.
            Abaixo da dobra → lazy. Chip reforça o benefício, não é decoração. */}
        <div className="relative mt-6 h-36 overflow-hidden rounded-xl sm:h-40">
          <Image
            src="/media/hero-proprietarios.webp"
            alt="Sala mobiliada pronta para receber inquilinos"
            fill
            loading="lazy"
            sizes="(max-width: 640px) 100vw, 768px"
            className="object-cover object-center"
          />
          <span className="absolute bottom-3 left-3 rounded-full bg-night/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            Imóveis com o selo ganham destaque na busca
          </span>
        </div>

        {/* Itens do selo base */}
        <div className="mt-6 space-y-2">
          {readyToLiveItems(quality).map((item) =>
            item.key === "internet" ? (
              <InternetTierRow
                key={item.key}
                value={quality.internetTier}
                pts={item.pts}
                on={item.on}
                onChange={(internetTier) => setQuality((s) => ({ ...s, internetTier }))}
              />
            ) : (
              <ScoreRow
                key={item.key}
                label={item.label}
                pts={item.pts}
                on={item.on}
                onToggle={() => toggleQuality(item.key as keyof QualityState)}
              />
            )
          )}
        </div>

        {/* Etiquetas */}
        <h3 className="mt-8 font-title font-bold text-ink">Etiquetas de especialização</h3>
        <p className="text-sm text-muted">Somam ao selo base e viram filtros na busca.</p>

        <TagBlock
          icon={Laptop}
          title="Para trabalhar de casa"
          earned={tHome}
          items={homeOfficeItems(quality)}
          onToggle={(key) => toggleQuality(key)}
          banner="/media/como-funciona-01-converse.webp"
          bannerAlt="Pessoa trabalhando de casa no notebook"
        />
        <TagBlock
          icon={MapPin}
          title="Bem localizado para trabalho"
          earned={tWork}
          items={workLocatedItems(quality)}
          onToggle={(key) => toggleQuality(key)}
          banner="/media/como-funciona-03-qualifique.webp"
          bannerAlt="Pessoa avaliando opções pela vizinhança no tablet"
        />
      </section>

      {/* Confirmação de salvamento (item 4B) */}
      {saved && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-sage bg-sage-100 px-4 py-3 text-sm font-medium text-forest">
          <CheckCircle2 className="h-5 w-5" />
          Qualificação salva ✓ — selo e etiquetas registrados e prontos para o anúncio.
        </div>
      )}

      {/* AÇÃO */}
      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {eligible ? "Salve para liberar a publicação do anúncio." : "Conclua os requisitos obrigatórios para liberar a publicação."}
        </p>
        {saved ? (
          <Button variant="accent" onClick={() => router.push("/dashboard/imoveis/novo")}>
            Continuar para o anúncio <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={!eligible || saving} onClick={save}>
            {saving ? "Salvando..." : "Salvar qualificação"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Ícone temático por item de etiqueta (upgrade visual dos cards). */
const TAG_ICON: Record<TagItem["icon"], React.ComponentType<{ className?: string }>> = {
  office: DoorOpen,
  desk: Laptop,
  chair: Armchair,
  wifi: Wifi,
  coworking: Building2,
  meeting: Users,
  cafe: Coffee,
};

function CheckRow({
  checked,
  label,
  onToggle,
  disabled,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2",
        checked ? "border-sage bg-sage-100" : "border-sage-200 bg-white hover:border-sage",
        disabled && "cursor-default opacity-90"
      )}
    >
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
          checked ? "border-forest bg-forest text-white" : "border-sage-200 bg-white"
        )}
      >
        {checked && <CheckCircle2 className="h-4 w-4" />}
      </span>
      <span className="text-sm text-ink">{label}</span>
    </button>
  );
}

function ScoreRow({
  label,
  pts,
  on,
  onToggle,
}: {
  label: string;
  pts: number;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne-600 focus-visible:ring-offset-2",
        on ? "border-champagne bg-champagne/10" : "border-sage-200 bg-white hover:border-sage"
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
            on ? "border-champagne bg-champagne text-night" : "border-sage-200 bg-white"
          )}
        >
          {on && <CheckCircle2 className="h-4 w-4" />}
        </span>
        <span className="text-sm text-ink">{label}</span>
      </span>
      <span className={cn("shrink-0 text-sm font-semibold", on ? "text-champagne-600" : "text-muted")}>
        +{pts}
      </span>
    </button>
  );
}

/** Internet por categoria de uso (sem Mbps). >= trabalho remoto soma os pontos. */
function InternetTierRow({
  value,
  pts,
  on,
  onChange,
}: {
  value: InternetTier;
  pts: number;
  on: boolean;
  onChange: (tier: InternetTier) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 transition-colors",
        on ? "border-champagne bg-champagne/10" : "border-sage-200 bg-white"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
              on ? "border-champagne bg-champagne text-night" : "border-sage-200 bg-white"
            )}
          >
            {on && <CheckCircle2 className="h-4 w-4" />}
          </span>
          <span className="text-sm text-ink">Internet que aguenta trabalho</span>
        </span>
        <span className={cn("shrink-0 text-sm font-semibold", on ? "text-champagne-600" : "text-muted")}>
          +{pts}
        </span>
      </div>
      <div className="ml-8 mt-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as InternetTier)}
          aria-label="Categoria da internet"
          className="w-full rounded-lg border border-sage-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sage"
        >
          {INTERNET_TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted">{INTERNET_META[value].description}</p>
      </div>
    </div>
  );
}

function TagBlock({
  icon: Icon,
  title,
  earned,
  items,
  onToggle,
  banner,
  bannerAlt,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  earned: boolean;
  items: TagItem[];
  onToggle: (key: keyof QualityState) => void;
  /** Faixa fina de imagem no topo do card (ADENDO) — ambienta, sem chip. */
  banner?: string;
  bannerAlt?: string;
}) {
  const toggleaveis = items.filter((i) => !i.readonly);
  const marcados = toggleaveis.filter((i) => i.on).length;
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-sage-200">
      {/* Faixa mais baixa que a do selo (~90px) e sem texto — hierarquia. */}
      {banner && (
        <div className="relative h-[90px] w-full">
          <Image src={banner} alt={bannerAlt ?? ""} fill loading="lazy" sizes="(max-width: 640px) 100vw, 768px" className="object-cover object-center" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium text-ink">
            <Icon className="h-5 w-5 text-sage" /> {title}
            <span className="text-xs font-normal text-muted">
              {marcados}/{toggleaveis.length} marcados
            </span>
          </span>
          {earned ? (
            <span className="tag-earned-pop shrink-0 rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-forest">
              Etiqueta conquistada ✓
            </span>
          ) : (
            <span className="shrink-0 text-right text-xs text-muted">
              Marque todos os itens para ganhar esta etiqueta
            </span>
          )}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {items.map((it) => {
            const ItemIcon = TAG_ICON[it.icon];
            return (
              <button
                key={it.key}
                type="button"
                role="checkbox"
                aria-checked={it.on}
                aria-label={it.label}
                onClick={() => !it.readonly && onToggle(it.key as keyof QualityState)}
                disabled={it.readonly}
                title={it.readonly ? "Definida pela categoria de internet no selo base" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2",
                  it.on ? "border-blue-200 bg-blue-50 text-forest" : "border-sage-200 text-ink hover:border-sage",
                  it.readonly && "cursor-default opacity-90 hover:border-sage-200"
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded border",
                    it.on ? "border-forest bg-forest text-white" : "border-sage-200 text-sage"
                  )}
                >
                  {it.on ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ItemIcon className="h-3 w-3" />}
                </span>
                {it.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          Vira filtro na busca — inquilinos que procuram isso encontram seu imóvel primeiro.
        </p>
      </div>
    </div>
  );
}
