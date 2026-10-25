"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Video, Check, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOTIVOS } from "@/lib/pedidos/pedidos";
import { pedirVisita } from "@/lib/data/visitas-video-actions";
import { JANELA_DIAS, MAX_HORARIOS, MSG_HORARIOS, ROTULO_FUSO, campoBrasiliaParaIso, instanteParaCampoBrasilia, type ModalidadeVisita } from "@/lib/visitas-video";
import { EXEMPLO_AVISO_DEMO } from "@/lib/demo-listing";

type PropsVisita = {
  propertyId: string;
  exemplo: boolean;
  /** Visitante sem login: o botão leva ao login (e volta com a janela aberta). */
  semLogin?: boolean;
  /** Voltou do login com ?abrir=video|visita: a janela abre sozinha. */
  abrirInicial?: boolean;
  onEntrar?: () => void;
  /** Prompt 41: a visita é opção — "Agendar visita" em texto terciário (padrão: secundário). */
  variante?: "secondary" | "tertiary";
  /** Prompt 41: cada aumento abre a janela (o "Agendar visita" do rodapé fixo do celular). */
  abrirSinal?: number;
};

/** Botão "Visita por vídeo" ao lado de "Solicitar reserva": até 3 horários nos próximos 7 dias. */
export function VisitaVideo(p: PropsVisita) {
  return <PedidoVisita {...p} modalidade="video" />;
}

/**
 * "Agendar visita" PRESENCIAL (prompt 23): o mesmo fluxo da visita por vídeo, dentro da plataforma — o morador propõe
 * até 3 horários, o dono confirma, propõe outro ou recusa com motivo, e o endereço exato só aparece depois da
 * confirmação. Nada de WhatsApp nem contato direto.
 */
export function VisitaPresencial(p: PropsVisita) {
  return <PedidoVisita {...p} modalidade="presencial" />;
}

const TEXTOS = {
  video: {
    botao: "Visita por vídeo",
    feito: "Visita por vídeo pedida",
    titulo: "Visita por vídeo",
    ok: "Pedido enviado. O proprietário confirma um horário e informa o link da chamada; você acompanha em Visitas.",
    prefixo: "visita-video",
  },
  presencial: {
    botao: "Agendar visita",
    feito: "Visita pedida",
    titulo: "Agendar uma visita",
    ok: "Pedido de visita enviado. O proprietário confirma aqui na plataforma e você recebe um aviso.",
    prefixo: "visita-presencial",
  },
} as const;

/**
 * Pedido de visita (vídeo ou presencial). FUSO (prompt 23, P0): o horário escolhido é lido como horário de BRASÍLIA
 * (o fuso do imóvel), qualquer que seja o fuso do navegador — antes, um computador nos EUA gravava 15:00 de lá.
 */
function PedidoVisita({
  propertyId,
  exemplo,
  semLogin = false,
  abrirInicial = false,
  onEntrar,
  modalidade,
  variante = "secondary",
  abrirSinal = 0,
}: PropsVisita & { modalidade: ModalidadeVisita }) {
  const t = TEXTOS[modalidade];
  const [abertoManual, setAberto] = useState(false);
  const [fechadoManual, setFechado] = useState(false);
  // O sinal do rodapé abre sem efeito: fica aberto enquanto o sinal for maior que o do último fechamento.
  const [fechadoNoSinal, setFechadoNoSinal] = useState(0);
  const aberto = abertoManual || (abrirInicial && !fechadoManual) || abrirSinal > fechadoNoSinal;
  const fechar = () => {
    setAberto(false);
    setFechado(true);
    setFechadoNoSinal(abrirSinal);
  };
  // Horários com CHAVE ESTÁVEL (complemento do prompt 23): o campo nunca é recriado nem zerado quando outro campo
  // (ex.: "Motivo da estadia") muda e a tela redesenha. O campo não recebe `value` controlado: um datetime-local meio
  // preenchido (só a data) vale "" para o React, e reaplicar "" apagava o que a pessoa já tinha escolhido.
  const [horarios, setHorarios] = useState<{ id: number; valor: string }[]>([{ id: 0, valor: "" }]);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [demo, setDemo] = useState(false);

  // Limites calculados UMA vez (antes mudavam a cada redesenho, junto com o relógio).
  const [{ min, max }] = useState(() => {
    const agora = new Date();
    return { min: instanteParaCampoBrasilia(agora), max: instanteParaCampoBrasilia(new Date(agora.getTime() + JANELA_DIAS * 24 * 3600_000)) };
  });

  async function enviar() {
    setErro(null);
    const preenchidos = horarios.map((h) => h.valor).filter(Boolean).map((h) => campoBrasiliaParaIso(h));
    if (preenchidos.length === 0 || preenchidos.some((d) => !d)) {
      setErro(MSG_HORARIOS);
      return;
    }
    setEnviando(true);
    const r = await pedirVisita(propertyId, preenchidos as string[], motivo || undefined, modalidade).catch(() => null);
    setEnviando(false);
    if (!r) return setErro("Não foi possível enviar agora. Tente de novo.");
    if (r.needsAuth) {
      if (onEntrar) return onEntrar();
      return setErro(r.error ?? "Entre para pedir a visita.");
    }
    if (!r.ok) return setErro(r.error ?? "Não foi possível enviar.");
    setDemo(!!r.demo);
    setEnviado(true);
  }

  return (
    <>
      <Button
        variant={variante}
        size="md"
        className={variante === "tertiary" ? "self-center" : "w-full"}
        data-testid={modalidade === "video" ? "visita-video-abrir" : "agendar-visita"}
        onClick={() => (semLogin && onEntrar ? onEntrar() : setAberto(true))}
      >
        {enviado ? (
          <>
            <Check className="h-4 w-4" /> {t.feito}
          </>
        ) : (
          <>
            {modalidade === "video" ? <Video className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />} {t.botao}
          </>
        )}
      </Button>
      {aberto && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-night/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${t.prefixo}-titulo`}
          data-testid={`${t.prefixo}-passo`}
          onClick={() => fechar()}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-xl bg-white p-4 sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <h3 id={`${t.prefixo}-titulo`} className="font-title text-lg font-semibold text-ink">
              {t.titulo}
            </h3>
            {enviado ? (
              <>
                <p data-testid={`${t.prefixo}-ok`} className="mt-3 rounded-lg bg-sage-100 px-3 py-3 text-sm text-forest">
                  {demo ? EXEMPLO_AVISO_DEMO : t.ok}
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
                  Escolha até {MAX_HORARIOS} horários nos próximos {JANELA_DIAS} dias, no <strong>{ROTULO_FUSO}</strong>. O proprietário
                  confirma um deles aqui na plataforma.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {horarios.map((h, i) => (
                    <input
                      key={h.id}
                      type="datetime-local"
                      aria-label={`Horário ${i + 1} (${ROTULO_FUSO})`}
                      data-testid={`${t.prefixo}-horario-${i}`}
                      min={min}
                      max={max}
                      defaultValue={h.valor}
                      onChange={(e) => {
                        const valor = e.target.value;
                        setHorarios((l) => l.map((x) => (x.id === h.id ? { ...x, valor } : x)));
                      }}
                      className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
                    />
                  ))}
                  {horarios.length < MAX_HORARIOS && (
                    <button type="button" className="self-start text-sm font-medium text-forest hover:underline" onClick={() => setHorarios((l) => [...l, { id: Math.max(...l.map((x) => x.id)) + 1, valor: "" }])}>
                      + Outro horário
                    </button>
                  )}
                </div>
                <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-ink">
                  Motivo da estadia (opcional)
                  <select
                    data-testid={`${t.prefixo}-motivo`}
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
                  <p data-testid={`${t.prefixo}-demo`} className="mt-3 rounded-lg bg-sage-100 px-3 py-2 text-center text-xs font-medium text-forest">
                    {EXEMPLO_AVISO_DEMO}
                  </p>
                )}
                {erro && (
                  <p role="alert" data-testid={`${t.prefixo}-erro`} className="mt-3 text-sm text-red-600">
                    {erro}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => fechar()} disabled={enviando}>
                    Voltar
                  </Button>
                  <Button variant="primary" size="sm" onClick={enviar} disabled={enviando} data-testid={`${t.prefixo}-enviar`}>
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
