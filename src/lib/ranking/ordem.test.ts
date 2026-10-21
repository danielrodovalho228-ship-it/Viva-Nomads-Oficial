import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destaquesHome, notaQualidade, ordenarBusca, selosDoAnuncio, type SinaisAnuncio } from "./ordem.ts";

const AGORA = new Date("2026-11-01T12:00:00Z");
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * 86_400_000).toISOString();

const base = (o: Partial<SinaisAnuncio> = {}): SinaisAnuncio => ({
  id: "a",
  donoId: "d1",
  ehExemplo: false,
  ehTeste: false,
  fotosTotal: 15,
  comodosDistintos: 6,
  fotosDeParceiro: false,
  descricaoPalavras: 80,
  regrasCompletas: true,
  enderecoExato: true,
  calendarioConfirmadoEm: diasAtras(3),
  identidadeConfirmada: true,
  matriculaConferida: true,
  conversas: 10,
  conversasRespondidas: 10,
  respostaMediaMin: 60,
  avaliacoesQtd: 5,
  avaliacoesMedia: 4.8,
  cancelamentosDono12m: 0,
  precoJusto: false,
  ...o,
});

test("compatibilidade vem antes da nota: anúncio perfeito 'fora' nunca passa um mediano 'exata'", () => {
  const otimo = base({ id: "otimo", fotosDeParceiro: true, precoJusto: true });
  const mediano = base({ id: "mediano", comodosDistintos: 2, identidadeConfirmada: false, matriculaConferida: false });
  const r = ordenarBusca([{ sinais: otimo, compat: "fora", distanciaKm: null }, { sinais: mediano, compat: "exata", distanciaKm: null }], AGORA);
  assert.deepEqual(r.map((x) => x.id), ["mediano", "otimo"]);
});

test("20 fotos do mesmo cômodo não valem como 6 cômodos", () => {
  const umComodo = notaQualidade(base({ fotosTotal: 20, comodosDistintos: 1 }), AGORA).nota;
  const seisComodos = notaQualidade(base({ fotosTotal: 8, comodosDistintos: 6 }), AGORA).nota;
  assert.ok(seisComodos - umComodo >= 10, `${seisComodos} vs ${umComodo}`);
});

test("calendário: ≤14 dias vale mais que 15–30, que vale mais que >30", () => {
  const n = (d: number) => notaQualidade(base({ calendarioConfirmadoEm: diasAtras(d) }), AGORA).nota;
  assert.ok(n(5) > n(20) && n(20) > n(45));
});

test("anúncio novo e bom não é punido por não ter avaliação (neutro)", () => {
  const novo = notaQualidade(base({ avaliacoesQtd: 0, avaliacoesMedia: null, conversas: 0, conversasRespondidas: 0, respostaMediaMin: null }), AGORA).nota;
  const ruimAvaliado = notaQualidade(base({ avaliacoesQtd: 10, avaliacoesMedia: 3.0 }), AGORA).nota;
  assert.ok(novo > ruimAvaliado);
  assert.ok(novo >= 70, `novo bom precisa poder ir à home: ${novo}`);
});

test("cancelamento pelo dono tira pontos", () => {
  assert.ok(notaQualidade(base({ cancelamentosDono12m: 1 }), AGORA).nota < notaQualidade(base(), AGORA).nota);
});

test("nota fica entre 0 e 100 e os motivos explicam a soma", () => {
  for (const s of [base(), base({ comodosDistintos: 0, identidadeConfirmada: false, matriculaConferida: false, cancelamentosDono12m: 9 })]) {
    const q = notaQualidade(s, AGORA);
    assert.ok(q.nota >= 0 && q.nota <= 100);
    const soma = Math.max(0, Math.min(100, Math.round(q.motivos.reduce((t, m) => t + m.pontos, 0))));
    assert.equal(q.nota, soma);
  }
});

test("selos com motivo: verificado exige identidade E matrícula; responde rápido exige 3+ conversas", () => {
  assert.ok(selosDoAnuncio(base()).some((s) => s.codigo === "proprietario_verificado" && s.motivo.length > 10));
  assert.ok(!selosDoAnuncio(base({ matriculaConferida: false })).some((s) => s.codigo === "proprietario_verificado"));
  assert.ok(!selosDoAnuncio(base({ conversas: 2, conversasRespondidas: 2 })).some((s) => s.codigo === "responde_rapido"));
  assert.ok(selosDoAnuncio(base()).find((s) => s.codigo === "responde_rapido")!.motivo.includes("100%"));
});

test("busca pública: teste nunca aparece; exemplo some quando há anúncio real", () => {
  const r = ordenarBusca(
    [
      { sinais: base({ id: "real" }), compat: "exata", distanciaKm: null },
      { sinais: base({ id: "teste", ehTeste: true }), compat: "exata", distanciaKm: null },
      { sinais: base({ id: "exemplo", ehExemplo: true }), compat: "exata", distanciaKm: null },
    ],
    AGORA,
  );
  assert.deepEqual(r.map((x) => x.id), ["real"]);
});

test("home: no máximo 1 por dono, nunca exemplo nem teste, só nota ≥ 70 e calendário ≤ 30 dias", () => {
  const gestor = Array.from({ length: 15 }, (_, i) => base({ id: `g${String(i).padStart(2, "0")}`, donoId: "gestor" }));
  const outros = [
    base({ id: "o1", donoId: "d2" }),
    base({ id: "o2", donoId: "d3", calendarioConfirmadoEm: diasAtras(60) }),
    base({ id: "o3", donoId: "d4", comodosDistintos: 0, identidadeConfirmada: false, matriculaConferida: false }),
    base({ id: "ex", donoId: "d5", ehExemplo: true }),
    base({ id: "tt", donoId: "d6", ehTeste: true }),
  ];
  for (let dia = 0; dia < 30; dia++) {
    const h = destaquesHome([...gestor, ...outros], 4, AGORA, 20261101 + dia);
    const donos = h.map((x) => [...gestor, ...outros].find((s) => s.id === x.id)!.donoId);
    assert.equal(new Set(donos).size, donos.length, "1 por dono");
    assert.ok(!h.some((x) => ["ex", "tt", "o2", "o3"].includes(x.id)));
    assert.ok(h.every((x) => x.nota >= 70));
  }
});

test("home: rodízio é reprodutível pela semente e varia entre dias", () => {
  const todos = Array.from({ length: 12 }, (_, i) => base({ id: `p${i}`, donoId: `d${i}` }));
  assert.deepEqual(destaquesHome(todos, 4, AGORA, 1), destaquesHome(todos, 4, AGORA, 1));
  const conjuntos = new Set(Array.from({ length: 10 }, (_, d) => destaquesHome(todos, 4, AGORA, d).map((x) => x.id).sort().join(",")));
  assert.ok(conjuntos.size > 1, "o rodízio precisa mudar a vitrine");
});

test("GUARDA: pagamento, plano ou assinatura nunca mudam a ordem", () => {
  const a = base({ id: "a", donoId: "d1" });
  const b = base({ id: "b", donoId: "d2", comodosDistintos: 3 });
  const semExtras = ordenarBusca([{ sinais: a, compat: "exata", distanciaKm: null }, { sinais: b, compat: "exata", distanciaKm: null }], AGORA);
  const comExtras = ordenarBusca(
    [
      { sinais: { ...a, plano: "free" } as SinaisAnuncio, compat: "exata", distanciaKm: null },
      { sinais: { ...b, plano: "gestor", pagouDestaque: true, assinaturaAtiva: true, taxaPercent: 0.06 } as SinaisAnuncio, compat: "exata", distanciaKm: null },
    ],
    AGORA,
  );
  assert.deepEqual(comExtras.map((x) => x.id), semExtras.map((x) => x.id));
  // Estático: a regra não lê nenhum campo de dinheiro/plano.
  const fonte = readFileSync(new URL("./ordem.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "") // tira comentários de bloco
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // tira comentários de linha (preserva "https://")
  assert.doesNotMatch(fonte, /plano|pago|pagou|pagamento|assinatura|cobranca|cobrança|taxa|comiss|gestor|stripe|patrocin/i);
});
