"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { INTERNET } from "@/config/internet";
import { medirUmaRodada } from "@/lib/internet-motor";
import type { Rodada } from "@/lib/internet-medida";
import { registrarMedicao } from "@/lib/vistoria/laudo-actions";

/** Posição do aparelho só para o servidor conferir a distância ao imóvel; nunca é guardada. */
function posicao(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((ok) =>
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => ok(null),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    ),
  );
}

/**
 * Internet medida NA HORA da avaliação (Prompt 62-B2), pelo motor do 57: quarto principal e ponto de trabalho. A
 * medição entra no nível sustentado do laudo; a distância ao imóvel é só interna.
 */
export function MedirInternetAvaliacao({ pedidoId, simulado }: { pedidoId: string; simulado: boolean }) {
  const [ponto, setPonto] = useState<"quarto_principal" | "trabalho">("quarto_principal");
  const [wifi, setWifi] = useState(false);
  const [fase, setFase] = useState<"parado" | "medindo">("parado");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function medir() {
    setFase("medindo");
    setMsg(null);
    const local = await posicao();
    const rodadas: Rodada[] = [];
    try {
      for (let i = 0; i < INTERNET.rodadas; i++) rodadas.push(await medirUmaRodada(simulado, () => {}).promessa);
    } catch {
      setFase("parado");
      return setMsg({ ok: false, texto: "A medição não terminou. Tente de novo." });
    }
    const f = new FormData();
    f.set("pedidoId", pedidoId);
    f.set("tipo", "internet");
    f.set("ponto", ponto);
    f.set("rodadas", JSON.stringify(rodadas));
    if (local) {
      f.set("lat", String(local.lat));
      f.set("lng", String(local.lng));
    }
    if (wifi) f.set("wifi", "on");
    const r = await registrarMedicao(f).catch(() => ({ ok: false as const, erro: "Sem resposta agora. Tente de novo." }));
    setMsg(r.ok ? { ok: true, texto: r.mensagem ?? "Internet medida." } : { ok: false, texto: r.erro });
    setFase("parado");
  }

  return (
    <div className="text-sm" data-testid="avaliacao-internet">
      <label className="flex flex-wrap items-center gap-2 text-ink">
        Ponto
        <select value={ponto} onChange={(e) => setPonto(e.target.value as typeof ponto)} className="h-10 rounded-lg border border-sage-200 px-2 text-sm" data-testid="avaliacao-internet-ponto">
          <option value="quarto_principal">Quarto principal</option>
          <option value="trabalho">Ponto de trabalho</option>
        </select>
      </label>
      <label className="mt-2 flex items-center gap-2 text-ink">
        <input type="checkbox" checked={wifi} onChange={(e) => setWifi(e.target.checked)} data-testid="avaliacao-internet-wifi" /> Estou no Wi-Fi do imóvel
      </label>
      <Button type="button" size="sm" className="mt-2" onClick={() => void medir()} disabled={fase !== "parado"} data-testid="avaliacao-internet-medir">
        {fase === "medindo" ? "Medindo…" : "Medir agora"}
      </Button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-2 ${msg.ok ? "text-forest" : "text-red-600"}`} data-testid={msg.ok ? "acao-ok" : "acao-erro"}>
          {msg.texto}
        </p>
      )}
    </div>
  );
}
