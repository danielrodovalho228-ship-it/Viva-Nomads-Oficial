/*
  Preços 12/8/4/0: comparativo em reais, plano que compensa, comissão congelada
  no aceite e nenhum percentual de comissão fixo fora de config/planos.ts.
  Roda: node --test src/lib/comparativo-precos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { airbnbPorImovelAno, calcularComparativo, custoAnualPorPlano, planoMaisBarato, serieCustoPorImovel, textoIndisponivel, textoLimite } from "./comparativo-precos.ts";
import { COMISSAO_POR_PLANO, GESTOR_PRECO, GESTOR_RESUMO, PLANOS, assinaturaAnualGestor, taxaDoContrato, textoComissao } from "../config/planos.ts";

test("tabela nova: 12% / 8% / 4% / 0% e mensalidades R$ 0 / 49 / 129 / sob consulta", () => {
  assert.deepEqual(COMISSAO_POR_PLANO, { free: 0.12, essential: 0.08, pro: 0.04, gestor: 0 });
  assert.deepEqual(PLANOS.map((p) => p.precoMensal), [0, 49, 129, null]);
});

test("comparativo: R$ 2.400 × 4 meses", () => {
  const c = calcularComparativo(2400, 4);
  assert.equal(c.valorContrato, 9600);
  assert.equal(c.airbnb, 1536);
  assert.equal(c.imobiliaria, 2400 + 768); // 1º aluguel + 8% ao mês × 4
  const por = Object.fromEntries(c.planos.map((p) => [p.id, p]));
  assert.deepEqual([por.free.comissao, por.free.mensalidades, por.free.total], [288, 0, 288]);
  assert.deepEqual([por.essential.comissao, por.essential.mensalidades, por.essential.total], [192, 196, 388]);
  assert.deepEqual([por.pro.comissao, por.pro.mensalidades, por.pro.total], [96, 516, 612]);
  assert.equal(Math.round(por.free.pctDoContrato * 1000) / 10, 3);
  assert.ok(!("gestor" in por), "Gestor é sob consulta: fora do comparativo por contrato");
});

test("qual plano compensa, por cenário", () => {
  // 1 imóvel, 3 contratos/ano: Gratuito (864) < Essencial (576+588) < Pro (288+1548)
  assert.equal(planoMaisBarato(1, 3, 2400), "free");
  // 3 imóveis: o Gratuito não comporta (1 anúncio)
  assert.equal(custoAnualPorPlano(3, 10, 2400).find((x) => x.id === "free")!.total, null);
  assert.equal(planoMaisBarato(3, 10, 2400), "essential"); // empate (R$ 2.508 × R$ 2.508): fica o plano mais simples
  // Muitos contratos e aluguel alto: o Profissional compensa
  assert.equal(planoMaisBarato(10, 40, 5000), "pro"); // Ess: 16000+588 · Pro: 8000+1548
  // Mais de 20 imóveis: só o Gestor
  assert.equal(planoMaisBarato(25, 50, 3000), "gestor");
});

test("limite de anúncios: plano acima do limite fica desabilitado e nunca 'compensa'", () => {
  const disp = (imoveis: number) => Object.fromEntries(custoAnualPorPlano(imoveis, 3, 2400).map((x) => [x.id, x.disponivel]));
  // 1 imóvel, 3 contratos → Gratuito
  assert.equal(planoMaisBarato(1, 3, 2400), "free");
  assert.deepEqual(disp(1), { free: true, essential: true, pro: true, gestor: false });
  // 2 imóveis → Gratuito desabilitado ("Limite de 1 anúncio")
  const dois = custoAnualPorPlano(2, 3, 2400).find((x) => x.id === "free")!;
  assert.equal(dois.disponivel, false);
  assert.equal(dois.total, null);
  assert.equal(textoLimite(dois.limite), "Limite de 1 anúncio");
  assert.notEqual(planoMaisBarato(2, 3, 2400), "free");
  // 6 imóveis → só o Profissional (o Gestor começa em 20)
  assert.deepEqual(disp(6), { free: false, essential: false, pro: true, gestor: false });
  assert.equal(textoLimite(5), "Limite de 5 anúncios");
  assert.equal(planoMaisBarato(6, 3, 2400), "pro");
  // Mesmo com 0 contrato (Gratuito seria R$ 0), plano sem vaga não compensa
  assert.equal(planoMaisBarato(6, 0, 2400), "pro");
});

test("limites vêm de config/planos.ts", () => {
  for (const p of PLANOS) assert.equal(custoAnualPorPlano(1, 0, 2400).find((x) => x.id === p.id)!.limite, p.limiteAnuncios);
  assert.deepEqual(PLANOS.map((p) => p.limiteAnuncios).slice(0, 3), [1, 5, 20]);
});

test("Profissional não vende o contrato digital como exclusivo (acompanha toda locação)", () => {
  const pro = PLANOS.find((p) => p.id === "pro")!;
  assert.ok(!pro.beneficios.some((b) => /contrato digital/i.test(b)));
  const modelo = readFileSync(new URL("../components/modelo-negocio/modelo-negocio.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(modelo, /Contrato digital com validade jurídica incluído|Contrato incluído/);
});

test("texto da comissão sempre em reais", () => {
  assert.equal(textoComissao(0.12, 2400), "12% de um aluguel, uma vez por contrato (≈ R$ 288)");
  assert.equal(textoComissao(0.04), "4% de um aluguel, uma vez por contrato");
  assert.match(textoComissao(0), /zero/i);
  for (const p of PLANOS) if (p.comissao > 0) assert.match(p.custoLabel, /de um aluguel, uma vez por contrato \(≈ R\$ \d/);
});

test("comissão congelada no aceite: aceites antigos NÃO mudam com a tabela nova", () => {
  assert.equal(taxaDoContrato(0.1, "essential"), 0.1); // Essencial antigo (10%) continua 10%
  assert.equal(taxaDoContrato(0.08, "pro"), 0.08); // Profissional antigo (8%) continua 8%
  assert.equal(taxaDoContrato("0.12", "free"), 0.12);
  assert.equal(taxaDoContrato(null, "essential"), 0.08); // sem taxa gravada: a do plano hoje
  assert.equal(taxaDoContrato(null, "pro"), 0.04);
  assert.equal(taxaDoContrato(0.5, "pro"), 0.04); // taxa inventada não vale
});

/** Arquivos .ts/.tsx do src, menos testes e a fonte única. */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

test("nenhum outro arquivo tem percentual de comissão fixo", () => {
  const raiz = new URL("../", import.meta.url).pathname; // src/
  const fonte = join(raiz, "config", "planos.ts");
  const violacoes: string[] = [];
  for (const arq of arquivos(raiz)) {
    // Fontes únicas: planos legados (grandfather) e as faixas da cobrança "Pague quando alugar".
    if (arq === fonte || arq === join(raiz, "lib", "cobranca", "faixas.ts")) continue;
    readFileSync(arq, "utf8")
      .split("\n")
      .forEach((linha, i) => {
        if (!/comiss|commission|airbnb/i.test(linha)) return;
        if (/\b(4|8|10|12|16)\s?%/.test(linha) || /[^\w.]0?\.(04|08|1|10|12|16)\b/.test(linha)) violacoes.push(`${arq.replace(raiz, "src/")}:${i + 1}: ${linha.trim().slice(0, 120)}`);
      });
  }
  assert.deepEqual(violacoes, []);
});

/** Residência médica: R$ 3.000, 6 meses, 2 locações por imóvel no ano. */
const RM = { aluguel: 3000, meses: 6, locacoes: 2 };
const melhorRM = (n: number) => planoMaisBarato(n, RM.locacoes * n, RM.aluguel);
const totalRM = (n: number, id: string) => custoAnualPorPlano(n, RM.locacoes * n, RM.aluguel).find((x) => x.id === id)!.total;

test("Gestor: R$ 500/mês com 20 imóveis incluídos + R$ 25 por adicional, comissão zero, a partir de 20", () => {
  assert.deepEqual({ ...GESTOR_PRECO }, { ligado: true, mensalBase: 500, imoveisInclusos: 20, porImovelAdicional: 25, minimoImoveis: 20 });
  assert.equal(COMISSAO_POR_PLANO.gestor, 0);
  assert.equal(assinaturaAnualGestor(20), 6000);
  assert.equal(assinaturaAnualGestor(25), 12 * (500 + 5 * 25));
  assert.equal(GESTOR_RESUMO, "a partir de R$ 500/mês · comissão zero · para carteiras de 20+ imóveis");
  // Abaixo de 20 o Gestor não entra: com 19 ele (R$ 6.000) canibalizaria o Profissional (R$ 6.108).
  assert.equal(totalRM(19, "gestor"), null);
  assert.equal(totalRM(19, "pro"), 6108);
  assert.equal(textoIndisponivel(custoAnualPorPlano(19, 38, 3000).find((x) => x.id === "gestor")!, 19), "A partir de 20 imóveis");
  assert.equal(textoIndisponivel(custoAnualPorPlano(6, 12, 3000).find((x) => x.id === "essential")!, 6), "Limite de 5 anúncios");
});

test("Residência médica: plano mais barato por quantidade de imóveis", () => {
  assert.equal(melhorRM(1), "free");
  assert.equal(totalRM(1, "free"), 720);
  assert.equal(melhorRM(2), "essential");
  // 4 imóveis: Essencial e Profissional empatam (R$ 2.508) → fica o mais simples
  assert.equal(totalRM(4, "essential"), 2508);
  assert.equal(totalRM(4, "pro"), 2508);
  assert.equal(melhorRM(4), "essential");
  for (const n of [5, 10, 19]) assert.equal(melhorRM(n), "pro", `${n} imóveis`);
  for (const n of [20, 25]) assert.equal(melhorRM(n), "gestor", `${n} imóveis`);
  assert.equal(totalRM(20, "gestor"), 6000);
  assert.equal(totalRM(25, "gestor"), 7500);
  assert.equal(totalRM(25, "pro"), null); // acima do limite de 20 anúncios
});

test("gráfico 'Custo por imóvel no ano': Airbnb = 16% × aluguel × meses × locações; empate Essencial × Pro em 4", () => {
  assert.equal(airbnbPorImovelAno(3000, 6, 2), 5760);
  const s = serieCustoPorImovel(RM.aluguel, RM.meses, RM.locacoes);
  assert.equal(s.airbnb, 5760);
  assert.equal(s.ate, 20);
  assert.equal(s.empateEssencialPro, 4);
  const pontos = Object.fromEntries(s.planos.map((p) => [p.id, p.pontos]));
  assert.deepEqual(pontos.free, [{ imoveis: 1, porImovel: 720 }]);
  assert.deepEqual(pontos.essential.map((p) => p.imoveis), [1, 2, 3, 4, 5]);
  assert.deepEqual(pontos.pro.map((p) => p.imoveis), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.deepEqual(pontos.gestor, [{ imoveis: 20, porImovel: 300 }]);
  assert.equal(pontos.pro.find((p) => p.imoveis === 5)!.porImovel, 2748 / 5);
  // Fora da faixa do Essencial (aluguel baixo) não há marcador
  assert.equal(serieCustoPorImovel(1000, 2, 1).empateEssencialPro, null);
});

test("/modelodenegocio e /precos usam o mesmo cálculo e o mesmo gráfico", () => {
  const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const modelo = ler("components/modelo-negocio/modelo-negocio.tsx");
  assert.match(modelo, /custoAnualPorPlano\(imoveis, locacoes \* imoveis, aluguel\)/);
  assert.match(modelo, /<GraficoCustoPorImovel /);
  assert.match(modelo, /Mais barato para você/);
  assert.match(modelo, /Quantos imóveis você tem\?" value=\{imoveis\} min=\{1\} max=\{30\}/);
  assert.doesNotMatch(modelo, /GESTOR_ASSINATURA_ANUAL_ESTIMADA/);
  const precos = ler("components/precos/comparativo-precos.tsx");
  assert.match(precos, /custoAnualPorPlano\(imoveis, locacoes \* imoveis, aluguel\)/);
  assert.match(precos, /<GraficoCustoPorImovel /);
});

test("e-mail de suporte do site é o suporte@ (contato@ é só comercial)", async () => {
  const { SUPORTE_EMAIL } = await import("./site.ts");
  assert.equal(SUPORTE_EMAIL, "suporte@vivanomads.com.br");
});

test("e-mail do site sai de um lugar só (SUPORTE_EMAIL em lib/site.ts)", () => {
  const raiz = new URL("../", import.meta.url).pathname;
  const achados = arquivos(raiz).filter(
    (a) => !a.endsWith("/lib/site.ts") && /(contato|suporte)@vivanomads/.test(readFileSync(a, "utf8"))
  );
  assert.deepEqual(achados, []);
});
