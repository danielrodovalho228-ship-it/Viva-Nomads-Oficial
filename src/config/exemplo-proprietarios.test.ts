/* Roda: node --test src/config/exemplo-proprietarios.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { achadosNoTexto } from "../lib/varredura-texto.ts";
import {
  IMOVEIS_COM_AVALIACAO_EXEMPLO,
  PROPRIETARIOS_EXEMPLO,
  avaliacoesDoExemplo,
  avaliacoesDoProprietarioExemplo,
  proprietarioDoExemplo,
  proprietarioExemploPorId,
  respostaExemploLabel,
  resumoAvaliacoesExemplo,
  tempoNaVivaLabel,
} from "./exemplo-proprietarios.ts";

const REAL = "3f1c2b9a-6d1e-4f7a-9b2c-1a2b3c4d5e6f";

test("anúncio REAL nunca recebe proprietário nem avaliação de exemplo", () => {
  assert.equal(proprietarioDoExemplo(REAL), null);
  assert.deepEqual(avaliacoesDoExemplo(REAL), []);
  assert.equal(resumoAvaliacoesExemplo(REAL), null);
  assert.equal(proprietarioExemploPorId(REAL), null);
});

test("os 15 anúncios de exemplo têm um proprietário de exemplo e 2 a 3 avaliações", () => {
  for (let i = 1; i <= 15; i++) {
    const id = `ube-${String(i).padStart(3, "0")}`;
    assert.ok(proprietarioDoExemplo(id), id);
    const n = avaliacoesDoExemplo(id).length;
    assert.ok(n >= 2 && n <= 3, `${id}: ${n}`);
    assert.ok(avaliacoesDoExemplo(id).some((a) => a.resposta), `${id} sem resposta do proprietário`);
  }
  assert.equal(IMOVEIS_COM_AVALIACAO_EXEMPLO.length, 15);
  // Cada anúncio pertence a um só proprietário.
  const todos = PROPRIETARIOS_EXEMPLO.flatMap((p) => p.imoveis);
  assert.equal(new Set(todos).size, todos.length);
});

test("proprietário de exemplo é sempre marcado e só usa iniciais (sem foto)", () => {
  for (const p of PROPRIETARIOS_EXEMPLO) {
    assert.match(p.nome, /^\p{Lu}\p{L}+ \p{Lu}\. \(exemplo\)$/u);
    assert.match(p.id, /^exemplo-[123]$/);
    assert.ok(!("foto" in p));
    assert.ok(p.bio.length <= 280);
    assert.equal(proprietarioExemploPorId(p.id), p);
  }
});

test("vocabulário das avaliações e bios ilustrativas (sem aluguel, temporada, vistoria…)", () => {
  const textos = [
    ...PROPRIETARIOS_EXEMPLO.map((p) => p.bio),
    ...PROPRIETARIOS_EXEMPLO.flatMap((p) => avaliacoesDoProprietarioExemplo(p).flatMap((a) => [a.titulo, a.texto, a.resposta ?? ""])),
  ];
  for (const t of textos) {
    assert.deepEqual(achadosNoTexto(t, { vocabulario: true, termos: true, leis: true }), [], t);
    assert.doesNotMatch(t, /aluguel|temporada|vistoria|apartamento|garantia|comiss[ãa]o/i, t);
  }
  for (const p of PROPRIETARIOS_EXEMPLO)
    for (const a of avaliacoesDoProprietarioExemplo(p)) {
      assert.ok(a.nota >= 1 && a.nota <= 5);
      assert.match(a.autor, /^\p{Lu}\p{L}+ \p{Lu}\.$/u);
      assert.ok(a.texto.length <= 500);
    }
});

test("rótulos: resposta, tempo na Viva e média", () => {
  assert.equal(respostaExemploLabel(8), "Costuma responder em até 8 horas");
  assert.equal(respostaExemploLabel(1), "Costuma responder em até 1 hora");
  assert.equal(tempoNaVivaLabel("2025-03", "2025-10-17"), "Na Viva há 7 meses");
  assert.equal(tempoNaVivaLabel("2025-10", "2025-10-17"), "Na Viva há 1 mês");
  assert.equal(tempoNaVivaLabel("2024-11", "2026-10-17"), "Na Viva há 1 ano e 11 meses");
  assert.equal(tempoNaVivaLabel("2024-10", "2026-10-17"), "Na Viva há 2 anos");
  const r = resumoAvaliacoesExemplo("ube-001")!;
  assert.deepEqual(r, { media: 4.7, n: 3 });
});
