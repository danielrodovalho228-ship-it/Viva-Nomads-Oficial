/*
  E530 — "Ver o caminho para morar" (anúncio de exemplo) não mostrava caminho nenhum: o link só rolava até o cartão de
  preço (#cartao-preco), ao lado de onde a pessoa já estava. NOME ≠ DESTINO.
  Correção: o mesmo texto vira um "abrir/fechar" que mostra ali mesmo os passos do morador (a MESMA fonte da página
  Como funciona) e leva, se a pessoa quiser, ao passo a passo completo em /como-funciona#para-inquilinos.
  Roda: node --test src/lib/e530-caminho-reserva.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PASSOS_MORADOR } from "../config/caminho-reserva.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const calendario = ler("src/components/property/availability-calendar.tsx");
const comoFunciona = ler("src/app/(public)/como-funciona/page.tsx");

test("os passos do morador: Busque, Converse, Candidate-se, Assine — cada um com texto", () => {
  assert.deepEqual(PASSOS_MORADOR.map((p) => p.titulo), ["Busque", "Converse", "Candidate-se", "Assine"]);
  for (const p of PASSOS_MORADOR) assert.ok(p.texto.length > 20, p.titulo);
});

test("a página Como funciona usa a MESMA fonte dos passos (sem cópia que desatualiza)", () => {
  assert.match(comoFunciona, /import \{ PASSOS_MORADOR \} from "@\/config\/caminho-reserva";/);
  assert.match(comoFunciona, /PASSOS_MORADOR\[0\]/);
  assert.doesNotMatch(comoFunciona, /title: "Candidate-se", text: "Envie sua candidatura/);
});

test("o controle é um componente próprio, sempre visível na página do imóvel (não depende de datas nem de ser exemplo)", () => {
  const comp = ler("src/components/property/caminho-reserva.tsx");
  const pagina = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(comp, /<details[^>]*data-testid="caminho-reserva"/);
  assert.match(comp, /<summary[^>]*>\s*Ver o caminho para morar\s*<\/summary>/);
  assert.match(comp, /PASSOS_MORADOR\.map/);
  assert.match(comp, /href="\/como-funciona#para-inquilinos"/);
  assert.match(pagina, /import \{ CaminhoReserva \} from "@\/components\/property\/caminho-reserva";/);
  // Dentro do bloco #disponibilidade, antes do calendário, sem condição de data ou de anúncio de exemplo.
  assert.match(pagina, /<div id="disponibilidade"[\s\S]*?<CaminhoReserva \/>[\s\S]*?<AvailabilityCalendar /);
});

test("o calendário não guarda mais o controle (um só no DOM) e não rola para o cartão de preço", () => {
  assert.doesNotMatch(calendario, /href="#cartao-preco"/);
  assert.doesNotMatch(calendario, /data-testid="caminho-reserva"/);
});

// Lab t118: "reserva" é vocabulário de hospedagem — fora das páginas públicas (varredura de texto, ordem 8652162e).
test("o rótulo visível do caminho não usa o vocabulário 'reserva'", () => {
  const comp = readFileSync("src/components/property/caminho-reserva.tsx", "utf8");
  const rotulo = /<summary[^>]*>\s*([^<]+?)\s*<\/summary>/.exec(comp)?.[1] ?? "";
  assert.ok(rotulo.length > 0);
  assert.doesNotMatch(rotulo, /\breservas?\b/i);
});
