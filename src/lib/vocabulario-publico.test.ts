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

test("#645 (ajuste do Moacir): comparativo e /precos dizem 'contrato' e 'Caução', nunca 'reserva' da Viva nem 'Garantia:'", () => {
  const comp = ler("components/precos/comparativo-precos.tsx");
  assert.doesNotMatch(comp, /[Rr]eserva de|reserva é fechada/);
  assert.match(comp, /Contrato de \$\{COMPARE_MESES\} meses/);
  const cfg = ler("config/compare-precos.ts");
  assert.doesNotMatch(cfg, /Você só paga quando a reserva/);
  assert.match(cfg, /Você só paga quando o contrato é fechado/);
  const precosTudo = ler("app/(public)/precos/page.tsx") + ler("lib/precos-pagina.ts");
  assert.doesNotMatch(precosTudo, /Garantia: uma por contrato/);
  assert.match(precosTudo, /Caução: uma por contrato/);
});

test("#645 (ajuste do Moacir): comparativo e /precos dizem 'contrato' e 'Caução', não 'reserva' nem 'Garantia'", () => {
  const comp = ler("components/precos/comparativo-precos.tsx");
  assert.doesNotMatch(comp, /[Rr]eserva/);
  assert.match(comp, /Contrato de \$\{COMPARE_MESES\} meses/);
  // E151: a linha do Passo 8 que repetia a regra saiu; "só com contrato fechado" fica na nota do simulador.
  assert.match(ler("lib/cobranca/bolso.ts"), /A taxa só é cobrada com contrato fechado/);
  const cfg = ler("config/compare-precos.ts");
  assert.match(cfg, /"Você só paga quando o contrato é fechado"/);
  const precos = ler("app/(public)/precos/page.tsx") + ler("lib/precos-pagina.ts");
  assert.doesNotMatch(precos, /Garantia: uma por contrato/);
  assert.match(precos, /Caução: uma por contrato/);
});

test("t118 (achado do Moacir): config do comparativo publicado não usa 'check-in' nem 'reserva' (nem na citação do Airbnb)", () => {
  const cfg = ler("config/compare-precos.ts");
  const texto = cfg.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(texto, /check[- ]?(in|out)\b/i);
  assert.doesNotMatch(texto, /\breservas?\b/i);
});

test("#143: /parceiros e o texto da Viva não prometem cobertura nacional", () => {
  const p = ler("app/(public)/parceiros/page.tsx");
  assert.doesNotMatch(p, /todo o Brasil|em qualquer região/i);
  assert.match(p, /Começando por Uberlândia \(MG\)\. Cadastre-se de qualquer cidade e avisamos quando chegarmos aí\./);
  assert.doesNotMatch(ler("lib/atendimento/parceiros-texto.ts"), /todo o Brasil/i);
});

test("#142 (t118 no lab 4f5a) + Prompt 41: o primário do anúncio é 'Solicitar' (a candidatura) e o passo final 'Enviar candidatura', sem 'reserva' no texto visível", () => {
  for (const arq of ["components/property/barra-fixa-celular.tsx", "app/(public)/imoveis/[id]/property-detail.tsx"]) {
    const src = ler(arq);
    assert.doesNotMatch(src, /"Solicitar reserva"/, arq);
    assert.match(src, /"Solicitar"/, arq);
  }
  assert.match(ler("app/(public)/imoveis/[id]/property-detail.tsx"), /"Enviar candidatura"/);
  assert.deepEqual(achadosNoTexto("Solicitar Agendar visita Enviar candidatura Mensagem Viva", { vocabulario: true }), []);
});
