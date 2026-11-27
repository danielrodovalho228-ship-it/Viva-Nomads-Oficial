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

/**
 * Fases curtas: cada rodada fica em ~15–20 s numa conexão comum (2 rodadas ≈ 40 s). A biblioteca só conta pedidos que duram
 * 10 ms ou mais (bandwidthMinRequestDuration): numa conexão rápida os pedidos pequenos não valem e o sentido ficava VAZIO
 * ("incompleto", E414). Por isso os tamanhos sobem (em ordem crescente) até 10 MB no envio e 25 MB no download; a própria
 * biblioteca encerra o sentido quando os pedidos passam de 1 s, então numa conexão lenta os grandes nem chegam a rodar.
 */
const FASES = [
  { type: "latency", numPackets: 20 },
  { type: "download", bytes: 1e5, count: 8 },
  { type: "download", bytes: 1e6, count: 6 },
  { type: "download", bytes: 1e7, count: 2 },
  { type: "download", bytes: 2.5e7, count: 2 },
  { type: "upload", bytes: 1e5, count: 6 },
  { type: "upload", bytes: 1e6, count: 4 },
  { type: "upload", bytes: 1e7, count: 2 },
] as const;

export const CONFIG_MOTOR = {
  autoStart: false,
  logAimApiUrl: null,
  logMeasurementApiUrl: null,
  includeCredentials: false,
  // E414 (3ª reprova): sem isto a biblioteca espera PARA SEMPRE por um pedido parado (medido no Chromium com um upload sem
  // resposta). Passados 30 s, ela aborta e diz qual sentido travou; as fases servem a conexões de 8 a 300 Mbps (9–28 s).
  bandwidthAbortRequestDuration: 30_000,
  measurements: FASES as unknown as Record<string, unknown>[],
};

/** Resultado fixo do laboratório (nada sai para a rede). */
export const RODADA_SIMULADA: Rodada = { downloadMbps: 328, uploadMbps: 42, latenciaMs: 12 };

export type Medidor = { promessa: Promise<Rodada>; cancelar: () => void };

/**
 * E414: prazo de uma rodada. A biblioteca não tem prazo total: um pedido parado ao servidor de teste deixava a tela em
 * "Medindo… 95%" para sempre e o item da Qualificação travado. Passado o prazo, a rodada para e falha com um aviso.
 */
export const PRAZO_RODADA_MS = 60_000;

/** A promessa ou o erro "demorou" depois de `ms` (o `cancelar` para o motor). Puro, testável. */
export function comPrazo<T>(promessa: Promise<T>, ms: number, cancelar: () => void): Promise<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  const limite = new Promise<never>((_, falha) => {
    t = setTimeout(() => {
      cancelar();
      falha(new FalhaMedicao("demorou", "geral", ms));
    }, ms);
  });
  return Promise.race([promessa, limite]).finally(() => t && clearTimeout(t));
}

export type MotivoFalha = "demorou" | "incompleto" | "cancelado" | "rede" | "travou" | "limite" | "servidor" | "conexao";
export type FaseFalha = "latencia" | "download" | "envio" | "geral" | "desconhecida";

/** Falha com motivo, sentido e tempo (a tela mostra a frase certa e o servidor registra o motivo). */
export class FalhaMedicao extends Error {
  readonly motivo: MotivoFalha;
  readonly fase: FaseFalha;
  readonly ms: number;
  readonly status?: number;
  constructor(motivo: MotivoFalha, fase: FaseFalha, ms: number, status?: number) {
    super(motivo);
    this.motivo = motivo;
    this.fase = fase;
    this.ms = ms;
    this.status = status;
  }
}

/** Por que a rodada falhou (cada motivo tem a sua mensagem na tela). Puro. */
export function motivoDaFalha(e: unknown): MotivoFalha {
  if (e instanceof FalhaMedicao) return e.motivo;
  const m = e instanceof Error ? e.message : "";
  return m === "demorou" || m === "incompleto" || m === "cancelado" ? m : "rede";
}

/**
 * A mensagem de erro da biblioteca (texto fixo dela, medido no Chromium) → motivo + sentido. Puro.
 *  "Download|Upload measurement of N bytes aborted…"  pedido parado (bandwidthAbortRequestDuration)
 *  "Connection failed to <url>. Gave up after 3 retries."  429 do servidor de teste
 *  "Request failed with <status>: <url>"  o servidor respondeu com erro
 *  "Connection failed to <url>."  a conexão caiu ou foi bloqueada
 */
export function classificarErroDaBiblioteca(msg: unknown): { motivo: MotivoFalha; fase: FaseFalha; status?: number } {
  const t = typeof msg === "string" ? msg : msg instanceof Error ? msg.message : "";
  const fase: FaseFalha = /\/__up\b/.test(t) ? "envio" : /\/__down\?[^ ]*bytes=0/.test(t) || /during=idle/.test(t) ? "latencia" : /\/__down\b/.test(t) ? "download" : "desconhecida";
  const abortado = /^(Download|Upload) measurement of/.exec(t);
  if (abortado) return { motivo: "travou", fase: abortado[1] === "Upload" ? "envio" : "download" };
  if (/Gave up after \d+ retries/.test(t)) return { motivo: "limite", fase };
  const http = /Request failed with (\d+):/.exec(t);
  if (http) return { motivo: "servidor", fase, status: Number(http[1]) };
  if (/^Connection failed to /.test(t)) return { motivo: "conexao", fase };
  return { motivo: "rede", fase: "desconhecida" };
}

/** O resumo da biblioteca só vale com latência, download e upload presentes e positivos. Puro. */
export function resumoCompleto(s: { download?: number; upload?: number; latency?: number } | null | undefined): Rodada | null {
  if (!s || !(s.download && s.download > 0) || !(s.upload && s.upload > 0) || !(s.latency && s.latency > 0)) return null;
  return { downloadMbps: s.download / 1e6, uploadMbps: s.upload / 1e6, latenciaMs: s.latency };
}

const NOME_FASE: Record<FaseFalha, string> = { latencia: "teste de resposta", download: "download", envio: "envio", geral: "teste", desconhecida: "teste" };

/** A frase da tela para cada falha, com um código curto que a QA pode citar. Puro. */
/** E414 (degradação graciosa): depois da falha, o dono sabe que nada foi registrado e que pode seguir e medir depois. */
export const ROTULO_TENTAR_DE_NOVO = "Tentar de novo";
export const TEXTO_MEDIR_DEPOIS = "Nada foi registrado no imóvel. Você pode seguir com o cadastro e medir depois, quando estiver numa rede que alcance o servidor de teste.";

export function mensagemDaFalha(e: unknown): string {
  const motivo = motivoDaFalha(e);
  const f = e instanceof FalhaMedicao ? e : null;
  const fase = NOME_FASE[f?.fase ?? "desconhecida"];
  const cod = (c: string) => ` Código: E414-${c}.`;
  switch (motivo) {
    case "demorou":
      return "A medição demorou demais e parou. Confira o Wi-Fi e tente de novo." + cod("demorou");
    case "incompleto":
      return "A medição não conseguiu medir o envio, o download ou a resposta da conexão por completo. Tente de novo." + cod("incompleto");
    case "travou":
      return `A conexão parou de responder no ${fase} e a medição foi encerrada. Tente de novo ou troque de rede.` + cod(`travou-${f?.fase ?? "desconhecida"}`);
    case "limite":
      return "O servidor de teste pediu para esperar (muitas medições seguidas). Aguarde alguns minutos e tente de novo." + cod("limite");
    case "servidor":
      return `O servidor de teste respondeu com erro${f?.status ? ` (código ${f.status})` : ""}. Tente de novo mais tarde.` + cod("servidor");
    case "conexao":
      return `Não foi possível falar com o servidor de teste no ${fase} (conexão caiu, bloqueador ou firewall). Tente de novo ou use outra rede.` + cod(`conexao-${f?.fase ?? "desconhecida"}`);
    default:
      return "A medição não terminou. Confira a conexão e tente de novo." + cod("rede");
  }
}

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
        const inicio = Date.now();
        m.onError = (msg: string) => {
          // O que já foi medido vale mesmo se o erro vier depois (a biblioteca guarda os resultados).
          const r = resumoCompleto(m.results.getSummary());
          if (r) return ok(r);
          const c = classificarErroDaBiblioteca(msg);
          falha(new FalhaMedicao(c.motivo, c.fase, Date.now() - inicio, c.status));
        };
        m.onFinish = (r) => {
          const completo = resumoCompleto(r.getSummary());
          progresso(1);
          if (!completo) return falha(new FalhaMedicao("incompleto", "geral", Date.now() - inicio));
          ok(completo);
        };
        m.play();
      })
      .catch(falha);
  });
  return { promessa: comPrazo(promessa, PRAZO_RODADA_MS, () => motor?.pause()), cancelar: () => cancelar() };
}
