/**
 * E466 (PC10): (i) o mini-calendário da Agenda do parceiro era estático — sem mês anterior/próximo e com dias que não
 * respondiam ao toque; agora navega por mês e o dia clicado filtra os horários (com "Ver todos"). (ii) a galeria da
 * página pública do parceiro não ampliava as fotos; agora cada foto abre a visualização em tela cheia (a mesma da
 * galeria do imóvel: setas, contador, Esc, deslizar no celular). `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { itensDaAgenda, moverMesGrade } from "./agenda-parceiro.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("navegação de mês (0–11) atravessa o ano", () => {
  assert.deepEqual(moverMesGrade({ ano: 2026, mes: 11 }, 1), { ano: 2027, mes: 0 });
  assert.deepEqual(moverMesGrade({ ano: 2027, mes: 0 }, -1), { ano: 2026, mes: 11 });
  assert.deepEqual(moverMesGrade({ ano: 2026, mes: 5 }, 0), { ano: 2026, mes: 5 });
});

test("o dia escolhido filtra os horários; sem dia, todos", () => {
  const itens = [
    { id: "a", dia: "2026-11-10", quando: "10/11 09:00", categoria: "Limpeza" },
    { id: "b", dia: "2026-11-12", quando: "12/11 14:00", categoria: "Limpeza" },
  ];
  assert.deepEqual(itensDaAgenda(itens, "2026-11-12").map((i) => i.id), ["b"]);
  assert.deepEqual(itensDaAgenda(itens, null).map((i) => i.id), ["a", "b"]);
  assert.deepEqual(itensDaAgenda(itens, "2026-11-11"), []);
});

test("(i) a Agenda usa o calendário com navegação e dias clicáveis", () => {
  const ag = ler("components/parceiros/agenda-calendario.tsx");
  assert.match(ag, /aria-label="Mês anterior"/);
  assert.match(ag, /aria-label="Próximo mês"/);
  assert.match(ag, /onDia=\{\(iso\) => setDia\(\(d\) => \(d === iso \? null : iso\)\)\}/);
  assert.match(ler("components/parceiros/pedidos-do-parceiro.tsx"), /<AgendaCalendario /);
});

test("(ii) a galeria pública abre a foto ampliada (a visualização da galeria do imóvel)", () => {
  const g = ler("components/parceiros/galeria-publica.tsx");
  assert.match(g, /import \{ Lightbox \} from "@\/components\/property-gallery";/);
  assert.match(g, /<Lightbox photos=\{fotos\}/);
  assert.match(ler("app/(public)/parceiros/[slug]/page.tsx"), /<GaleriaPublica /);
  assert.match(ler("components/property-gallery.tsx"), /^export function Lightbox\(/m);
});
