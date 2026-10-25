import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  destinosDoBloco,
  faltaParaRotas,
  chaveDestino,
  comArtigo,
  dentroDoTempo,
  emLotes,
  escolherCandidatos,
  faixaMinutos,
  metrosEntre,
  minutosArredondados,
  pontoDaUrl,
  pontoParaUrl,
  rotuloLimpo,
  rotuloReta,
  rotuloTempo,
} from "./tempo.ts";

test("rotuloTempo: múltiplos de 5 para cima; abaixo de 5, 'menos de 5 min'", () => {
  assert.equal(rotuloTempo({ minutos: 12.2, modo: "carro", destinoRotulo: comArtigo("HC-UFU", "o") }), "~15 min de carro até o HC-UFU");
  assert.equal(rotuloTempo({ minutos: 15, modo: "carro", destinoRotulo: "o HC-UFU" }), "~15 min de carro até o HC-UFU");
  assert.equal(rotuloTempo({ minutos: 15.1, modo: "a_pe" }), "~20 min a pé");
  assert.equal(rotuloTempo({ minutos: 4.9, modo: "bicicleta", destinoRotulo: "a UFU — Campus Umuarama" }), "menos de 5 min de bicicleta até a UFU — Campus Umuarama");
  assert.equal(rotuloTempo({ minutos: 41, modo: "onibus" }), "~45 min de ônibus");
  assert.equal(minutosArredondados(5), 5);
  assert.equal(minutosArredondados(0), null);
});

test("linha reta: dita como tal, nunca como minutos", () => {
  assert.equal(rotuloReta(3210), "≈ 3,2 km em linha reta");
  assert.equal(rotuloReta(760, "o HC-UFU"), "≈ 800 m em linha reta até o HC-UFU");
  assert.doesNotMatch(rotuloReta(12000), /min/);
});

test("faixas de minutos e filtro 'até' pelo tempo que a pessoa vê", () => {
  assert.deepEqual([10, 11, 20, 30, 31, null].map(faixaMinutos), [0, 1, 1, 2, 3, 4]);
  assert.equal(dentroDoTempo(19.5, 20), true);
  assert.equal(dentroDoTempo(20.5, 20), false, "aparece como ~25 min: fora do 'até 20'");
  assert.equal(dentroDoTempo(3, 10), true);
});

test("só os 40 mais próximos em linha reta vão à Matrix", () => {
  const destino = { lat: -18.88, lng: -48.26 };
  const itens = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, lat: -18.88 - i * 0.001, lng: -48.26 }));
  const embaralhados = [...itens].reverse();
  const c = escolherCandidatos(embaralhados, destino);
  assert.equal(c.length, 40);
  assert.deepEqual(c.map((x) => x.id), itens.slice(0, 40).map((x) => x.id));
});

test("lotes de 25 coordenadas por chamada (1 destino + 24 imóveis)", () => {
  const lotes = emLotes(Array.from({ length: 50 }, (_, i) => i));
  assert.deepEqual(lotes.map((l) => l.length), [24, 24, 2]);
  assert.ok(lotes.every((l) => l.length + 1 <= 25));
  assert.deepEqual(emLotes([]), []);
});

test("URL: ponto com no máximo 3 casas (E94, ~110 m, como em destinos_pessoais)", () => {
  assert.deepEqual(pontoParaUrl({ lat: -18.918734, lng: -48.259876 }), { dlat: "-18.919", dlng: "-48.260" });
  assert.deepEqual(pontoDaUrl("-18.918734", "-48.259876"), { lat: -18.919, lng: -48.26 });
  assert.equal(pontoDaUrl("abc", "1"), null);
  assert.equal(pontoDaUrl("95", "1"), null);
  for (const p of [pontoDaUrl("-18.91876", "-48.25981")!, pontoDaUrl("-18.9", "-48.26")!]) {
    assert.ok((String(p.lat).split(".")[1]?.length ?? 0) <= 3);
    assert.ok((String(p.lng).split(".")[1]?.length ?? 0) <= 3);
  }
});

test("E94: um local a ~1,2 km do imóvel fica a ~1,2 km (com 2 casas, o ponto andava até ~700 m)", () => {
  const imovel = { lat: -18.915, lng: -48.275 };
  const local = { lat: -18.9074, lng: -48.267 };
  const real = metrosEntre(imovel, local);
  assert.ok(real > 1150 && real < 1250, `real ${real}`);
  const naUrl = pontoDaUrl(pontoParaUrl(local).dlat, pontoParaUrl(local).dlng)!;
  assert.ok(Math.abs(metrosEntre(imovel, naUrl) - real) < 110, "3 casas: no máximo ~110 m de diferença");
  // O arredondamento antigo (2 casas) punha o local a ~770 m — a diferença que o coordenador achou.
  const antigo = { lat: Math.round(local.lat * 100) / 100, lng: Math.round(local.lng * 100) / 100 };
  assert.ok(metrosEntre(imovel, antigo) < 900);
  // O tempo (rotas e cache) usa o mesmo ponto de 3 casas.
  assert.equal(chaveDestino(naUrl), "p:-18.907,-48.267");
});

test("E94: rótulo sem número da casa nem CEP e sem pontuação pendurada (6 formatos)", () => {
  assert.equal(rotuloLimpo("Av. João Naves de Ávila, 1331 — Santa Mônica, Uberlândia"), "Av. João Naves de Ávila — Santa Mônica");
  assert.equal(rotuloLimpo("Av. João Naves de Ávila, Santa Mônica"), "Av. João Naves de Ávila, Santa Mônica");
  assert.equal(rotuloLimpo("Rua Tito Teixeira nº 45, Santa Mônica"), "Rua Tito Teixeira, Santa Mônica");
  assert.equal(rotuloLimpo("Av. Pará, 1720 - Umuarama, Uberlândia - MG, 38405-320, Brasil"), "Av. Pará — Umuarama");
  assert.equal(rotuloLimpo("— Rua Goiás, , Centro —"), "Rua Goiás, Centro");
  assert.equal(rotuloLimpo("Cargill"), "Cargill");
  // Nada de separador sobrando, nem número de casa, nem CEP.
  for (const t of ["Rua 10, 233, Centro", "Av. Rondon Pacheco, 4600 -", ", 38400-000, Uberlândia", "Rua Sete-de-Setembro 50 — Centro"]) {
    const r = rotuloLimpo(t);
    assert.doesNotMatch(r, /^[\s,—–-]|[\s,—–-]$|,\s*,|—\s*—|\b(233|4600|38400|50)\b/, `${t} → ${r}`);
  }
  assert.equal(rotuloLimpo("Rua Sete-de-Setembro 50 — Centro"), "Rua Sete-de-Setembro — Centro");
});

test("chave do cache: id do destino ou ponto a 3 casas", () => {
  assert.equal(chaveDestino({ destinoId: "abc" }), "d:abc");
  assert.equal(chaveDestino({ lat: -18.91874, lng: -48.25999 }), "p:-18.919,-48.260");
});

test("GUARDA: o módulo de tempo é puro (nada de rede, banco ou window)", () => {
  const src = readFileSync(new URL("./tempo.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /fetch\(|supabase|window\.|process\.env/);
});

test("sem token ou com o provedor fora, não há minutos: cai para a linha reta", async () => {
  const { provedorNoAmbiente } = await import("./tempo.ts");
  assert.equal(provedorNoAmbiente({}, "carro", false), false);
  assert.equal(provedorNoAmbiente({ NEXT_PUBLIC_MAPBOX_TOKEN: "pk.x" }, "carro", false), true);
  assert.equal(provedorNoAmbiente({ NEXT_PUBLIC_MAPBOX_TOKEN: "pk.x" }, "onibus", false), false, "ônibus só com a chave ligada");
  assert.equal(provedorNoAmbiente({ ROTAS_ONIBUS_ATIVO: "on" }, "onibus", false), false, "e com a chave do Google");
  assert.equal(provedorNoAmbiente({ ROTAS_ONIBUS_ATIVO: "on", GOOGLE_ROUTES_API_KEY: "k" }, "onibus", false), true);
  assert.equal(provedorNoAmbiente({ NEXT_PUBLIC_MAPBOX_TOKEN: "pk.x" }, "carro", true), false, "no laboratório nada sai para a rede");
  assert.equal(provedorNoAmbiente({ LAB_ROTAS_URL: "http://127.0.0.1:3998" }, "a_pe", true), true);
  // O dado: sem provedor, o servidor usa rotuloReta — que nunca fala em minutos.
  const src = readFileSync(new URL("../data/tempos.ts", import.meta.url), "utf8");
  assert.match(src, /rotuloReta\(/);
  assert.match(src, /if \(faltam\.length === 0 \|\| !provedorDisponivel\(modo\)\) return 0;/);
});

test("PRIVACIDADE: as rotas de tempo nunca devolvem coordenada nem metros", () => {
  for (const rota of ["../../app/api/tempos/route.ts", "../../app/api/tempos/imovel/[id]/route.ts"]) {
    const src = readFileSync(new URL(rota, import.meta.url), "utf8");
    const respostas = [...src.matchAll(/NextResponse\.json\(([\s\S]*?)\{ (?:status|headers)/g)].map((m) => m[1]).join("\n");
    assert.ok(respostas.length > 0, rota);
    assert.doesNotMatch(respostas, /\b(lat|lng|lat_exata|lng_exata|metros|ponto)\b/, `${rota} devolve só textos arredondados`);
  }
  const dados = readFileSync(new URL("../data/tempos.ts", import.meta.url), "utf8");
  const tela = dados.slice(dados.indexOf("export interface TempoNaTela"), dados.indexOf("export async function destinosAtivos"));
  assert.doesNotMatch(tela, /\b(lat|lng|metros)\b/, "TempoNaTela não carrega coordenada nem metros");
  // A linha reta da tela é medida sobre o ponto público (aproximado), nunca o exato.
  assert.match(dados, /rotuloReta\(metrosEntre\(\{ lat: Number\(p\.lat\), lng: Number\(p\.lng\) \}/);
});

test("E31: sem token do Mapbox, o admin vê o nome da variável que falta (nunca o valor)", () => {
  assert.deepEqual(faltaParaRotas({}, false), ["MAPBOX_SERVER_TOKEN"]);
  assert.deepEqual(faltaParaRotas({ MAPBOX_SERVER_TOKEN: "x" }, false), []);
  assert.deepEqual(faltaParaRotas({ NEXT_PUBLIC_MAPBOX_TOKEN: "x" }, false), []);
  assert.deepEqual(faltaParaRotas({}, true), ["LAB_ROTAS_URL"]);
});

test("E31: 'Tempo até' do anúncio = todos os destinos ativos da cidade do anúncio, do mais perto ao mais longe", () => {
  const udi = { lat: -18.918, lng: -48.259 };
  const d = (slug: string, cidade: string, lat: number, lng: number, uf = "MG") => ({ id: slug, slug, cidade, uf, lat, lng });
  const destinos = [
    d("ufu-campus-pontal", "Ituiutaba", -18.97, -49.46),
    d("ufu-umuarama", "Uberlândia", -18.885, -48.26),
    d("hc-ufu", "Uberlândia", -18.886, -48.256),
    d("ufu-santa-monica", "Uberlandia", -18.918, -48.258),
  ];
  const r = destinosDoBloco({ cidade: "Uberlândia", uf: "MG", ponto: udi }, destinos).map((x) => x.slug);
  assert.deepEqual(r, ["ufu-santa-monica", "hc-ufu", "ufu-umuarama"], "os 3 de Uberlândia (com e sem acento); o Pontal (Ituiutaba) fica fora");
  // Mesma cidade, outra UF, não entra; o destino da busca vem à parte e sai daqui.
  assert.deepEqual(destinosDoBloco({ cidade: "Uberlândia", uf: "MG", ponto: udi }, [...destinos, d("x", "Uberlândia", -18.9, -48.2, "SP")], "hc-ufu").map((x) => x.slug), ["ufu-santa-monica", "ufu-umuarama"]);
  assert.deepEqual(destinosDoBloco({ cidade: null, uf: "MG", ponto: udi }, destinos), []);
  // Todos os ativos da cidade entram até o teto (antes eram só os 3 mais próximos, de qualquer cidade).
  const muitos = Array.from({ length: 9 }, (_, i) => d(`u${i}`, "Uberlândia", -18.9 - i / 100, -48.26));
  assert.equal(destinosDoBloco({ cidade: "Uberlândia", uf: "MG", ponto: udi }, muitos).length, 6);
  const rota = readFileSync("src/app/api/tempos/imovel/[id]/route.ts", "utf8");
  assert.match(rota, /destinosDoBloco\(/);
  assert.doesNotMatch(rota, /\.slice\(0, 3\)/);
});
