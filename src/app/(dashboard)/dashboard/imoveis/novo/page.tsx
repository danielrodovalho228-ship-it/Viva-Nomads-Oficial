"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ClipboardCheck, Check, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
import { createProperty } from "@/lib/data/actions";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { PhotoUploader, type PhotoItem } from "@/components/photo-uploader";
import { cn } from "@/lib/utils";

const STEPS = ["Fotos", "Sobre o imóvel", "Endereço", "Preço & período", "Trabalho", "Revisão"];

export default function NewPropertyPage() {
  const [approved, setApproved] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [utilitiesMode, setUtilitiesMode] = useState<"fixed" | "real">("fixed");
  const [utilitiesEstimate, setUtilitiesEstimate] = useState(200);
  const [issuesInvoice, setIssuesInvoice] = useState(false);
  const [acceptsInsurance, setAcceptsInsurance] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const router = useRouter();

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    // Pontuação de trabalho vinda da qualificação aprovada.
    let workScore = 0;
    try {
      const raw = sessionStorage.getItem("vivanomads-qualification");
      if (raw) workScore = JSON.parse(raw).score ?? 0;
    } catch {}

    const res = await createProperty({
      title: title || "Imóvel mobiliado",
      description: "",
      propertyType: "Apartamento",
      city: "Uberlândia",
      neighborhood: "",
      bedrooms: 0,
      bathrooms: 0,
      areaM2: 0,
      minPeriodDays: 30,
      monthlyPrice: 0,
      workScore,
      utilitiesMode,
      utilitiesEstimate,
      issuesInvoice,
      acceptsInsurance,
      photoUrls: photos.map((p) => p.url),
    });

    setPublishing(false);
    if (!res.ok) {
      setPublishError(res.error ?? "Não foi possível publicar.");
      return;
    }
    router.push("/dashboard/imoveis");
  }

  useEffect(() => {
    // A publicação só é liberada com um checklist aprovado (Fase 4).
    // Leitura única de valor client-only no mount — exceção válida à regra.
    const raw = sessionStorage.getItem("vivanomads-qualification");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApproved(raw ? JSON.parse(raw).eligible === true : false);
  }, []);

  if (approved === null) return null;

  if (!approved) {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="Novo anúncio" />
        <Panel className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-100">
            <Lock className="h-7 w-7 text-forest" />
          </div>
          <h2 className="mt-4 font-title text-xl font-bold text-ink">
            Conclua a qualificação primeiro
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            O cadastro de imóvel só é liberado depois que o checklist de qualificação retorna{" "}
            <strong>APROVADO PARA PUBLICAR</strong>. É o que garante que o anúncio é locação
            por temporada regular.
          </p>
          <ButtonLink href="/qualificar" variant="gold" className="mt-6">
            <ClipboardCheck className="h-4 w-4" /> Ir para a qualificação
          </ButtonLink>
        </Panel>
      </div>
    );
  }

  function generateAI() {
    setAiLoading(true);
    // Serviço pago (modelo híbrido) — aqui simula a geração de título/descrição.
    setTimeout(() => {
      setTitle("Apartamento mobiliado com home office, pronto para sua estadia");
      setAiLoading(false);
    }, 900);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Novo anúncio" subtitle="Qualificação aprovada ✓" />

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm whitespace-nowrap",
                i === step
                  ? "bg-forest text-white"
                  : i < step
                    ? "bg-sage-100 text-forest"
                    : "bg-surface-2 text-muted"
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>}
              {s}
            </div>
          </div>
        ))}
      </div>

      <Panel>
        {step === 0 && (
          <div>
            <h2 className="font-title text-lg font-bold text-ink">Fotos do imóvel</h2>
            <p className="mt-1 text-sm text-muted">
              As fotos são enviadas para o Supabase Storage. Insira as imagens reais do imóvel.
            </p>
            <div className="mt-4">
              <PhotoUploader photos={photos} onChange={setPhotos} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-title text-lg font-bold text-ink">Sobre o imóvel</h2>
            <div className="flex items-center justify-between rounded-xl bg-champagne/10 px-4 py-3">
              <span className="text-sm text-forest">Gerar título e descrição com IA</span>
              <Button size="sm" variant="gold" onClick={generateAI} disabled={aiLoading}>
                <Sparkles className="h-4 w-4" /> {aiLoading ? "Gerando..." : "Gerar"}
              </Button>
            </div>
            <Labeled label="Título do anúncio">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Studio mobiliado no Centro"
                className="input"
              />
            </Labeled>
            <Labeled label="Tipo de imóvel">
              <select className="input">
                <option>Apartamento</option>
                <option>Casa</option>
                <option>Studio</option>
                <option>Kitnet</option>
              </select>
            </Labeled>
            <Labeled label="Descrição">
              <textarea rows={4} className="input" placeholder="Descreva o imóvel..." />
            </Labeled>
            <div className="grid grid-cols-3 gap-3">
              <Labeled label="Quartos">
                <input type="number" min={0} className="input" />
              </Labeled>
              <Labeled label="Banheiros">
                <input type="number" min={0} className="input" />
              </Labeled>
              <Labeled label="Área (m²)">
                <input type="number" min={0} className="input" />
              </Labeled>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-title text-lg font-bold text-ink">Endereço</h2>
            <Labeled label="Endereço completo">
              <input className="input" placeholder="Rua, número" />
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Bairro">
                <input className="input" />
              </Labeled>
              <Labeled label="Cidade">
                <input className="input" defaultValue="Uberlândia" />
              </Labeled>
            </div>
            <PhotoPlaceholder
              label="[MAPA — selecione a localização do imóvel]"
              className="aspect-[16/9] w-full rounded-xl"
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-title text-lg font-bold text-ink">Preço e período</h2>
            <Labeled label="Aluguel mensal (R$)">
              <input type="number" min={0} className="input" placeholder="3200" />
            </Labeled>
            <Labeled label="Período mínimo de locação">
              <select className="input">
                <option value="30">30 dias</option>
                <option value="60">60 dias</option>
                <option value="90">90 dias</option>
                <option value="180">180 dias</option>
              </select>
            </Labeled>

            {/* Despesas de consumo (Atualização 6) */}
            <div className="rounded-xl border border-sage-200 p-4">
              <p className="text-sm font-medium text-ink">Despesas de consumo (água, luz, gás)</p>
              <div className="mt-2 flex gap-2">
                {(["fixed", "real"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setUtilitiesMode(m)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      utilitiesMode === m
                        ? "border-forest bg-forest text-white"
                        : "border-sage-200 text-ink hover:border-sage"
                    )}
                  >
                    {m === "fixed" ? "Valor fixo estimado" : "Consumo real"}
                  </button>
                ))}
              </div>
              {utilitiesMode === "fixed" && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Labeled label="Estimativa (R$/mês)">
                    <input
                      type="number"
                      min={0}
                      value={utilitiesEstimate || ""}
                      onChange={(e) => setUtilitiesEstimate(Number(e.target.value))}
                      className="input"
                      placeholder="200"
                    />
                  </Labeled>
                  <Labeled label="Margem de ajuste (%)">
                    <input type="number" min={0} defaultValue={20} className="input" />
                  </Labeled>
                </div>
              )}
              <p className="mt-2 text-xs text-muted">
                No valor fixo, se o consumo exceder a margem você pode emitir cobrança
                complementar com comprovante.
              </p>
            </div>

            {/* Nota Fiscal e seguro (Atualizações 7 e 10) */}
            <div className="space-y-2">
              <Toggle
                checked={issuesInvoice}
                onChange={() => setIssuesInvoice((v) => !v)}
                label="Este imóvel emite Nota Fiscal do aluguel"
                hint="Decisivo para o público corporativo (reembolso pela empresa)."
              />
              <Toggle
                checked={acceptsInsurance}
                onChange={() => setAcceptsInsurance((v) => !v)}
                label="Aceito seguro-fiança como garantia"
                hint="Exibe o selo 'Aceita Seguro-Fiança' no anúncio."
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <h2 className="font-title text-lg font-bold text-ink">Recursos de trabalho</h2>
            <p className="text-sm text-muted">
              Estes itens vêm do seu checklist de qualificação e definem o selo Pronto para
              Trabalho. Adicione também espaços de trabalho próximos.
            </p>
            <div className="rounded-xl border border-sage-200 p-4 text-sm text-ink">
              ✓ Importados da qualificação: home office, mesa, internet fibra.
            </div>
            <Labeled label="Espaços de trabalho próximos (nome — distância)">
              <input className="input" placeholder="Coworking Center — 850 m" />
            </Labeled>
          </div>
        )}

        {step === 5 && (
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-100">
              <Check className="h-7 w-7 text-forest" />
            </div>
            <h2 className="mt-4 font-title text-xl font-bold text-ink">Tudo pronto!</h2>
            <p className="mx-auto mt-2 max-w-md text-muted">
              {photos.length > 0
                ? `${photos.length} foto(s) anexada(s). `
                : "Nenhuma foto anexada — recomendamos adicionar pelo menos uma. "}
              O imóvel entra como <strong>Rascunho</strong> e você pode ativá-lo quando quiser.
            </p>
            {publishError && <p className="mt-3 text-sm text-red-600">{publishError}</p>}
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => publish()} disabled={publishing}>
                Salvar como rascunho
              </Button>
              <Button variant="gold" onClick={() => publish()} disabled={publishing}>
                {publishing ? "Publicando..." : "Publicar anúncio"}
              </Button>
            </div>
          </div>
        )}

        {/* Navegação */}
        {step < 5 && (
          <div className="mt-6 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Panel>

      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/dashboard/imoveis" className="hover:text-forest">
          Cancelar e voltar
        </Link>
      </p>

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-sage-200);background:#fff;padding:0.625rem 0.875rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-sage)}`}</style>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        checked ? "border-forest bg-sage-100" : "border-sage-200 hover:border-sage"
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border",
          checked ? "border-forest bg-forest text-white" : "border-sage-200 bg-white"
        )}
      >
        {checked && <Check className="h-4 w-4" />}
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}
