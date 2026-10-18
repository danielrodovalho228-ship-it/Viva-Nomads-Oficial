"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Video, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOTIVOS } from "@/lib/pedidos/pedidos";
import { pedirVisitaVideo } from "@/lib/data/visitas-video-actions";
import { JANELA_DIAS, MAX_HORARIOS, MSG_HORARIOS } from "@/lib/visitas-video";
import { EXEMPLO_AVISO_DEMO } from "@/lib/demo-listing";

/** Valor de <input type="datetime-local"> (hora local) para o instante dado. */
function paraCampo(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

/** Botão "Visita por vídeo" ao lado de "Solicitar reserva": até 3 horários nos próximos 7 dias. */
export function VisitaVideo({
  propertyId,
  exemplo,
  semLogin = false,
  abrirInicial = false,
  onEntrar,
}: {
  propertyId: string;
  exemplo: boolean;
  /** Visitante sem login: o botão leva ao login (e volta com a janela aberta). */
  semLogin?: boolean;
  /** Voltou do login com ?abrir=video: a janela abre sozinha. */
  abrirInicial?: boolean;
  onEntrar?: () => void;
}) {
  const [abertoManual, setAberto] = useState(false);
  const [fechadoManual, setFechado] = useState(false);
  const aberto = abertoManual || (abrirInicial && !fechadoManual);
  const fechar = () => {
    setAberto(false);
    setFechado(true);
  };
  const [horarios, setHorarios] = useState<string[]>([""]);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [demo, setDemo] = useState(false);

  const agora = new Date();
  const min = paraCampo(agora);
  const max = paraCampo(new Date(agora.getTime() + JANELA_DIAS * 24 * 3600_000));

  async function enviar() {
    setErro(null);
    const preenchidos = horarios.filter(Boolean).map((h) => new Date(h));
    if (preenchidos.length === 0 || preenchidos.some((d) => Number.isNaN(d.getTime()))) {
      setErro(MSG_HORARIOS);
      return;
    }
    setEnviando(true);
    const r = await pedirVisitaVideo(propertyId, preenchidos.map((d) => d.toISOString()), motivo || undefined).catch(() => null);
    setEnviando(false);
    if (!r) return setErro("Não foi possível enviar agora. Tente de novo.");
    if (r.needsAuth) {
      if (onEntrar) return onEntrar();
      return setErro(r.error ?? "Entre para pedir a visita por vídeo.");
    }
    if (!r.ok) return setErro(r.error ?? "Não foi possível enviar.");
    setDemo(!!r.demo);
    setEnviado(true);
  }

  return (
    <>
      <Button variant="secondary" size="md" className="w-full" data-cta data-testid="visita-video-abrir" onClick={() => (semLogin && onEntrar ? onEntrar() : setAberto(true))}>
        {enviado ? (
          <>
            <Check className="h-4 w-4" /> Visita por vídeo pedida
          </>
        ) : (
          <>
            <Video className="h-4 w-4" /> Visita por vídeo
          </>
        )}
      </Button>
      {aberto && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-night/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visita-video-titulo"
          data-testid="visita-video-passo"
          onClick={() => fechar()}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 id="visita-video-titulo" className="font-title text-lg font-bold text-ink">
              Visita por vídeo
            </h3>
            {enviado ? (
              <>
                <p data-testid="visita-video-ok" className="mt-3 rounded-lg bg-sage-100 px-3 py-3 text-sm text-forest">
                  {demo
                    ? EXEMPLO_AVISO_DEMO
                    : "Pedido enviado. O proprietário confirma um horário e informa o link da chamada; você acompanha em Visitas por vídeo."}
                </p>
                <div className="mt-4 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => fechar()}>
                    Fechar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">
                  Escolha até {MAX_HORARIOS} horários nos próximos {JANELA_DIAS} dias. O proprietário confirma um deles.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {horarios.map((h, i) => (
                    <input
                      key={i}
                      type="datetime-local"
                      aria-label={`Horário ${i + 1}`}
                      data-testid={`visita-video-horario-${i}`}
                      min={min}
                      max={max}
                      value={h}
                      onChange={(e) => setHorarios((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                      className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
                    />
                  ))}
                  {horarios.length < MAX_HORARIOS && (
                    <button type="button" className="self-start text-sm font-medium text-forest hover:underline" onClick={() => setHorarios((l) => [...l, ""])}>
                      + Outro horário
                    </button>
                  )}
                </div>
                <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-ink">
                  Motivo da estadia (opcional)
                  <select
                    data-testid="visita-video-motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
                  >
                    <option value="">Prefiro não informar</option>
                    {MOTIVOS.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-3 text-xs text-muted">Seu nome e contato não aparecem para o proprietário antes do aceite.</p>
                {exemplo && (
                  <p data-testid="visita-video-demo" className="mt-3 rounded-lg bg-sage-100 px-3 py-2 text-center text-xs font-medium text-forest">
                    {EXEMPLO_AVISO_DEMO}
                  </p>
                )}
                {erro && (
                  <p role="alert" data-testid="visita-video-erro" className="mt-3 text-sm text-red-600">
                    {erro}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => fechar()} disabled={enviando}>
                    Voltar
                  </Button>
                  <Button variant="primary" size="sm" onClick={enviar} disabled={enviando} data-testid="visita-video-enviar">
                    {enviando ? "Enviando..." : "Pedir visita"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
