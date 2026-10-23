"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { cancelarMensagemProgramada, programarMensagem, type PainelProgramadas } from "@/lib/data/respostas-actions";
import { MSG_CONTATO_BLOQUEADO, ROTULO_MOTIVO, TEXTO_MAX, rotuloHorario, temContato } from "@/lib/respostas/regras";

type Slot = PainelProgramadas["slots"][number];

export function ProgramadasTela({ painel }: { painel: PainelProgramadas }) {
  return (
    <ul className="space-y-4" data-testid="programadas-lista">
      {painel.slots.map((s) => (
        <SlotProgramada key={`${s.quando}:${s.linha?.id ?? "novo"}:${s.linha?.enviar_em ?? ""}`} contratoId={painel.contratoId} slot={s} ativo={painel.ativo} />
      ))}
    </ul>
  );
}

function SlotProgramada({ contratoId, slot, ativo }: { contratoId: string; slot: Slot; ativo: boolean }) {
  const router = useRouter();
  const l = slot.linha;
  const [texto, setTexto] = useState(l?.texto ?? slot.modelo);
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const [agora] = useState(() => Date.now());
  const quando = l?.enviar_em ?? slot.enviarEm;
  const passou = !l && !!slot.enviarEm && Date.parse(slot.enviarEm) < agora;
  const estado = l?.enviada_em ? "enviada" : l ? "programada" : passou ? "passou" : "livre";
  const podeEditar = ativo && (estado === "livre" || (estado === "programada" && editando));

  function salvar() {
    if (temContato(texto)) return setMsg({ ok: false, texto: MSG_CONTATO_BLOQUEADO });
    iniciar(async () => {
      const r = await programarMensagem(contratoId, slot.quando, texto);
      setMsg(r.ok ? { ok: true, texto: "Mensagem programada." } : { ok: false, texto: r.erro });
      if (r.ok) {
        setEditando(false);
        router.refresh();
      }
    });
  }
  function cancelar() {
    iniciar(async () => {
      const r = await cancelarMensagemProgramada(contratoId, slot.quando);
      setMsg(r.ok ? { ok: true, texto: "Mensagem cancelada." } : { ok: false, texto: r.erro });
      if (r.ok) router.refresh();
    });
  }

  return (
    <li className="rounded-xl border border-line bg-white p-4" data-testid={`programada-${slot.quando}`} data-estado={estado}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-title text-base font-semibold text-ink">{slot.rotulo}</h2>
        {quando && (
          <span className="inline-flex items-center gap-1 text-sm text-muted" data-testid="programada-horario" data-enviar-em={quando}>
            <CalendarClock className="h-4 w-4" aria-hidden />
            {estado === "enviada" ? `Enviada ${rotuloHorario(l!.enviada_em!)}` : rotuloHorario(quando)}
          </span>
        )}
      </div>
      {estado === "passou" && <p className="mt-2 text-sm text-muted">A data desta mensagem já passou.</p>}
      {podeEditar ? (
        <>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium text-ink">Texto</span>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={TEXTO_MAX}
              rows={4}
              className="w-full rounded-xl border border-sage-200 px-3 py-3 text-sm outline-none focus:border-sage"
              data-testid="programada-texto"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={salvar}
              disabled={pendente || !texto.trim()}
              className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-medium text-white disabled:opacity-60"
              data-testid="programada-salvar"
            >
              {estado === "programada" ? "Salvar texto" : "Programar"}
            </button>
            {estado === "programada" && (
              <button type="button" onClick={() => setEditando(false)} className="min-h-11 text-sm font-medium text-muted underline">
                Desistir
              </button>
            )}
          </div>
        </>
      ) : (
        l && <p className="mt-3 whitespace-pre-line text-sm text-ink" data-testid="programada-texto-salvo">{l.texto}</p>
      )}
      {estado === "programada" && !editando && ativo && (
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" onClick={() => setEditando(true)} className="min-h-11 text-sm font-medium text-forest underline" data-testid="programada-editar">
            Editar texto
          </button>
          <button type="button" onClick={cancelar} disabled={pendente} className="min-h-11 text-sm font-medium text-red-700 underline" data-testid="programada-cancelar">
            Cancelar envio
          </button>
        </div>
      )}
      {slot.historico.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted" data-testid="programada-historico">
          {slot.historico.map((h) => (
            <li key={h.id} data-motivo={h.motivo_cancelamento ?? ""}>
              {ROTULO_MOTIVO[h.motivo_cancelamento ?? "dono"] ?? "Cancelada"}
            </li>
          ))}
        </ul>
      )}
      {msg && (
        <p className={msg.ok ? "mt-2 text-sm text-forest" : "mt-2 text-sm text-red-700"} role="status" data-testid="programada-msg">
          {msg.texto}
        </p>
      )}
    </li>
  );
}
