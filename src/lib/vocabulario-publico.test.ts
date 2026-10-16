/* Roda: node --test src/lib/vocabulario-publico.test.ts
   Ordens 8652162e (#142) e 1c00ab68 (#143): vocabulário e promessas nas páginas públicas. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CAUCAO_FRASE } from "./faixas.ts";
import { achadosNoTexto } from "./varredura-texto.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("#142: frase-padrão da Caução sem 'aluguéis'", () => {
  assert.match(CAUCAO_FRASE, /^Caução de até 3 vezes o valor mensal, depositada em poupança/);
  assert.deepEqual(achadosNoTexto(CAUCAO_FRASE, { vocabulario: true }), []);
});

test("#142: regras do anúncio e páginas públicas sem hóspede/check-in/reserva/título 'Garantia'", () => {
  const regras = ler("components/property/stay-rules.tsx");
  assert.doesNotMatch(regras, /label: "Hóspedes"|label: "Check-(in|out)"|Garantias e pagamento/);
  assert.match(regras, /label: "Moradores"/);
  assert.match(regras, /label: "Entrada"/);
  assert.match(regras, /label: "Saída"/);
  assert.match(regras, /Caução e pagamento/);
  const precos = ler("app/(public)/precos/page.tsx");
  assert.doesNotMatch(precos, /a reserva é fechada|valor mensal da reserva/);
  const empresas = ler("app/(public)/empresas/page.tsx");
  assert.doesNotMatch(empresas, /quem se hospeda/);
  const home = ler("app/(public)/page.tsx");
  assert.doesNotMatch(home, /Garantia locatícia combinada/);
  const como = ler("app/(public)/como-funciona/page.tsx");
  assert.doesNotMatch(como, />Garantias da locação<|title: "Garantia do contrato"/);
});

test("#143: /empresas não promete aceite do recibo nem tem frase interna", () => {
  const e = ler("app/(public)/empresas/page.tsx");
  assert.doesNotMatch(e, /aceitos para reembolso|Sem promessa/);
  assert.match(e, /Recibo mensal emitido pelo proprietário|Recibo mensal da estadia emitido pelo proprietário \+ contrato assinado, que podem ser usados no reembolso conforme a política da sua empresa\./);
});

test("#142 (ajuste do Moacir): 'Até as', busca com Moradores e calendário sem 'reserva' visível", () => {
  assert.match(ler("components/property/stay-rules.tsx"), /`Até as \$\{/);
  assert.doesNotMatch(ler("components/property/stay-rules.tsx"), /Até às/);
  const busca = ler("app/(public)/buscar/search-client.tsx");
  assert.doesNotMatch(busca, /aria-label="Hóspedes"|"hóspedes"|`\$\{total\} hóspedes`|: "Hóspedes"/);
  assert.match(busca, /"Moradores"/);
  const cal = ler("components/property/availability-calendar.tsx");
  assert.doesNotMatch(cal, /solicitação de\s+reserva|reservá-lo/);
});
