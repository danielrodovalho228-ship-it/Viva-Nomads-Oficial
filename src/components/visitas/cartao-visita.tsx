"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { responderVisita, type AcaoVisita } from "@/lib/data/visitas-video-actions";
import {
  MODALIDADE_ROTULO,
  ROTULO_FUSO,
  STATUS_VISITA_ROTULO,
  campoBrasiliaParaIso,
  formatarHorario,
  formatarHorarioBrasilia,
  instanteParaCampoBrasilia,
  CONFIRMAR_ATE_DIAS,
  type ModalidadeVisita,
  type StatusVisita,
} from "@/lib/visitas-video";
import { cn } from "@/lib/utils";

const TOM: Record<StatusVisita, string> = {
  pedido: "bg-blue-50 text-blue-700",
  confirmado: "bg-emerald-100 text-emerald-700",
  remarcar: "bg-amber-100 text-amber-800",
  feito: "bg-slate-100 text-slate-700",
  cancelado: "bg-slate-100 text-slate-500",
};

export interface VisitaNaTela {
  id: string;
  imovel: string;
  modalidade: ModalidadeVisita;
  horarios: string[];
  motivo: string;
  status: StatusVisita;
  horarioConfirmado: string | null;
  horarioProposto: string | null;
  motivoRecusa: string | null;
  linkChamada: string | null;
  /** Só para o morador, na presencial confirmada. */
  endereco?: string | null;
}

/**
 * Cartão da visita (prompt 23) — o MESMO no painel Visitas e no topo da conversa: modalidade, status (Pedida →
 * Confirmada / Remarcar / Cancelada), horários sempre no horário de Brasília, endereço exato só para o morador e só
 * depois da confirmação (presencial), link da chamada (vídeo) e as ações de cada lado.
 */
export function CartaoVisita({
  v,
  papel,
  compacto = false,
  onMudou,
}: {
  v: VisitaNaTela;
  papel: "dono" | "morador";
  compacto?: boolean;
  /** Na conversa, o cartão é buscado no cliente: avisa para buscar de novo depois de uma resposta. */
  onMudou?: () => void;
}) {
  const Icone = v.modalidade === "presencial" ? MapPin : Video;
  return (
    <div id={`visita-${v.id}`} data-testid="cartao-visita" data-status={v.status} data-modalidade={v.modalidade} className={cn(compacto && "text-sm")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-forest">
            <Icone className="h-3.5 w-3.5" aria-hidden /> Visita {MODALIDADE_ROTULO[v.modalidade].toLowerCase()}
          </p>
          {!compacto && <h3 className="line-clamp-2 font-title text-base font-bold text-ink">{v.imovel}</h3>}
          {v.motivo && <p className="text-xs text-muted">Motivo da estadia: {v.motivo}</p>}
        </div>
        <span data-testid="visita-status" className={`rounded-full px-3 py-1 text-xs font-semibold ${TOM[v.status]}`}>
          {STATUS_VISITA_ROTULO[v.status]}
        </span>
      </div>

      {v.status === "confirmado" && v.horarioConfirmado ? (
        <div className="mt-3 text-sm text-ink">
          <p data-testid="visita-horario-confirmado">
            <strong>{formatarHorarioBrasilia(v.horarioConfirmado)}</strong>
          </p>
          {v.modalidade === "video" && v.linkChamada && (
            <a href={v.linkChamada} target="_blank" rel="noopener noreferrer" data-testid="visita-link-chamada" className="mt-1 inline-block break-all font-medium text-forest underline">
              Entrar na chamada
            </a>
          )}
        </div>
      ) : v.status === "remarcar" && v.horarioProposto ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="visita-horario-proposto">
          {papel === "dono" ? "Você propôs: " : "O proprietário propôs: "}
          <strong>{formatarHorarioBrasilia(v.horarioProposto)}</strong>
          {papel === "dono" && " — aguardando o interessado aceitar."}
        </p>
      ) : (
        <>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm text-ink" data-testid="visita-horarios">
            {v.horarios.map((h) => (
              <li key={h} className="rounded-lg bg-surface-2 px-3 py-1.5">
                {formatarHorario(h)}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">Horários em {ROTULO_FUSO}.</p>
        </>
      )}

      {v.status === "cancelado" && v.motivoRecusa && (
        <p className="mt-2 text-sm text-muted" data-testid="visita-motivo-recusa-texto">
          Motivo: {v.motivoRecusa}
        </p>
      )}

      {papel === "morador" && v.modalidade === "presencial" && (v.status === "pedido" || v.status === "remarcar" || v.status === "confirmado") && (
        v.status === "confirmado" && v.endereco ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-sage-50 px-3 py-2 text-sm text-ink" data-testid="visita-endereco">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden /> {v.endereco}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted" data-testid="visita-endereco-oculto">
            O endereço exato aparece aqui quando a visita for confirmada.
          </p>
        )
      )}

      {papel === "dono" ? <AcoesDono v={v} onMudou={onMudou} /> : <AcoesMorador v={v} onMudou={onMudou} />}
    </div>
  );
}

function useResposta(onMudou?: () => void) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [respondido, setRespondido] = useState(false);
  async function rodar(acao: AcaoVisita) {
    setMsg(null);
    setOcupado(true);
    const r = await responderVisita(acao).catch(() => null);
    setOcupado(false);
    if (!r?.ok) return setMsg(r?.error ?? "Não foi possível agora. Tente de novo.");
    // Os botões somem na hora e a lista é recarregada, sem depender só da revalidação da ação (t168).
    setRespondido(true);
    router.refresh();
    onMudou?.();
  }
  return { msg, ocupado, respondido, rodar };
}

function Erro({ msg }: { msg: string | null }) {
  return msg ? (
    <p role="alert" data-testid="visita-erro" className="mt-2 text-sm text-red-600">
      {msg}
    </p>
  ) : null;
}

/** Ações do PROPRIETÁRIO: confirmar um horário (vídeo: com o link), propor outro (Remarcar), recusar com motivo, concluir. */
function AcoesDono({ v, onMudou }: { v: VisitaNaTela; onMudou?: () => void }) {
  const { msg, ocupado, respondido, rodar } = useResposta(onMudou);
  const [horario, setHorario] = useState(v.horarios[0] ?? "");
  const [outro, setOutro] = useState("");
  const [link, setLink] = useState("");
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const agora = new Date();
  const min = instanteParaCampoBrasilia(agora);
  const max = instanteParaCampoBrasilia(new Date(agora.getTime() + CONFIRMAR_ATE_DIAS * 24 * 3600_000));
  if (v.status === "feito" || v.status === "cancelado" || respondido) return null;
  const outroIso = outro ? campoBrasiliaParaIso(outro) : null;
  const video = v.modalidade === "video";

  const recusa = recusando ? (
    <div className="flex flex-col gap-2" data-testid="visita-recusa">
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        Motivo da recusa (o interessado vê)
        <input
          value={motivo}
          maxLength={200}
          onChange={(e) => setMotivo(e.target.value)}
          data-testid="visita-motivo-recusa"
          placeholder="Ex.: imóvel já alugado nessas datas"
          className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" disabled={ocupado} data-testid="visita-recusar-enviar" onClick={() => rodar({ acao: "cancelar", id: v.id, motivo })}>
          Recusar pedido
        </Button>
        <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setRecusando(false)}>
          Voltar
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div className="mt-4 border-t border-sage-200 pt-4" data-testid="visita-acoes">
      {v.status === "pedido" && !recusando && (
        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-medium text-ink">Horário ({ROTULO_FUSO})</legend>
            {v.horarios.map((h) => (
              <label key={h} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input type="radio" name={`h-${v.id}`} checked={horario === h && !outro} onChange={() => { setHorario(h); setOutro(""); }} />
                {formatarHorario(h)}
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              Ou proponha outro horário ({ROTULO_FUSO})
              <input
                type="datetime-local"
                data-testid="visita-outro-horario"
                min={min}
                max={max}
                value={outro}
                onChange={(e) => setOutro(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
              />
            </label>
          </fieldset>
          {video && (
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              Link da chamada (Meet, Zoom, Teams ou chamada do WhatsApp)
              <input
                type="url"
                inputMode="url"
                data-testid="visita-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {outro ? (
              <Button
                variant="primary"
                size="sm"
                disabled={ocupado || !outroIso}
                data-testid="visita-propor"
                onClick={() => outroIso && rodar({ acao: "remarcar", id: v.id, horario: outroIso, link: video ? link : undefined })}
              >
                Propor este horário
              </Button>
            ) : (
              <Button variant="primary" size="sm" disabled={ocupado} data-testid="visita-confirmar" onClick={() => rodar({ acao: "confirmar", id: v.id, horario, link: video ? link : undefined })}>
                Confirmar horário
              </Button>
            )}
            <Button variant="ghost" size="sm" disabled={ocupado} data-testid="visita-recusar" onClick={() => setRecusando(true)}>
              Recusar
            </Button>
          </div>
        </div>
      )}
      {v.status === "remarcar" && !recusando && (
        <Button variant="ghost" size="sm" disabled={ocupado} data-testid="visita-recusar" onClick={() => setRecusando(true)}>
          Cancelar a proposta
        </Button>
      )}
      {v.status === "confirmado" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" disabled={ocupado} data-testid="visita-concluir" onClick={() => rodar({ acao: "concluir", id: v.id })}>
            Marcar como feita
          </Button>
          <Button variant="ghost" size="sm" disabled={ocupado} data-testid="visita-cancelar" onClick={() => rodar({ acao: "cancelar", id: v.id })}>
            Cancelar
          </Button>
        </div>
      )}
      {recusa}
      <Erro msg={msg} />
    </div>
  );
}

/** Ações do MORADOR: aceitar o horário proposto (Remarcar) e cancelar o próprio pedido. */
function AcoesMorador({ v, onMudou }: { v: VisitaNaTela; onMudou?: () => void }) {
  const { msg, ocupado, respondido, rodar } = useResposta(onMudou);
  if (respondido || !(v.status === "pedido" || v.status === "confirmado" || v.status === "remarcar")) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {v.status === "remarcar" && (
        <Button variant="primary" size="sm" disabled={ocupado} data-testid="visita-aceitar-remarcacao" onClick={() => rodar({ acao: "aceitar_remarcacao", id: v.id })}>
          Aceitar o novo horário
        </Button>
      )}
      <Button variant="ghost" size="sm" disabled={ocupado} data-testid="visita-cancelar-morador" onClick={() => rodar({ acao: "cancelar", id: v.id })}>
        Cancelar pedido
      </Button>
      <Erro msg={msg} />
    </div>
  );
}
