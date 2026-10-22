/*
  Internet medida no imóvel (Prompt 57, roteiro B3) — regras PURAS.

  O navegador mede (2 rodadas, mediana) e manda o resultado; o servidor confere sessão, papel, limite e distância e
  grava. Aqui ficam a mediana, a validação pela distância, a validade, a regra de videochamada, o sinal do morador e
  os textos da página do imóvel. Nenhum número inventado: sem medição válida, nenhuma frase de capacidade.
*/
import { INTERNET, TEXTO_VIDEOCHAMADA } from "../config/internet.ts";
import { distanciaMetros } from "./proximidades/osm.ts";

export type Rodada = { downloadMbps: number; uploadMbps: number; latenciaMs: number };
export type Medicao = Rodada & { medidoEm: string; validoAte: string };

const DIA = 86_400_000;

/** Mediana de uma lista (média dos dois do meio quando par). */
export function mediana(xs: number[]): number {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Junta as rodadas pela mediana de cada grandeza; arredonda Mbps a 1 casa e ms ao inteiro. */
export function juntarRodadas(rodadas: Rodada[]): Rodada | null {
  const ok = rodadas.filter((r) => r && r.downloadMbps > 0 && r.uploadMbps > 0 && r.latenciaMs > 0);
  if (!ok.length) return null;
  const um = (x: number) => Math.round(x * 10) / 10;
  return {
    downloadMbps: um(mediana(ok.map((r) => r.downloadMbps))),
    uploadMbps: um(mediana(ok.map((r) => r.uploadMbps))),
    latenciaMs: Math.round(mediana(ok.map((r) => r.latenciaMs))),
  };
}

/** Resultado vindo do navegador: números finitos, positivos e plausíveis (nada de 0 ou 1e9). */
export function rodadaValida(x: unknown): x is Rodada {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  const n = (v: unknown, max: number) => typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max;
  return n(r.downloadMbps, 20_000) && n(r.uploadMbps, 20_000) && n(r.latenciaMs, 10_000);
}

export type MotivoInvalida = "sem_permissao" | "longe" | "sem_coordenadas_imovel" | "sem_confirmacao_wifi";

/**
 * Valida pela distância do aparelho às coordenadas do imóvel. Devolve só a distância em metros (a coordenada do
 * aparelho nunca é guardada) e, quando não valida, o motivo.
 */
export function validarLocal(
  aparelho: { lat: number; lng: number } | null,
  imovel: { lat: number; lng: number } | null,
  confirmouWifi: boolean
): { validada: boolean; distanciaM: number | null; motivo: MotivoInvalida | null } {
  if (!imovel || !Number.isFinite(imovel.lat) || !Number.isFinite(imovel.lng)) return { validada: false, distanciaM: null, motivo: "sem_coordenadas_imovel" };
  if (!aparelho || !Number.isFinite(aparelho.lat) || !Number.isFinite(aparelho.lng)) return { validada: false, distanciaM: null, motivo: "sem_permissao" };
  const distanciaM = distanciaMetros(aparelho, imovel);
  if (distanciaM > INTERNET.raioValidacaoM) return { validada: false, distanciaM, motivo: "longe" };
  if (!confirmouWifi) return { validada: false, distanciaM, motivo: "sem_confirmacao_wifi" };
  return { validada: true, distanciaM, motivo: null };
}

/** Fim da validade: a data da medição + 6 meses (mesmo dia do mês; cai no último dia quando o mês é mais curto). */
export function validoAte(medidoEm: Date): Date {
  const d = new Date(medidoEm.getTime());
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + INTERNET.validadeMeses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d;
}

export function vigente(m: { validoAte: string } | null | undefined, agora: Date): boolean {
  return !!m && new Date(m.validoAte).getTime() > agora.getTime();
}

/** Hora de avisar "Meça de novo": a partir de ~5,5 meses da medição e enquanto ela ainda vale. */
export function horaDeAvisarRemedicao(m: { medidoEm: string; validoAte: string }, agora: Date): boolean {
  const desde = agora.getTime() - new Date(m.medidoEm).getTime();
  return desde >= INTERNET.avisoAposDias * DIA && vigente(m, agora);
}

/** "Boa para videochamadas": só por esta regra (constante única) e só com medição válida. */
export function boaParaVideochamada(m: Rodada | null | undefined): boolean {
  const r = INTERNET.videochamada;
  return !!m && m.downloadMbps >= r.downloadMin && m.uploadMbps >= r.uploadMin && m.latenciaMs <= r.latenciaMax;
}

/** Medição do morador abaixo de 50% da do dono (download ou upload) → sinal no painel de qualidade. */
export function sinalMorador(dono: Rodada | null | undefined, morador: Rodada | null | undefined): boolean {
  if (!dono || !morador) return false;
  const f = INTERNET.fracaoSinalMorador;
  return morador.downloadMbps < dono.downloadMbps * f || morador.uploadMbps < dono.uploadMbps * f;
}

export function dentroDoLimite(medicoesHoje: number): boolean {
  return medicoesHoje < INTERNET.limitePorDia;
}

const mbps = (x: number) => (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString("pt-BR");
const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export type TextoInternet = { tipo: "medida" | "informada"; texto: string; videochamada: string | null } | null;

/**
 * O que a página do imóvel mostra:
 * - medição válida e vigente → o número medido, com a data e, se passar a regra, "Boa para videochamadas";
 * - só o informado pelo dono → "(não medida)", sem frase de capacidade;
 * - nada → nada.
 */
export function textoInternet(medida: Medicao | null | undefined, informadaMbps: number | null | undefined, agora: Date): TextoInternet {
  if (medida && vigente(medida, agora)) {
    return {
      tipo: "medida",
      texto: `Internet medida no imóvel: ${mbps(medida.downloadMbps)} Mbps para baixar · ${mbps(medida.uploadMbps)} para enviar · ${Math.round(medida.latenciaMs)} ms — medida em ${dataBR(medida.medidoEm)}`,
      videochamada: boaParaVideochamada(medida) ? TEXTO_VIDEOCHAMADA : null,
    };
  }
  if (informadaMbps && informadaMbps > 0) {
    return { tipo: "informada", texto: `Internet informada pelo proprietário: ${mbps(informadaMbps)} Mbps (não medida)`, videochamada: null };
  }
  return null;
}

/** Etiqueta "Para trabalhar de casa · internet medida": os 4 essenciais + medição válida que passa a regra. */
export function homeOfficeMedido(essenciais: boolean, medida: Medicao | null | undefined, agora: Date): boolean {
  return essenciais && !!medida && vigente(medida, agora) && boaParaVideochamada(medida);
}
