/*
  Provedor de rotas (Prompt 37) — UMA interface só, usada só no servidor (a coordenada exata do imóvel nunca sai dele).
   • Mapbox Matrix API para carro, a pé e bicicleta, com o token Mapbox que já existe (MAPBOX_TOKEN no servidor ou o
     NEXT_PUBLIC_MAPBOX_TOKEN). Até 25 coordenadas por chamada (1 destino + 24 imóveis).
   • Google Routes (computeRouteMatrix, TRANSIT) para ônibus, só com ROTAS_ONIBUS_ATIVO=1 E a GOOGLE_ROUTES_API_KEY.
     Par sem linha de ônibus volta null — "Ônibus" não mostra minuto inventado.
   • Laboratório (INTEGRACOES_SIMULADAS=on, nunca em produção): com LAB_ROTAS_URL as chamadas vão para o provedor
     falso (scripts/lab/rotas-falso.mjs), no MESMO formato da Matrix e do Routes; sem ela, nada sai para a rede.
   • Erro de rede/HTTP/tempo esgotado → ProvedorForaDoAr: quem chama cai para a linha reta e NÃO grava cache.
  Módulo sem "@/": testado por node --test com fetch e ambiente injetados.
*/
import { integracoesSimuladas } from "../integracoes.ts";
import type { Modo } from "../rotas/tempo.ts";
import { lotesMatrix, type Ponto } from "../rotas/selecao.ts";

export interface ResultadoRota {
  minutos: number;
  metros: number;
}

export interface ProvedorRotas {
  /** Meios de transporte que este provedor atende. */
  modos: Modo[];
  /** Tempo de cada origem (imóvel) até o destino, na ordem das origens. null = sem rota para aquele par. */
  calcular(destino: Ponto, origens: Ponto[], modo: Modo): Promise<(ResultadoRota | null)[]>;
}

export class ProvedorForaDoAr extends Error {
  constructor(detalhe: string) {
    super(`Provedor de rotas fora do ar: ${detalhe}`);
    this.name = "ProvedorForaDoAr";
  }
}

type Ambiente = Record<string, string | undefined>;
type Busca = typeof fetch;

export interface ConfiguracaoRotas {
  mapbox: { base: string; token: string } | null;
  google: { base: string; chave: string } | null;
}

/** Lê a configuração do ambiente. Sem token/chave, o meio correspondente fica desligado. */
export function configuracaoRotas(env: Ambiente = process.env, simulado: boolean = integracoesSimuladas()): ConfiguracaoRotas {
  const onibusLigado = env.ROTAS_ONIBUS_ATIVO === "1" || env.ROTAS_ONIBUS_ATIVO === "on";
  if (simulado) {
    // Laboratório: só o provedor falso local (nada sai para a rede).
    const lab = (env.LAB_ROTAS_URL ?? "").replace(/\/+$/, "");
    if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(lab)) return { mapbox: null, google: null };
    return { mapbox: { base: lab, token: "lab" }, google: onibusLigado ? { base: lab, chave: "lab" } : null };
  }
  const token = (env.MAPBOX_TOKEN || env.NEXT_PUBLIC_MAPBOX_TOKEN || "").trim();
  const chave = (env.GOOGLE_ROUTES_API_KEY || "").trim();
  return {
    mapbox: token ? { base: "https://api.mapbox.com", token } : null,
    google: onibusLigado && chave ? { base: "https://routes.googleapis.com", chave } : null,
  };
}

/** Meios de transporte com dado de verdade agora (o que a tela pode oferecer). */
export function modosDisponiveis(cfg: ConfiguracaoRotas = configuracaoRotas()): Modo[] {
  return [...(cfg.mapbox ? (["carro", "a_pe", "bicicleta"] as Modo[]) : []), ...(cfg.google ? (["onibus"] as Modo[]) : [])];
}

const PERFIL_MAPBOX: Partial<Record<Modo, string>> = { carro: "driving", a_pe: "walking", bicicleta: "cycling" };
const TEMPO_LIMITE_MS = 8000;

async function pedir(busca: Busca, url: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await busca(url, { ...init, signal: AbortSignal.timeout(TEMPO_LIMITE_MS), cache: "no-store" });
  } catch (e) {
    throw new ProvedorForaDoAr(e instanceof Error ? e.name : "rede");
  }
  if (!res.ok) throw new ProvedorForaDoAr(`HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new ProvedorForaDoAr("resposta inválida");
  }
}

const coord = (p: Ponto) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;

/** Mapbox Matrix: uma chamada por lote de 25 coordenadas ([destino, ...imóveis]); fontes = imóveis, alvo = destino. */
export function provedorMapbox(cfg: { base: string; token: string }, busca: Busca = fetch): ProvedorRotas {
  return {
    modos: ["carro", "a_pe", "bicicleta"],
    async calcular(destino, origens, modo) {
      const perfil = PERFIL_MAPBOX[modo];
      if (!perfil) return origens.map(() => null);
      const saida: (ResultadoRota | null)[] = [];
      for (const lote of lotesMatrix(destino, origens)) {
        const fontes = lote.imoveis.map((_, i) => i + 1).join(";");
        const url =
          `${cfg.base}/directions-matrix/v1/mapbox/${perfil}/${lote.coordenadas.map(coord).join(";")}` +
          `?sources=${fontes}&destinations=0&annotations=duration,distance&access_token=${encodeURIComponent(cfg.token)}`;
        const r = (await pedir(busca, url)) as { code?: string; durations?: (number | null)[][]; distances?: (number | null)[][] };
        if (r?.code !== "Ok" || !Array.isArray(r.durations)) throw new ProvedorForaDoAr(`código ${r?.code ?? "?"}`);
        lote.imoveis.forEach((_, i) => {
          const s = r.durations?.[i]?.[0];
          const m = r.distances?.[i]?.[0];
          saida.push(typeof s === "number" && Number.isFinite(s) ? { minutos: s / 60, metros: Math.round(typeof m === "number" ? m : 0) } : null);
        });
      }
      return saida;
    },
  };
}

/** Próximo dia útil às 07:30 de Brasília (10:30 UTC): ônibus no horário de ida ao trabalho. */
export function partidaOnibus(agora: Date = new Date()): string {
  const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 1, 10, 30));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/** Google Routes computeRouteMatrix (TRANSIT). Par sem rota de transporte público → null. */
export function provedorGoogleOnibus(cfg: { base: string; chave: string }, busca: Busca = fetch, agora: () => Date = () => new Date()): ProvedorRotas {
  return {
    modos: ["onibus"],
    async calcular(destino, origens, modo) {
      if (modo !== "onibus" || origens.length === 0) return origens.map(() => null);
      const saida: (ResultadoRota | null)[] = [];
      for (const lote of lotesMatrix(destino, origens)) {
        const ponto = (p: Ponto) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });
        const r = await pedir(busca, `${cfg.base}/distanceMatrix/v2:computeRouteMatrix`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": cfg.chave,
            "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition",
          },
          body: JSON.stringify({
            origins: lote.imoveis.map(ponto),
            destinations: [ponto(destino)],
            travelMode: "TRANSIT",
            transitPreferences: { allowedTravelModes: ["BUS"] },
            departureTime: partidaOnibus(agora()),
          }),
        });
        if (!Array.isArray(r)) throw new ProvedorForaDoAr("resposta sem a matriz");
        const porOrigem = new Map<number, ResultadoRota | null>();
        for (const el of r as { originIndex?: number; duration?: string; distanceMeters?: number; condition?: string }[]) {
          const s = Number(String(el.duration ?? "").replace(/s$/, ""));
          const ok = el.condition === "ROUTE_EXISTS" && Number.isFinite(s) && s > 0;
          porOrigem.set(el.originIndex ?? 0, ok ? { minutos: s / 60, metros: Math.round(el.distanceMeters ?? 0) } : null);
        }
        lote.imoveis.forEach((_, i) => saida.push(porOrigem.get(i) ?? null));
      }
      return saida;
    },
  };
}

/** O provedor do meio pedido, ou null (sem token/chave: a tela mostra a linha reta e não oferece o meio). */
export function provedorPara(modo: Modo, cfg: ConfiguracaoRotas = configuracaoRotas(), busca: Busca = fetch): ProvedorRotas | null {
  if (modo === "onibus") return cfg.google ? provedorGoogleOnibus(cfg.google, busca) : null;
  return cfg.mapbox ? provedorMapbox(cfg.mapbox, busca) : null;
}
