/*
  Motor da medição no navegador (Prompt 57) — @cloudflare/speedtest 1.14.2 (MIT), versão fixa no package.json.

  Conferência da biblioteca (PR da fase 1):
  - O único envio de RESULTADO a terceiros é o logAimApiUrl (padrão https://speed.cloudflare.com/__results): aqui
    fica null. O logMeasurementApiUrl já é null por padrão e fica null explicitamente.
  - Só latência, download e upload: sem a fase packetLoss (servidor TURN da Cloudflare) e sem RPKI (outro host).
  - includeCredentials: false (sem cookie). O tráfego que sobra é o do próprio teste com speed.cloudflare.com.
  No laboratório (simulado), nenhum tráfego: o resultado é fixo.
*/
import type { Rodada } from "./internet-medida";

/** Fases curtas: cada rodada fica em ~15–20 s numa conexão comum (2 rodadas ≈ 40 s). */
const FASES = [
  { type: "latency", numPackets: 20 },
  { type: "download", bytes: 1e5, count: 8 },
  { type: "download", bytes: 1e6, count: 6 },
  { type: "upload", bytes: 1e5, count: 6 },
  { type: "upload", bytes: 1e6, count: 4 },
  { type: "download", bytes: 1e7, count: 2 },
] as const;

export const CONFIG_MOTOR = {
  autoStart: false,
  logAimApiUrl: null,
  logMeasurementApiUrl: null,
  includeCredentials: false,
  measurements: FASES as unknown as Record<string, unknown>[],
};

/** Resultado fixo do laboratório (nada sai para a rede). */
export const RODADA_SIMULADA: Rodada = { downloadMbps: 328, uploadMbps: 42, latenciaMs: 12 };

export type Medidor = { promessa: Promise<Rodada>; cancelar: () => void };

/** Uma rodada. `progresso` recebe 0..1 ao longo da rodada. */
export function medirUmaRodada(simulado: boolean, progresso: (f: number) => void): Medidor {
  if (simulado) {
    let t: ReturnType<typeof setTimeout> | null = null;
    let cancelado = false;
    const promessa = new Promise<Rodada>((ok, falha) => {
      let i = 0;
      const passo = () => {
        if (cancelado) return falha(new Error("cancelado"));
        progresso(Math.min(1, ++i / 5));
        if (i >= 5) ok(RODADA_SIMULADA);
        else t = setTimeout(passo, 120);
      };
      t = setTimeout(passo, 120);
    });
    return { promessa, cancelar: () => ((cancelado = true), t && clearTimeout(t)) };
  }
  let motor: { pause: () => void } | null = null;
  let cancelar = () => {};
  const promessa = new Promise<Rodada>((ok, falha) => {
    cancelar = () => {
      motor?.pause();
      falha(new Error("cancelado"));
    };
    import("@cloudflare/speedtest")
      .then(({ default: SpeedTest }) => {
        const m = new SpeedTest(CONFIG_MOTOR as never);
        motor = m;
        let fase = 0;
        m.onPhaseChange = () => progresso(Math.min(0.95, ++fase / FASES.length));
        m.onError = (msg: string) => falha(new Error(msg));
        m.onFinish = (r) => {
          const s = r.getSummary();
          progresso(1);
          if (!s.download || !s.upload || !s.latency) return falha(new Error("incompleto"));
          ok({ downloadMbps: s.download / 1e6, uploadMbps: s.upload / 1e6, latenciaMs: s.latency });
        };
        m.play();
      })
      .catch(falha);
  });
  return { promessa, cancelar: () => cancelar() };
}
