/*
  Página do imóvel completa (ordem d943f893).
  Roda: node --test src/lib/imovel-pagina.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoDoImovel, secoesDoImovel, sinaisDeConfianca, statusDisponibilidade } from "./imovel-pagina.ts";

test("abas na ordem de leitura; avaliações com contagem; sem dono, sem aba de dono", () => {
  assert.deepEqual(
    secoesDoImovel({ avaliacoes: 3, temDono: true }).map((s) => s.rotulo),
    ["Visão geral", "Comodidades", "Disponibilidade", "Localização", "Avaliações (3)", "Proprietário"]
  );
  const sem = secoesDoImovel({ avaliacoes: 0, temDono: false });
  assert.ok(sem.some((s) => s.rotulo === "Avaliações"));
  assert.ok(!sem.some((s) => s.id === "proprietario"));
});

test("status de disponibilidade: agora, futura, data inválida ou passada = agora", () => {
  assert.equal(statusDisponibilidade(undefined, "2026-10-15"), "Disponível agora");
  assert.equal(statusDisponibilidade("2026-10-01", "2026-10-15"), "Disponível agora");
  assert.equal(statusDisponibilidade("2026-11-12", "2026-10-15"), "Disponível a partir de 12/11");
  assert.equal(statusDisponibilidade("lixo", "2026-10-15"), "Disponível agora");
});

test("sinais de confiança só com dado real; código sempre", () => {
  const minimo = sinaisDeConfianca({ id: "3f9a2c1b-aaaa" }, "2026-10-15");
  assert.deepEqual(minimo.map((s) => s.tipo), ["disponibilidade", "codigo"]);
  assert.equal(minimo[1].texto, "Código VN-3F9A2C");
  const cheio = sinaisDeConfianca(
    { id: "x1", availableFrom: "2026-12-01", owner: { memberSince: "2025-03-10", responseRate: 96.4 } },
    "2026-10-15"
  );
  assert.deepEqual(cheio.map((s) => s.texto), [
    "Disponível a partir de 01/12",
    "Responde 96% das mensagens",
    "Anuncia aqui desde mar. 2025",
    "Código VN-X1",
  ]);
  assert.equal(codigoDoImovel("ab-cd"), "VN-ABCD");
});
