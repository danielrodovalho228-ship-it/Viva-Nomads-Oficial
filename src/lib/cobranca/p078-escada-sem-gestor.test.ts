// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
/*
  Prompt 078 (decisão do Daniel, 16/11/2026) — lançar sem o Plano Gestor público de 4%.
  A escada pública é 1–2 = 12% · 3–5 = 10% · 6–15 = 8% · 16–19 = 6%. Carteira a partir de 20 imóveis ou
  administradora: sem taxa publicada, "fale com a Viva" (condições caso a caso, pela taxa fixada pelo admin).
  Roda: node --test src/lib/cobranca/p078-escada-sem-gestor.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as regra from "./regra.ts";
import * as planos from "../../config/planos.ts";
import { FRASE_ESCADA_TAXAS } from "../../config/textos-regulados.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

const { FAIXAS_COMISSAO_PADRAO, faixaPorImoveisAtivos, taxaNaAssinatura, proximaFaixa, escadaTaxasTexto, TEXTO_REGRA_UNICA, DESCRICAO_PRECOS } = regra;
const ler = (p: string) => readFileSync(p, "utf8");
const DIA = 86_400_000;
const hoje = new Date("2026-11-16T12:00:00Z");

test("078: a escada padrão tem 4 faixas e a última, sem teto, é 16–19 = 6%", () => {
  assert.deepEqual(
    FAIXAS_COMISSAO_PADRAO.map((f) => [f.minImoveis, f.maxImoveis, f.taxa]),
    [[1, 2, 0.12], [3, 5, 0.1], [6, 15, 0.08], [16, null, 0.06]],
  );
  assert.ok(FAIXAS_COMISSAO_PADRAO.every((f) => !("gestor" in f)), "nenhuma faixa padrão é 'gestor'");
  assert.equal("FAIXA_GESTOR" in regra, false, "FAIXA_GESTOR saiu da regra");
});

test("078: faixaPorImoveisAtivos para 1, 2, 3, 5, 6, 15, 16, 19, 20, 50 e 500", () => {
  const esperado: [number, number][] = [[1, 12], [2, 12], [3, 10], [5, 10], [6, 8], [15, 8], [16, 6], [19, 6], [20, 6], [50, 6], [500, 6]];
  for (const [n, pct] of esperado) assert.equal(Math.round(faixaPorImoveisAtivos(n).taxa * 100), pct, `${n} imóveis`);
  assert.equal(proximaFaixa(16), null, "na última faixa não há próxima");
  assert.deepEqual(proximaFaixa(15), { faltam: 1, taxa: 0.06 });
});

test("078: conta de administradora com 3 imóveis paga 10%, não 4% (o tipo da conta não escolhe faixa)", () => {
  // O servidor não manda mais o tipo da conta para a regra; mesmo que alguém mande, a regra ignora.
  const e = { tipo: "novo" as const, imoveisAtivos: 3, assinadoEm: hoje, administradora: true };
  const t = taxaNaAssinatura(e);
  assert.equal(t.taxa, 0.1);
  assert.equal(t.origem, "faixa");
  const servidor = ler("src/lib/cobranca/taxa-servidor.ts");
  assert.doesNotMatch(servidor, /administradora:/, "taxaDoDonoAgora não passa o tipo da conta");
  assert.doesNotMatch(servidor, /gestor: true/, "a faixa sem teto da tabela não é marcada como Gestor");
  assert.doesNotMatch(ler("src/lib/cobranca/regra.ts"), /e\.administradora/);
});

test("078: taxa fixada pelo admin (4% com motivo e validade) vence a faixa; vencida, volta a faixa", () => {
  const fixada = { taxa: 0.04, motivo: "Parceira fundadora (E566)", validoAte: new Date(hoje.getTime() + 30 * DIA) };
  const valida = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 3, assinadoEm: hoje, fixadaPeloAdmin: fixada });
  assert.equal(valida.taxa, 0.04);
  assert.equal(valida.origem, "admin");
  assert.equal(valida.faixaNoFechamento.taxa, 0.1, "a faixa do fechamento continua registrada");
  const vencida = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 3, assinadoEm: hoje, fixadaPeloAdmin: { ...fixada, validoAte: new Date(hoje.getTime() - DIA) } });
  assert.equal(vencida.taxa, 0.1);
  assert.equal(vencida.origem, "faixa");
  const semMotivo = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 3, assinadoEm: hoje, fixadaPeloAdmin: { ...fixada, motivo: " " } });
  assert.equal(semMotivo.taxa, 0.1, "sem motivo a fixação não vale");
});

test("078: congelamento — proposta com taxa_congelada = 0.04 continua com 4%", () => {
  assert.ok(planos.TAXAS_HISTORICAS.includes(0.04), "o 0,04 fica nas taxas históricas");
  assert.equal(planos.taxaDoContrato(0.04, null), 0.04);
  assert.equal(planos.taxaDoContrato("0.04", "free"), 0.04);
  assert.equal(planos.taxaDoContrato(0.06, null), 0.06);
});

test("078: a linha de carteiras é fonte única, com o 20 vindo de constante, sem taxa", () => {
  assert.equal(planos.CARTEIRAS_MINIMO_IMOVEIS, 20);
  assert.equal(planos.TEXTO_CARTEIRAS, "Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva.");
  assert.match(ler("src/config/planos.ts"), /TEXTO_CARTEIRAS = `Carteira a partir de \$\{CARTEIRAS_MINIMO_IMOVEIS\} imóveis/);
  assert.doesNotMatch(planos.TEXTO_CARTEIRAS, /%/);
  for (const saiu of ["PORTA_GESTOR_TEXTO", "GESTOR_PRECO", "GESTOR_TEXTO", "GESTOR_RESUMO", "GESTOR_DIFERENCIAIS"]) {
    assert.equal(saiu in planos, false, `${saiu} saiu de config/planos`);
  }
});

test("078: os textos da escada saem da regra — 16–19 = 6%, 'até 6%', e a linha de carteiras no lugar do Gestor", () => {
  assert.equal(escadaTaxasTexto(), "1–2 imóveis: 12% · 3–5 imóveis: 10% · 6–15 imóveis: 8% · 16–19 imóveis: 6%");
  assert.equal(regra.escadaTaxasCurta(), "1–2 = 12%, 3–5 = 10%, 6–15 = 8%, 16–19 = 6%");
  assert.match(TEXTO_REGRA_UNICA, /menor a taxa \(até 6%\)/);
  assert.match(DESCRICAO_PRECOS, /até 6%/);
  assert.equal(FRASE_ESCADA_TAXAS, `Quanto mais imóveis ativos, menor a taxa: ${escadaTaxasTexto()}. ${planos.TEXTO_CARTEIRAS}`);
  for (const t of [TEXTO_REGRA_UNICA, DESCRICAO_PRECOS, FRASE_ESCADA_TAXAS, escadaTaxasTexto()]) {
    assert.doesNotMatch(t, /Gestor|(?<![\d,.])4\s?%/);
  }
  // Nenhum número da escada escrito à mão nos textos da regra.
  const fonte = ler("src/lib/cobranca/regra.ts");
  assert.match(fonte, /TEXTO_REGRA_UNICA =\s*`[^`]*\$\{TAXA_MENOR_TEXTO\}/);
  assert.match(fonte, /DESCRICAO_PRECOS =\s*`[^`]*\$\{TAXA_MENOR_TEXTO\}/);
});

test("078 (estático): as superfícies citam a escada e a linha de carteiras pela fonte única, sem número escrito à mão", () => {
  const usa: [string, RegExp][] = [
    ["src/config/textos-regulados.ts", /escadaTaxasTexto\(\)\}\. \$\{TEXTO_CARTEIRAS\}/],
    ["src/app/(public)/page.tsx", /\{TAXA_MAIOR_TEXTO\}[^\n]*\{TAXA_MENOR_TEXTO\}[^\n]*\{TEXTO_CARTEIRAS\}/],
    ["src/app/(public)/para-proprietarios/page.tsx", /\{FRASE_ESCADA_TAXAS\}/],
    ["src/app/(public)/como-funciona/page.tsx", /\{FRASE_ESCADA_TAXAS\}/],
    ["src/app/(public)/parceiros/page.tsx", /\$\{TEXTO_CARTEIRAS\}/],
    ["src/app/(public)/precos/page.tsx", /\{TEXTO_CARTEIRAS\}/],
    ["src/lib/atendimento/faq.ts", /\$\{escadaTaxasCurta\(\)\}\. \$\{TEXTO_CARTEIRAS\}/],
    ["src/lib/atendimento/viva-prompt.ts", /\$\{escadaTaxasCurta\(\)\}\. \$\{TEXTO_CARTEIRAS\}/],
    ["src/lib/atendimento/parceiros-texto.ts", /\$\{escadaTaxasCurta\(\)\}\)\. \$\{TEXTO_CARTEIRAS\}/],
    ["src/components/modelo-negocio/modelo-negocio.tsx", /\{TEXTO_CARTEIRAS\}/],
    ["src/components/financeiro/modelo-financeiro.tsx", /\{TEXTO_CARTEIRAS\}/],
    ["src/components/account/plano-gestor-conta.tsx", /textoTaxaNaConta\(t\) : FRASE_ESCADA_TAXAS/],
  ];
  for (const [arquivo, re] of usa) {
    const fonte = ler(arquivo);
    assert.match(fonte, re, arquivo);
    // Nenhuma faixa nem taxa da escada digitada no arquivo (a antiga "16–19", "= 6%", "12/10/8/6%").
    assert.doesNotMatch(fonteSemComentarios(fonte), /16[–-]19|\b(?:1[–-]2|3[–-]5|6[–-]15) ?= ?\d+ ?%|12\/10\/8\/6/, arquivo);
  }
  assert.match(ler("src/lib/atendimento/viva-prompt.ts"), /const REGRA_PRECO_TEXTO = TEXTO_REGRA_UNICA;/);
});

test("E995 (078, ORDEM-534): as respostas da Ajuda que falam da taxa dizem '16–19', nunca '16 ou mais' nem o Plano Gestor", async () => {
  // E995 (Gerente, 16/11/2026): as respostas leem da fonte única, então mudam junto com a regra. No 078 a escada dizia
  // "16 ou mais"; pela ORDEM-DUET-534 (22/11/2026) a escada publicada termina em "16–19 = 6%", como nos Termos, e quem
  // tem 20 ou mais lê a linha de carteiras. A negação inverteu: antes proibia "16–19"; agora proíbe "16 ou mais".
  const { FAQ } = await import("../atendimento/faq.ts");
  const resposta = (id: string) => FAQ.find((x: { id: string }) => x.id === id)!.resposta as string;
  // "O morador paga alguma taxa?" (E939): a escada por extenso.
  assert.ok(resposta("inquilino-paga").includes("16–19 imóveis: 6%"), resposta("inquilino-paga"));
  assert.ok(resposta("inquilino-paga").includes(escadaTaxasTexto()));
  // "Quanto custa anunciar?": a escada curta e a linha de carteiras.
  assert.ok(resposta("custo-anunciar").includes("16–19 = 6%"), resposta("custo-anunciar"));
  assert.ok(resposta("custo-anunciar").includes(planos.TEXTO_CARTEIRAS));
  for (const id of ["inquilino-paga", "custo-anunciar"]) assert.doesNotMatch(resposta(id), /16 ou mais|Plano Gestor|\b4 ?%/, id);
});

test("078: a apresentação pública (arquivo estático) mostra a mesma escada da regra e a linha de carteiras, sem o Gestor", () => {
  const html = ler("public/apresentacao.html");
  const linhas = [...html.matchAll(/<div class="row"><span>([^<]+)<\/span><b>(\d+%)<\/b><\/div>/g)].map((m) => `${m[1]}: ${m[2]}`);
  assert.equal(linhas.join(" · "), escadaTaxasTexto());
  assert.match(html, /<span>Carteira a partir de 20 imóveis ou administradora de imóveis<\/span><b>Fale com a Viva<\/b>/);
  assert.doesNotMatch(html, /Plano Gestor|<b>4%<\/b>/);
});

test("078: Conta › Plano diz a taxa de hoje da conta — administradora com 3 imóveis vê 10%; taxa combinada diz que é combinada", async () => {
  const { textoTaxaNaConta } = await import("../planos/gestor.ts");
  const naFaixa = textoTaxaNaConta({ taxa: faixaPorImoveisAtivos(3).taxa, origem: "faixa", imoveisAtivos: 3 });
  assert.equal(naFaixa, `Sua taxa de serviço hoje é de 10% (3 imóveis ativos). ${FRASE_ESCADA_TAXAS}`);
  assert.match(textoTaxaNaConta({ taxa: 0.12, origem: "faixa", imoveisAtivos: 1 }), /de 12% \(1 imóvel ativo\)\./);
  assert.match(textoTaxaNaConta({ taxa: 0.12, origem: "faixa", imoveisAtivos: 0 }), /^Sua taxa de serviço hoje é de 12%\. Quanto mais/);
  // Queda de faixa há menos de 30 dias: a taxa anterior vale, e o texto diz por quê (senão "8%" com 2 imóveis pareceria erro).
  assert.match(
    textoTaxaNaConta({ taxa: 0.08, origem: "faixa_com_queda_recente", imoveisAtivos: 2 }),
    /^Sua taxa de serviço hoje é de 8%: depois que a sua carteira diminuiu \(2 imóveis ativos\), a taxa anterior vale por mais 30 dias\. Quanto mais/,
  );
  const combinada = textoTaxaNaConta({ taxa: 0.04, origem: "admin", imoveisAtivos: 3 });
  assert.match(combinada, /^Sua taxa de serviço hoje é de 4%, combinada com a Viva\./);
  const gestor = await import("../planos/gestor.ts");
  for (const saiu of ["gestorElegivel", "faltamParaGestor", "motivoGestor", "textoElegibilidadeGestor", "GESTOR_MIN_IMOVEIS_VALIDADOS", "GESTOR_TEXTO"]) assert.equal(saiu in gestor, false, saiu);
  assert.equal(gestor.ROTULO_TIPO_CONTA.gestor, "administradora", "o tipo de conta fica");
});

test("078: o formulário e a rota viraram o pedido de contato de carteiras — sem taxa, sem 'plano', sem promessa de ferramenta", () => {
  for (const arquivo of ["src/components/precos/plano-gestor-form.tsx", "src/app/api/plano-gestor/route.ts"]) {
    const fonte = fonteSemComentarios(ler(arquivo));
    // "plano" como palavra de tela (o nome do arquivo, da rota e dos data-testid, "plano-gestor", não é texto de tela).
    assert.doesNotMatch(fonte, /plano gestor|\bplano\b(?!-)|\d ?%|\btaxa\b|cadastro assistido|ferramentas? exclusiv|suporte priorit/i, arquivo);
  }
  const form = ler("src/components/precos/plano-gestor-form.tsx");
  assert.match(form, /Falar com a Viva sobre carteiras/);
  assert.match(form, /title="Fale com a Viva sobre carteiras"/);
  for (const campo of ["nome", "email", "telefone", "imoveis"]) assert.match(form, new RegExp(`\\b${campo}\\b`), `campo ${campo} continua`);
  const rota = ler("src/app/api/plano-gestor/route.ts");
  assert.match(rota, /subject: `Contato — carteira \(\$\{CARTEIRAS_MINIMO_IMOVEIS\}\+ imóveis ou administradora\)`/);
  assert.doesNotMatch(rota, /\.from\(|insert\(/, "a rota só envia o e-mail interno: nada gravado nem apagado");
});
