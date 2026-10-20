#!/usr/bin/env node
/*
  Provedor de rotas FALSO do laboratório (Prompt 37), no padrão do resend-falso.mjs. Nada sai para a rede: o site do
  laboratório, com INTEGRACOES_SIMULADAS=on e LAB_ROTAS_URL apontando para cá, pede os tempos neste servidor, que
  responde no formato da Mapbox Matrix API (e do Google Routes computeRouteMatrix, para o ônibus) com minutos
  DETERMINÍSTICOS a partir da distância em linha reta:
    carro 30 km/h · a pé 5 km/h · bicicleta 15 km/h · ônibus 20 km/h (sem linha acima de 15 km).
  Ex.: 5 km de carro = 10 min; 8 km = 16 min (a tela mostra "~20 min").

  Controle (só para os testes):
    GET  /__chamadas   → { total, matrix, onibus, elementos } — o E2E prova o cache (a 2ª busca não chama)
    POST /__fora       → { fora: true|false } simula o provedor fora do ar (responde 503)
    POST /__limpar     → zera as contagens e volta a ficar no ar

  Uso: node scripts/lab/rotas-falso.mjs [porta]   (padrão 3998; só escuta em 127.0.0.1)
*/
import { createServer } from "node:http";

const porta = Number(process.argv[2] ?? process.env.LAB_ROTAS_PORTA ?? 3998);
const VELOCIDADE = { driving: 30, walking: 5, cycling: 15 };
const VELOCIDADE_ONIBUS = 20;
const ONIBUS_MAX_KM = 15;
let contagem = { total: 0, matrix: 0, onibus: 0, elementos: 0 };
let fora = false;

const json = (res, status, corpo) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(corpo));
};

function km(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function matrix(res, url) {
  // /directions-matrix/v1/mapbox/{perfil}/{lng,lat;lng,lat...}
  const partes = url.pathname.split("/");
  const perfil = partes[4];
  const coords = decodeURIComponent(partes.slice(5).join("/"))
    .split(";")
    .map((c) => c.split(",").map(Number))
    .map(([lng, lat]) => ({ lat, lng }));
  if (!VELOCIDADE[perfil]) return json(res, 422, { code: "ProfileNotFound", message: "Profile not found" });
  if (!url.searchParams.get("access_token")) return json(res, 401, { message: "Not Authorized - No Token" });
  if (coords.length < 2 || coords.length > 25 || coords.some((c) => !Number.isFinite(c.lat) || !Number.isFinite(c.lng)))
    return json(res, 422, { code: "InvalidInput", message: "Too many coordinates; maximum number of coordinates is 25." });
  const idx = (k, padrao) => (url.searchParams.get(k) ? url.searchParams.get(k).split(";").map(Number) : padrao);
  const fontes = idx("sources", coords.map((_, i) => i));
  const destinos = idx("destinations", coords.map((_, i) => i));
  contagem.total += 1;
  contagem.matrix += 1;
  contagem.elementos += fontes.length * destinos.length;
  const durations = fontes.map((s) => destinos.map((d) => Math.round((km(coords[s], coords[d]) / VELOCIDADE[perfil]) * 3600)));
  const distances = fontes.map((s) => destinos.map((d) => Math.round(km(coords[s], coords[d]) * 1000)));
  return json(res, 200, { code: "Ok", durations, distances, sources: fontes.map((i) => ({ location: [coords[i].lng, coords[i].lat] })), destinations: destinos.map((i) => ({ location: [coords[i].lng, coords[i].lat] })) });
}

function onibus(res, req, corpo) {
  if (!req.headers["x-goog-api-key"]) return json(res, 403, { error: { code: 403, message: "The request is missing a valid API key." } });
  let b;
  try {
    b = JSON.parse(corpo);
  } catch {
    return json(res, 400, { error: { code: 400, message: "Invalid JSON payload" } });
  }
  const p = (w) => ({ lat: w?.waypoint?.location?.latLng?.latitude, lng: w?.waypoint?.location?.latLng?.longitude });
  const origens = (b.origins ?? []).map(p);
  const destinos = (b.destinations ?? []).map(p);
  contagem.total += 1;
  contagem.onibus += 1;
  contagem.elementos += origens.length * destinos.length;
  const saida = [];
  origens.forEach((o, oi) =>
    destinos.forEach((d, di) => {
      const dist = km(o, d);
      saida.push(
        dist <= ONIBUS_MAX_KM
          ? { originIndex: oi, destinationIndex: di, duration: `${Math.round((dist / VELOCIDADE_ONIBUS) * 3600)}s`, distanceMeters: Math.round(dist * 1000), condition: "ROUTE_EXISTS" }
          : { originIndex: oi, destinationIndex: di, condition: "ROUTE_NOT_FOUND" }
      );
    })
  );
  return json(res, 200, saida);
}

createServer((req, res) => {
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/__chamadas") return json(res, 200, { ...contagem, fora });
    if (req.method === "POST" && url.pathname === "/__limpar") {
      contagem = { total: 0, matrix: 0, onibus: 0, elementos: 0 };
      fora = false;
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/__fora") {
      fora = JSON.parse(corpo || "{}").fora !== false;
      return json(res, 200, { ok: true, fora });
    }
    if (fora) return json(res, 503, { message: "Service Unavailable (simulado)" });
    if (req.method === "GET" && url.pathname.startsWith("/directions-matrix/v1/mapbox/")) return matrix(res, url);
    if (req.method === "POST" && url.pathname === "/distanceMatrix/v2:computeRouteMatrix") return onibus(res, req, corpo);
    return json(res, 404, { message: "Not Found" });
  });
}).listen(porta, "127.0.0.1", () => console.log(`[rotas-falso] ouvindo em http://127.0.0.1:${porta}`));
