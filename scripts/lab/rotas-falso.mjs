#!/usr/bin/env node
/*
  Provedor de rotas FALSO do laboratório (prompt 37). Nada sai para a rede: o site do laboratório, com
  INTEGRACOES_SIMULADAS=on e LAB_ROTAS_URL apontando para cá, pede os tempos aqui no formato dos provedores reais:
    GET  /directions-matrix/v1/mapbox/{driving|walking|cycling}/{lng,lat;...}?sources=1;2&destinations=0  (Mapbox Matrix)
    POST /distanceMatrix/v2:computeRouteMatrix  { origins, destinations, travelMode: "TRANSIT" }           (Google Routes)
  Os tempos são DETERMINÍSTICOS pela distância em linha reta (fator de desvio × velocidade do meio), para o teste saber
  de antemão quem fica dentro do "até N min". Carro: 1,3 × d a 25 km/h (até 20 min ≈ 6,4 km em linha reta).

  Controle (só para os testes):
    GET  /__chamadas   → as chamadas recebidas ({ provedor, perfil, origens })
    POST /__falhas     → { vezes } programa as próximas respostas 503 (provedor fora)
    POST /__limpar     → zera chamadas e falhas

  Uso: node scripts/lab/rotas-falso.mjs [porta]   (padrão 3998; só escuta em 127.0.0.1)
*/
import { createServer } from "node:http";

const porta = Number(process.argv[2] ?? process.env.LAB_ROTAS_PORTA ?? 3998);
let chamadas = [];
let falhas = 0;

const M_POR_MIN = { driving: 25000 / 60, walking: 80, cycling: 250, transit: 250 };
const DESVIO = { driving: 1.3, walking: 1.2, cycling: 1.25, transit: 1.4 };

function metros(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const tempo = (perfil, d) => ({ seg: Math.round(((DESVIO[perfil] * d) / M_POR_MIN[perfil]) * 60 + (perfil === "transit" ? 480 : 0)), m: Math.round(DESVIO[perfil] * d) });

const json = (res, status, corpo) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(corpo));
};

createServer((req, res) => {
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/__chamadas") return json(res, 200, chamadas);
    if (req.method === "POST" && url.pathname === "/__limpar") {
      chamadas = [];
      falhas = 0;
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/__falhas") {
      falhas = Number(JSON.parse(corpo || "{}").vezes ?? 1);
      return json(res, 200, { ok: true, falhas });
    }

    const mapbox = url.pathname.match(/^\/directions-matrix\/v1\/mapbox\/(driving|walking|cycling)\/(.+)$/);
    const google = req.method === "POST" && url.pathname === "/distanceMatrix/v2:computeRouteMatrix";
    if (!mapbox && !google) return json(res, 404, { message: "Not Found" });
    if (falhas > 0) {
      falhas -= 1;
      return json(res, 503, { message: "Service Unavailable (falha programada)" });
    }

    if (mapbox) {
      const [, perfil, lista] = mapbox;
      const pts = decodeURIComponent(lista).split(";").map((p) => {
        const [lng, lat] = p.split(",").map(Number);
        return { lat, lng };
      });
      if (pts.length > 25) return json(res, 422, { code: "InvalidInput", message: "Too many coordinates; maximum number of coordinates is 25." });
      const fontes = (url.searchParams.get("sources") ?? "").split(";").filter(Boolean).map(Number);
      const destino = pts[Number(url.searchParams.get("destinations") ?? 0)];
      chamadas.push({ provedor: "mapbox", perfil, origens: fontes.length });
      const t = fontes.map((i) => tempo(perfil, metros(pts[i], destino)));
      return json(res, 200, { code: "Ok", durations: t.map((x) => [x.seg]), distances: t.map((x) => [x.m]) });
    }

    const b = JSON.parse(corpo || "{}");
    const lat = (w) => ({ lat: w.waypoint.location.latLng.latitude, lng: w.waypoint.location.latLng.longitude });
    const destino = lat(b.destinations[0]);
    chamadas.push({ provedor: "google", perfil: "transit", origens: b.origins.length });
    return json(
      res,
      200,
      b.origins.map((o, i) => {
        const t = tempo("transit", metros(lat(o), destino));
        // Longe demais (> 15 km em linha reta): "sem linha", como o Google responde quando não há transporte público.
        return t.m > 21000
          ? { originIndex: i, destinationIndex: 0, condition: "ROUTE_NOT_FOUND" }
          : { originIndex: i, destinationIndex: 0, condition: "ROUTE_EXISTS", duration: `${t.seg}s`, distanceMeters: t.m };
      }),
    );
  });
}).listen(porta, "127.0.0.1", () => console.log(`rotas-falso em http://127.0.0.1:${porta}`));
