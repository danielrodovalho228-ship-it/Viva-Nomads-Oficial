"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { responderVisitaVideo } from "@/lib/data/visitas-video-actions";
import { formatarHorario, statusAposAcao, type StatusVisita } from "@/lib/visitas-video";
import { useStatusVisita } from "./status-visita";

/** Ações do PROPRIETÁRIO num pedido: confirmar um horário (ou propor outro) com o link da chamada, concluir ou cancelar. */
export function AcoesVisitaDono({ id, status, horarios }: { id: string; status: StatusVisita; horarios: string[] }) {
  const router = useRouter();
  const [horario, setHorario] = useState(horarios[0] ?? "");
  const [outro, setOutro] = useState("");
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [respondido, setRespondido] = useState(false);
  const { mudar } = useStatusVisita(status);

  async function rodar(acao: "confirmar" | "concluir" | "cancelar", fn: () => ReturnType<typeof responderVisitaVideo>) {
    setMsg(null);
    setOcupado(true);
    const r = await fn().catch(() => null);
    setOcupado(false);
    if (!r?.ok) return setMsg(r?.error ?? "Não foi possível agora. Tente de novo.");
    // Os botões somem na hora e a lista é recarregada, sem depender só da revalidação da ação (t168).
    setRespondido(true);
    mudar(statusAposAcao(acao));
    router.refresh();
  }

  if (status === "feito" || status === "cancelado" || respondido) return null;
  return (
    <div className="mt-4 border-t border-sage-200 pt-4" data-testid="visita-acoes">
      {status === "pedido" && (
        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-medium text-ink">Horário da chamada</legend>
            {horarios.map((h) => (
              <label key={h} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input type="radio" name={`h-${id}`} checked={horario === h && !outro} onChange={() => { setHorario(h); setOutro(""); }} />
                {formatarHorario(h)}
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              Ou proponha outro horário
              <input
                type="datetime-local"
                data-testid="visita-outro-horario"
                value={outro}
                onChange={(e) => setOutro(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
              />
            </label>
          </fieldset>
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
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={ocupado}
              data-testid="visita-confirmar"
              onClick={() =>
                rodar("confirmar", () => responderVisitaVideo({ acao: "confirmar", id, horario: outro ? new Date(outro).toISOString() : horario, link }))
              }
            >
              Confirmar horário
            </Button>
            <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => rodar("cancelar", () => responderVisitaVideo({ acao: "cancelar", id }))}>
              Cancelar pedido
            </Button>
          </div>
        </div>
      )}
      {status === "confirmado" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" disabled={ocupado} data-testid="visita-concluir" onClick={() => rodar("concluir", () => responderVisitaVideo({ acao: "concluir", id }))}>
            Marcar como feita
          </Button>
          <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => rodar("cancelar", () => responderVisitaVideo({ acao: "cancelar", id }))}>
            Cancelar
          </Button>
        </div>
      )}
      {msg && (
        <p role="alert" data-testid="visita-erro" className="mt-2 text-sm text-red-600">
          {msg}
        </p>
      )}
    </div>
  );
}

/** Morador cancela o próprio pedido (aberto ou confirmado). */
export function CancelarVisitaMorador({ id }: { id: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-3">
      <Button
        variant="ghost"
        size="sm"
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          const r = await responderVisitaVideo({ acao: "cancelar", id }).catch(() => null);
          setOcupado(false);
          if (!r?.ok) return setMsg(r?.error ?? "Não foi possível agora.");
          router.refresh();
        }}
      >
        Cancelar pedido
      </Button>
      {msg && <p role="alert" className="mt-1 text-sm text-red-600">{msg}</p>}
    </div>
  );
}
