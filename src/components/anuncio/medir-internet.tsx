"use client";

import { useEffect, useRef, useState } from "react";
import { Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAppUserAgent } from "@/lib/app-mode";
import { INTERNET, TEXTO_PARA_VALIDAR_NO_APP } from "@/config/internet";
import { juntarRodadas, textoInternet, type MotivoInvalida, type Rodada } from "@/lib/internet-medida";
import { medirUmaRodada, type Medidor } from "@/lib/internet-motor";
import type { EstadoMedir, ResultadoMedicao, Origem } from "@/lib/internet-medida-servidor";

const MOTIVO: Record<MotivoInvalida, string> = {
  sem_permissao: "sem a localização do aparelho",
  longe: `o aparelho estava a mais de ${INTERNET.raioValidacaoM} m do imóvel`,
  sem_coordenadas_imovel: "o imóvel ainda não tem o endereço no mapa",
  sem_confirmacao_wifi: "faltou confirmar que você está no Wi-Fi do imóvel",
};

/** Posição do aparelho só para conferir a distância no servidor; nunca é guardada. */
function posicao(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((ok) =>
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => ok(null),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
    )
  );
}

/**
 * "Medir a internet agora" (Prompt 57): no cadastro e na edição (dono) e na conferência de entrada (morador).
 * Duas rodadas no navegador (mediana), com progresso e cancelar; o servidor confere a distância ao imóvel.
 */
export function MedirInternet({ imovelId, origem }: { imovelId: string; origem: Origem }) {
  const [estado, setEstado] = useState<EstadoMedir | null>(null);
  const [wifi, setWifi] = useState(false);
  const [fase, setFase] = useState<"parado" | "local" | "medindo" | "salvando">("parado");
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<ResultadoMedicao | null>(null);
  const atual = useRef<Medidor | null>(null);
  const cancelou = useRef(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/internet/medicoes?imovel=${encodeURIComponent(imovelId)}&origem=${origem}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((e: EstadoMedir) => vivo && setEstado(e))
      .catch(() => vivo && setEstado({ ok: false, erro: "Não deu para carregar agora." }));
    return () => {
      vivo = false;
      atual.current?.cancelar();
    };
  }, [imovelId, origem]);

  if (!estado) return null;
  if (!estado.ok) return null;

  async function medir() {
    if (!estado?.ok) return;
    cancelou.current = false;
    setResultado(null);
    setFase("local");
    const local = await posicao();
    if (cancelou.current) return setFase("parado");
    setFase("medindo");
    setProgresso(0);
    const rodadas: Rodada[] = [];
    try {
      for (let i = 0; i < INTERNET.rodadas; i++) {
        const m = medirUmaRodada(estado.simulado, (f) => setProgresso((i + f) / INTERNET.rodadas));
        atual.current = m;
        rodadas.push(await m.promessa);
      }
    } catch {
      atual.current = null;
      setFase("parado");
      if (!cancelou.current) setResultado({ ok: false, erro: "A medição não terminou. Confira a conexão e tente de novo." });
      return;
    }
    atual.current = null;
    if (!juntarRodadas(rodadas)) {
      setFase("parado");
      return setResultado({ ok: false, erro: "A medição não terminou. Tente de novo." });
    }
    setFase("salvando");
    try {
      const resp = await fetch("/api/internet/medicoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imovel: imovelId, origem, rodadas, local, confirmouWifi: wifi }),
      });
      const r = (await resp.json()) as ResultadoMedicao;
      setResultado(r);
      if (r.ok && r.validada && estado.papel === "dono") setEstado({ ...estado, ultima: r.medicao, restantesHoje: estado.restantesHoje - 1 });
      else if (r.ok) setEstado({ ...estado, restantesHoje: estado.restantesHoje - 1 });
    } catch {
      setResultado({ ok: false, erro: "Sem resposta agora. Tente de novo." });
    }
    setFase("parado");
  }

  function cancelar() {
    cancelou.current = true;
    atual.current?.cancelar();
  }

  const ocupado = fase !== "parado";
  const atualTexto = estado.papel === "dono" ? textoInternet(estado.ultima, null, new Date()) : null;

  return (
    <div id="internet" className="mt-3 rounded-xl border border-sage-200 bg-white p-4" data-testid="medir-internet">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Wifi className="h-4 w-4 text-forest" aria-hidden /> Medir a internet no imóvel
      </p>
      <p className="mt-1 text-xs text-muted">
        {estado.papel === "dono"
          ? "Conectado ao Wi-Fi do imóvel, meça a velocidade. Com a medição validada, o anúncio mostra o número e a data."
          : "Opcional. A sua medição não aparece no anúncio: ela só avisa o proprietário se a internet estiver bem abaixo do que ele mediu."}
      </p>
      {atualTexto && (
        <p className="mt-2 text-sm text-ink" data-testid="medir-internet-atual">
          {atualTexto.texto}
        </p>
      )}
      <label className="mt-3 flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={wifi} onChange={(e) => setWifi(e.target.checked)} disabled={ocupado} data-testid="medir-internet-wifi" />
        Estou conectado ao Wi-Fi do imóvel
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="primary" size="sm" disabled={ocupado || estado.restantesHoje <= 0} onClick={medir} data-testid="medir-internet-botao">
          {fase === "local" ? "Pedindo a localização…" : fase === "medindo" ? `Medindo… ${Math.round(progresso * 100)}%` : fase === "salvando" ? "Salvando…" : "Medir a internet agora"}
        </Button>
        {fase === "medindo" && (
          <Button type="button" variant="secondary" size="sm" onClick={cancelar} data-testid="medir-internet-cancelar">
            Cancelar
          </Button>
        )}
      </div>
      {fase === "medindo" && (
        <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-sage-100" role="progressbar" aria-valuenow={Math.round(progresso * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-forest transition-all" style={{ width: `${Math.round(progresso * 100)}%` }} />
        </div>
      )}
      {estado.restantesHoje <= 0 && !ocupado && <p className="mt-2 text-xs text-muted">Limite de {INTERNET.limitePorDia} medições por dia neste imóvel. Tente amanhã.</p>}
      {!estado.temCoordenadas && <p className="mt-2 text-xs text-muted">Para validar, o imóvel precisa do endereço no mapa.</p>}
      {resultado && !resultado.ok && (
        <p className="mt-2 text-sm text-red-700" role="alert" data-testid="medir-internet-erro">
          {resultado.erro}
        </p>
      )}
      {resultado?.ok && (
        <p className="mt-2 text-sm text-ink" role="status" data-testid="medir-internet-resultado" data-validada={resultado.validada ? "1" : "0"}>
          {Math.round(resultado.medicao.downloadMbps)} Mbps para baixar · {Math.round(resultado.medicao.uploadMbps)} para enviar · {Math.round(resultado.medicao.latenciaMs)} ms.{" "}
          {resultado.validada
            ? estado.papel === "dono"
              ? "Medida no imóvel: o anúncio mostra este número."
              : "Medição registrada."
            : `Não validada: ${MOTIVO[resultado.motivo ?? "sem_permissao"]}. ${estado.papel === "dono" ? "Não aparece no anúncio." : ""}${resultado.motivo === "sem_permissao" && isAppUserAgent(navigator.userAgent) ? ` ${TEXTO_PARA_VALIDAR_NO_APP}.` : ""}`}
        </p>
      )}
    </div>
  );
}
