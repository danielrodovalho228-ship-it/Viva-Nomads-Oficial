"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import {
  EXEMPLOS_MANUTENCAO,
  PRAZO_MANUTENCAO_H,
  ROTULO_URGENCIA_MANUTENCAO,
  dataHoraBrasilia,
  responderAte,
} from "@/config/atendimento";
import { SO_PRIORITY_META, SO_STATUS_META, categoryLabel, type ServiceOrder, type SOPriority, type SOStatus } from "@/lib/service-orders";
import { prazoDaOrdem, proximosStatus, textoEvento, type EventoOrdem, type PapelOrdem } from "@/lib/manutencao-solicitacoes";
import {
  detalheSolicitacao,
  mudarStatusSolicitacao,
  responderSolicitacao,
  type MensagemOrdem,
} from "@/lib/data/manutencao-actions";
import { cn } from "@/lib/utils";

/** Prazo do proprietário (critério 2): "Responder até <data/hora de Brasília>" + situação. */
export function PrazoOrdem({ o }: { o: ServiceOrder }) {
  const p = prazoDaOrdem(o, new Date());
  return (
    <p data-testid="prazo-ordem" className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {p.texto} · prazo de {PRAZO_MANUTENCAO_H[o.priority]} h
      </span>
      {p.estado === "respondida" && <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">Respondida</span>}
      {p.estado === "vencido" && <span className="rounded-full bg-red-50 px-2 py-1 font-medium text-red-700">Prazo vencido</span>}
    </p>
  );
}

/** Seletor de prioridade com os exemplos da Central de Ajuda e o prazo de cada uma (critério 2 / F30). */
export function SeletorPrioridade({ valor, onChange }: { valor: SOPriority; onChange: (p: SOPriority) => void }) {
  const ordem: SOPriority[] = ["urgente", "media", "baixa"];
  return (
    <fieldset data-testid="seletor-prioridade">
      <legend className="mb-2 block text-sm font-medium text-ink">Prioridade</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {ordem.map((p) => (
          <label
            key={p}
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 text-sm",
              valor === p ? "border-forest bg-forest/5" : "border-sage-200"
            )}
          >
            <input type="radio" name="prioridade" value={p} checked={valor === p} onChange={() => onChange(p)} className="mt-1" />
            <span className="min-w-0">
              <span className="block font-medium text-ink">
                {ROTULO_URGENCIA_MANUTENCAO[p]} · até {PRAZO_MANUTENCAO_H[p]} h
              </span>
              <span className="block text-xs text-muted">Ex.: {EXEMPLOS_MANUTENCAO[p]}</span>
            </span>
          </label>
        ))}
      </div>
      <p data-testid="prazo-previsto" className="mt-2 text-xs text-muted">
        Se enviar agora, o proprietário tem até {PRAZO_MANUTENCAO_H[valor]} h: {responderAte(valor, new Date())}.
      </p>
    </fieldset>
  );
}

const ROTULO_ACAO: Partial<Record<SOStatus, string>> = { em_andamento: "Iniciar atendimento", resolvido: "Marcar como resolvida" };
const AUTOR: Record<MensagemOrdem["autor"], string> = { voce: "Você", inquilino: "Inquilino", proprietario: "Proprietário" };

/** Histórico de exemplo (modo demonstração): sai dos carimbos da própria ordem. */
function eventosDemo(o: ServiceOrder): EventoOrdem[] {
  const ev: EventoOrdem[] = [{ tipo: "aberto", papel: "inquilino", statusPara: "aberto", criadoEm: o.openedAt }];
  if (o.firstResponseAt && o.status !== "aberto") ev.push({ tipo: "status", papel: "proprietario", statusPara: "em_andamento", criadoEm: o.firstResponseAt });
  if (o.resolvedAt) ev.push({ tipo: "status", papel: "proprietario", statusPara: "resolvido", criadoEm: o.resolvedAt });
  return ev;
}

/**
 * Cartão da ordem, igual para os dois lados: prioridade, prazo com data/hora de
 * Brasília e status; aberto, mostra o histórico (cada mudança com data/hora), as
 * mensagens das duas partes e a réplica. As ações seguem o lado de quem vê.
 */
export function CartaoOrdem({
  o,
  papel,
  demo,
  onAtualizada,
}: {
  o: ServiceOrder;
  papel: PapelOrdem;
  demo: boolean;
  onAtualizada: (o: ServiceOrder) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [eventos, setEventos] = useState<EventoOrdem[] | null>(null);
  const [mensagens, setMensagens] = useState<MensagemOrdem[]>([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!aberto || demo) return;
    let vivo = true;
    detalheSolicitacao(o.id)
      .then((r) => {
        if (!vivo) return;
        if (!r.ok) return setErro(r.error);
        setEventos(r.detalhe.eventos);
        setMensagens(r.detalhe.mensagens);
      })
      .catch(() => vivo && setErro("Sem conexão. Tente de novo."));
    return () => {
      vivo = false;
    };
  }, [aberto, demo, o, recarga]);

  const acoes = proximosStatus(o.status, papel);
  // Demonstração: o histórico sai dos carimbos da própria ordem (nada no banco).
  const historico = demo ? eventosDemo(o) : eventos;

  async function mudar(novo: SOStatus) {
    setErro(null);
    if (demo) {
      const agora = new Date().toISOString();
      onAtualizada({
        ...o,
        status: novo,
        firstResponseAt: papel === "proprietario" ? (o.firstResponseAt ?? agora) : o.firstResponseAt,
        resolvedAt: novo === "resolvido" ? agora : o.resolvedAt,
      });
      return;
    }
    setOcupado(true);
    const r = await mudarStatusSolicitacao(o.id, novo).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
    setOcupado(false);
    if (!r.ok) return setErro(r.error);
    onAtualizada({ ...r.ordem, tenantName: o.tenantName, property: o.property });
    setRecarga((n) => n + 1);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return setErro("Escreva a mensagem.");
    setErro(null);
    if (demo) {
      setMensagens((m) => [...m, { id: `demo-${Date.now()}`, autor: "voce", texto: texto.trim(), criadoEm: new Date().toISOString() }]);
      setTexto("");
      return;
    }
    setOcupado(true);
    const r = await responderSolicitacao(o.id, texto).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
    setOcupado(false);
    if (!r.ok) return setErro(r.error);
    setMensagens((m) => [...m, r.mensagem]);
    setTexto("");
    if (papel === "proprietario" && !o.firstResponseAt) onAtualizada({ ...o, firstResponseAt: r.mensagem.criadoEm });
  }

  return (
    <Panel data-testid="ordem-manutencao" data-status={o.status}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        data-testid="solicitacao-cartao"
        className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", SO_PRIORITY_META[o.priority].tone)}>
              {SO_PRIORITY_META[o.priority].label}
            </span>
            <span className="text-sm font-medium text-ink">{categoryLabel(o.category)}</span>
            <span className="min-w-0 truncate text-sm text-muted">· {o.property}</span>
          </div>
          <p className="mt-2 break-words text-sm text-ink">{o.description}</p>
          <p className="mt-1 text-xs text-muted">
            {papel === "proprietario" && o.tenantName ? `${o.tenantName} · ` : ""}aberta em {dataHoraBrasilia(new Date(o.openedAt))}
          </p>
          <PrazoOrdem o={o} />
        </div>
        <span data-testid="status-ordem" className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-medium", SO_STATUS_META[o.status].tone)}>
          {SO_STATUS_META[o.status].label}
        </span>
      </button>

      {aberto && (
        <div className="mt-3 grid gap-4 border-t border-sage-100 pt-3 lg:grid-cols-2" data-testid="solicitacao-detalhe">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Histórico</h3>
            {historico === null ? (
              <p className="text-sm text-muted">{erro ?? "Carregando…"}</p>
            ) : (
              <ol data-testid="historico-ordem" className="space-y-2 text-sm text-muted">
                {historico.map((ev, i) => (
                  <li key={i}>{textoEvento(ev)}</li>
                ))}
              </ol>
            )}
            {acoes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {acoes.map((a) => (
                  <Button key={a} size="sm" variant="secondary" disabled={ocupado} onClick={() => void mudar(a)}>
                    {ROTULO_ACAO[a]}
                  </Button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Mensagens</h3>
            <ul data-testid="mensagens-ordem" className="space-y-2">
              {mensagens.length === 0 && <li className="text-sm text-muted">Nenhuma mensagem ainda.</li>}
              {mensagens.map((m) => (
                <li key={m.id} className={cn("rounded-xl px-3 py-2 text-sm", m.autor === "voce" ? "bg-forest/5" : "bg-sage-50")}>
                  <span className="block text-xs text-muted">
                    {AUTOR[m.autor]} · {dataHoraBrasilia(new Date(m.criadoEm))}
                  </span>
                  <span className="block whitespace-pre-wrap break-words text-ink">{m.texto}</span>
                </li>
              ))}
            </ul>
            <form onSubmit={enviar} className="mt-3 space-y-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Sua mensagem</span>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  className="w-full rounded-xl border border-sage-200 px-4 py-3 text-sm outline-none focus:border-sage"
                />
              </label>
              {erro && historico !== null && (
                <p role="alert" className="text-sm text-red-600">
                  {erro}
                </p>
              )}
              <Button type="submit" size="sm" disabled={ocupado}>
                Enviar mensagem
              </Button>
            </form>
          </section>
        </div>
      )}
    </Panel>
  );
}
