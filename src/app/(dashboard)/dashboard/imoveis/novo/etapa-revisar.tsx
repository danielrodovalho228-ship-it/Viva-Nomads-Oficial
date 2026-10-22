"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { ChecklistPublicar } from "./checklist-publicar";
import type { ItemProntidao } from "@/lib/anuncio/prontidao";
import type { Property, Proximity } from "@/lib/types";
import { PropertyMiniCard } from "@/components/property-mini-card";
import { Button } from "@/components/ui/button";
import { AMENITY_LABEL } from "@/lib/amenities";
import { TERMO_IA_TEXTO } from "@/lib/anuncio/termo-ia";
import { fraseDescontoCard, ROTULO_VALOR_FIXO, type Negociacao } from "@/lib/anuncio/negociacao";
import type { EstadoDocumentoTela } from "@/components/anuncio/documento-vinculo";
import { cn } from "@/lib/utils";

/**
 * Etapa 5 — Revisar e publicar (prompt 10): prévia como o morador vê (cartão da busca + o que o anúncio vai
 * mostrar), nota de qualidade, o que falta para melhorar e o estado do documento (conferida / corrija / em revisão).
 */
export function EtapaRevisar(p: {
  previewProperty: Property;
  titulo: string;
  descricao: string;
  fotos: string[];
  endereco: string;
  comodidades: string[];
  proximidades: Proximity[];
  negociacao: Negociacao;
  completude: ItemProntidao[];
  /** Prompt 22: "Resolver" de cada item (a qualificação abre no painel lateral). */
  onResolver: (item: ItemProntidao) => void;
  melhorar: string[];
  quality: number;
  photosCount: number;
  qualBaseBadge: boolean;
  docEstado: EstadoDocumentoTela;
  docMotivos: string[];
  editingId: string | null;
  publishing: boolean;
  publish: (asDraft?: boolean, irParaQualificacao?: boolean) => void;
  irPara: (i: number) => void;
  aceitouIa: boolean;
  setAceitouIa: (v: boolean) => void;
  publishError: string | null;
  podePublicar: boolean;
}) {
  const dicas = [
    p.photosCount < 12 && { t: `Chegar a 12 fotos (tem ${p.photosCount}): anúncio completo`, v: "+15%" },
    p.photosCount >= 12 && p.photosCount < 20 && { t: `Chegar a 20 fotos (tem ${p.photosCount}): anúncio premium`, v: "+prioridade" },
    p.descricao.trim().length <= 30 && { t: "Descrição com 150+ palavras", v: "+20%" },
    !p.qualBaseBadge && { t: "Conquistar o selo Pronto para Morar na qualificação", v: "+20%" },
  ].filter(Boolean) as { t: string; v: string }[];
  const desconto = fraseDescontoCard(p.negociacao.descontos);
  // Prompt 43: com os mínimos completos e ainda algo a melhorar, o botão diz que publica com o que tem.
  const comOQueTem = !p.editingId && p.podePublicar && dicas.length > 0;

  return (
    <div className="space-y-4" data-testid="etapa-revisar">
      <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div>
          <p className="text-sm font-medium text-ink">Na busca</p>
          <div className="mt-2">
            <PropertyMiniCard property={p.previewProperty} />
          </div>
        </div>
        <div className="min-w-0 rounded-xl border border-sage-200 p-4" data-testid="previa-anuncio">
          <p className="text-sm font-medium text-ink">No anúncio</p>
          <p className="mt-1 font-title text-lg font-semibold text-ink">{p.titulo || "Sem título ainda"}</p>
          <p className="text-xs text-muted">{p.endereco} · região aproximada no mapa</p>
          {p.descricao && <p className="mt-2 line-clamp-4 text-sm text-ink">{p.descricao}</p>}
          {p.comodidades.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              <strong className="text-ink">Comodidades:</strong> {p.comodidades.map((k) => AMENITY_LABEL[k] ?? k).join(" · ")}
            </p>
          )}
          {p.proximidades.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              <strong className="text-ink">Por perto:</strong> {p.proximidades.map((x) => (x.note ? `${x.name} (${x.note})` : x.name)).join(" · ")}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">
            <strong className="text-ink">Negociação:</strong> {p.negociacao.aceita ? "aceita negociar" : ROTULO_VALOR_FIXO}
            {desconto ? ` · ${desconto}` : ""}
          </p>
        </div>
      </div>

      {/* Estado do documento (prompt 11). */}
      {!p.editingId && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
            p.docEstado === "aprovado" && "border-green-200 bg-green-50 text-green-900",
            p.docEstado === "corrija" && "border-red-200 bg-red-50 text-red-800",
            p.docEstado === "revisao" && "border-amber-200 bg-amber-50 text-amber-900",
            p.docEstado === "nenhum" && "border-sage-200 bg-surface-2 text-ink",
          )}
          data-testid="revisar-documento"
          data-estado={p.docEstado}
        >
          {p.docEstado === "aprovado" ? <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" /> : p.docEstado === "revisao" ? <Clock className="mt-1 h-4 w-4 shrink-0" /> : <XCircle className="mt-1 h-4 w-4 shrink-0" />}
          <span>
            {p.docEstado === "aprovado" && <strong>Documentação conferida ✓</strong>}
            {p.docEstado === "revisao" && (
              <>
                <strong>Em revisão.</strong> A equipe confere em até 48 horas. Você pode salvar como rascunho; a publicação
                libera depois da conferência.
              </>
            )}
            {p.docEstado === "corrija" && (
              <>
                <strong>Corrija o documento.</strong> {p.docMotivos.join(" ")}{" "}
                <button type="button" className="font-medium underline" onClick={() => p.irPara(0)}>
                  Reenviar na etapa Onde fica
                </button>
              </>
            )}
            {p.docEstado === "nenhum" && (
              <>
                <strong>Documento do imóvel ainda não enviado.</strong>{" "}
                <button type="button" className="font-medium underline" onClick={() => p.irPara(0)}>
                  Enviar na etapa Onde fica
                </button>
              </>
            )}
          </span>
        </div>
      )}

      {/* Prompt 22: UMA lista do que falta (inclui a qualificação), cada item com "Resolver". */}
      <ChecklistPublicar itens={p.completude} onResolver={p.onResolver} />
      {p.melhorar.length > 0 && (
        <p className="-mt-2 px-1 text-xs text-muted" data-testid="prontidao-opcionais">
          Para melhorar (opcional, não impede publicar): {p.melhorar.join(" · ")}
        </p>
      )}

      <div className="rounded-xl border border-sage-200 p-4" data-testid="qualidade-anuncio">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink">Qualidade do anúncio</span>
          <span className="font-title font-semibold text-forest">{p.quality}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${p.quality}%` }} />
        </div>
        {dicas.length === 0 ? (
          <p className="mt-2 text-xs text-forest">Ótimo: seu anúncio está no topo da qualidade.</p>
        ) : (
          <ul className="mt-2 space-y-1" data-testid="o-que-falta-melhorar">
            {dicas.map((d) => (
              <li key={d.t} className="flex items-center justify-between gap-2 text-xs text-muted">
                <span>{d.t}</span>
                <span className="shrink-0 font-semibold text-forest">{d.v}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-sage-200 bg-surface-2 px-4 py-3 text-sm text-ink" data-testid="aceite-ia">
        <input type="checkbox" checked={p.aceitouIa} onChange={(e) => p.setAceitouIa(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-forest" />
        <span>{TERMO_IA_TEXTO}</span>
      </label>
      {p.publishError && <p className="text-sm text-red-600">{p.publishError}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => p.publish(true)} disabled={p.publishing}>
          {p.editingId ? "Salvar sem publicar" : "Salvar como rascunho"}
        </Button>
        <Button
          variant={p.podePublicar ? "gold" : "outline"}
          onClick={() => p.publish(false)}
          disabled={p.publishing || !p.podePublicar}
          title={p.podePublicar ? undefined : "Resolva os itens pendentes acima"}
          className={p.podePublicar ? undefined : "cursor-not-allowed opacity-60"}
          data-testid="publicar-anuncio"
        >
          {p.publishing ? "Salvando..." : p.editingId ? "Salvar alterações" : comOQueTem ? "Publicar com o que tem" : "Publicar anúncio"}
        </Button>
      </div>
      {comOQueTem && (
        <p className="text-right text-xs text-muted" data-testid="publicar-com-o-que-tem">
          Os mínimos estão completos. O que está em “Qualidade do anúncio” melhora a posição na busca e pode ser feito depois.
        </p>
      )}
    </div>
  );
}
