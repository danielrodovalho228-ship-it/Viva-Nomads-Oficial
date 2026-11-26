// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
/*
  E236 — Plano Gestor: o mínimo de imóveis é UM número só, GESTOR_PRECO.minimoImoveis (decisão do Daniel, out/2026).
  Nenhuma frase liga o Gestor a um número escrito à mão (5, 20, 30 ou 31); os textos do Gestor saem da constante e mudam
  juntos com ela. A faixa sem teto da TAXA DE SERVIÇO ("31+") é outra regra e fica como está.
  Roda: node --test src/lib/planos/gestor-minimo-textos.test.ts
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): o Plano Gestor de 4% deixou de ser oferta pública e GESTOR_PRECO saiu. O
  "um número só" continua valendo para o mínimo das CARTEIRAS (CARTEIRAS_MINIMO_IMOVEIS = 20): os textos das carteiras saem da
  constante (TEXTO_CARTEIRAS) e mudam juntos com ela. A faixa sem teto da taxa é a de 16 ou mais, a 6% — não é mais a do Gestor, e
  o mínimo das carteiras não é degrau da escada. A varredura ("nenhuma frase liga Gestor a um número fixo") não mudou.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CARTEIRAS_MINIMO_IMOVEIS, TEXTO_CARTEIRAS } from "../../config/planos.ts";
import { FAQ } from "../atendimento/faq.ts";
import { EMPRESAS_E_GESTORES } from "../atendimento/parceiros-texto.ts";
import { FAIXAS_COMISSAO_PADRAO, escadaTaxasCurta, faixaPorImoveisAtivos } from "../cobranca/regra.ts";

const RAIZ = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, RAIZ), "utf8");
// 078 (Daniel, 16/11/2026): antes N = GESTOR_PRECO.minimoImoveis; o número único agora é o mínimo das carteiras.
const N = CARTEIRAS_MINIMO_IMOVEIS;

function arquivos(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(new URL(dir, RAIZ))) {
    const p = join(dir, nome);
    if (statSync(new URL(p, RAIZ)).isDirectory()) arquivos(`${p}/`, out);
    else if (/\.(ts|tsx)$/.test(nome) && !/\.(test|spec)\./.test(nome)) out.push(p);
  }
  return out;
}

/** Número de imóveis escrito à mão colado ao Gestor ("31+", "31 ou mais", "20 imóveis", "a partir de 30", "tem 5"). */
const NUMERO_FIXO = /\b(5|20|30|31)\s*(\+|ou mais|imóve)|\b(a partir de|tem|com) (5|20|30|31)\b/;
/** Frases que citam Gestor e um número, mas não falam do mínimo do plano (com o motivo). */
const EXCECOES: Record<string, string> = {
  "src/lib/data/planos-actions.ts": "comentário sobre o mesmo documento enviado 5 vezes contar como 5 imóveis (dedupe), não o mínimo",
  "src/config/planos.ts": "a própria constante e o comentário do preço (R$ 500 com 20 inclusos) — a fonte do número",
};

test("VARREDURA: nenhuma frase liga 'Gestor' a um número fixo de imóveis (falha se surgir uma)", () => {
  const achados: string[] = [];
  for (const f of arquivos("src/")) {
    if (f in EXCECOES) continue;
    const frases = ler(f).split(/(?<=[.;])\s+|\n/);
    for (const fr of frases) if (/Gestor/.test(fr) && NUMERO_FIXO.test(fr)) achados.push(`${f}: ${fr.trim().slice(0, 140)}`);
  }
  assert.deepEqual(achados, []);
});

test("VARREDURA public/: as páginas estáticas não ligam 'Gestor' a um número fixo nem chamam a faixa 31+ de Plano Gestor", () => {
  // HTML estático não lê a constante: o Gestor não pode vir com número escrito à mão, e a faixa sem teto da taxa é
  // "taxa negociável" (E252-B). Achado da varredura do E236: /apresentacao dizia "31+ imóveis (Plano Gestor)".
  const achados: string[] = [];
  for (const f of readdirSync(new URL("public/", RAIZ)).filter((n) => /\.html?$/.test(n)).map((n) => `public/${n}`)) {
    for (const fr of ler(f).split(/(?<=[.;])\s+|\n/)) {
      if (/Gestor/.test(fr) && (NUMERO_FIXO.test(fr) || /\b31\b/.test(fr))) achados.push(`${f}: ${fr.trim().slice(0, 140)}`);
    }
  }
  assert.deepEqual(achados, []);
  // 078 (Daniel, 16/11/2026): antes a apresentação TINHA <span>Plano Gestor</span><b>4%</b>. Agora não cita o plano nem os 4%; no
  // lugar, a linha das carteiras — e, como HTML estático não lê a constante, o texto tem de ser o MESMO de TEXTO_CARTEIRAS (o número
  // escrito ali muda junto com a constante, senão este teste falha).
  const [quem, oQue] = TEXTO_CARTEIRAS.replace(/\.$/, "").split(": ");
  assert.equal(oQue, "fale com a Viva");
  assert.ok(ler("public/apresentacao.html").includes(`<span>${quem}</span><b>Fale com a Viva</b>`), quem);
  assert.doesNotMatch(ler("public/apresentacao.html"), /Plano Gestor|<b>4%<\/b>/);
  assert.doesNotMatch(ler("public/apresentacao.html"), /taxa negociável/);
});

test("os 4 pontos do E236 e a varredura usam CARTEIRAS_MINIMO_IMOVEIS (078: no lugar de GESTOR_PRECO.minimoImoveis)", () => {
  for (const f of [
    "src/app/(public)/parceiros/page.tsx",
    "src/components/precos/plano-gestor-form.tsx",
    "src/app/api/plano-gestor/route.ts",
    "src/lib/atendimento/faq.ts",
    "src/lib/atendimento/viva-prompt.ts",
    "src/lib/atendimento/parceiros-texto.ts",
  ]) {
    // 078 (Daniel, 16/11/2026): antes /GESTOR_PRECO\.minimoImoveis|PORTA_GESTOR_TEXTO|GESTOR_TEXTO/ — as constantes do Gestor saíram.
    // O mínimo (ou a linha inteira, que o lê) vem das constantes das carteiras, e nenhuma constante antiga sobrou no arquivo.
    assert.match(ler(f), /CARTEIRAS_MINIMO_IMOVEIS|TEXTO_CARTEIRAS/, f);
    assert.doesNotMatch(ler(f), /GESTOR_PRECO|PORTA_GESTOR_TEXTO|GESTOR_TEXTO/, f);
  }
  const planos = ler("src/config/planos.ts");
  // 078 (Daniel, 16/11/2026): antes /PORTA_GESTOR_TEXTO = `${GESTOR_PRECO.minimoImoveis} imóveis ou mais ativos (…), ou conta de
  // administradora`/. A linha das carteiras lê o mínimo da constante — o 20 está escrito UMA vez.
  assert.match(planos, /export const CARTEIRAS_MINIMO_IMOVEIS = 20;/);
  assert.match(planos, /export const TEXTO_CARTEIRAS = `Carteira a partir de \$\{CARTEIRAS_MINIMO_IMOVEIS\} imóveis ou administradora de imóveis: fale com a Viva\.`;/);
  // 078 (Daniel, 16/11/2026): antes /Plano Gestor: ${GESTOR_TEXTO}./ no cartão de /parceiros.
  assert.match(ler("src/app/(public)/parceiros/page.tsx"), /texto: `Taxa menor por volume\. \$\{TEXTO_CARTEIRAS\}`/);
  // 078 (Daniel, 16/11/2026): antes config/planos TINHA GESTOR_TEXTO = `…% para carteiras de ${GESTOR_PRECO.minimoImoveis} ou mais
  // imóveis ou conta de administradora, com cadastro assistido…`; a constante não é mais declarada (nem a porta, nem o preço).
  assert.doesNotMatch(planos, /(GESTOR_TEXTO|PORTA_GESTOR_TEXTO|GESTOR_PRECO|GESTOR_RESUMO|GESTOR_DIFERENCIAIS)\s*=/);
  const form = ler("src/components/precos/plano-gestor-form.tsx");
  // 078 (Daniel, 16/11/2026): antes /title="Plano Gestor"/.
  assert.match(form, /title="Fale com a Viva sobre carteiras"/);
  assert.doesNotMatch(form, /title="Plano Gestor"/);
  // 078 (Daniel, 16/11/2026): antes /subject: `Lead — Plano Gestor (${GESTOR_PRECO.minimoImoveis}+ imóveis)`/.
  assert.match(ler("src/app/api/plano-gestor/route.ts"), /subject: `Contato — carteira \(\$\{CARTEIRAS_MINIMO_IMOVEIS\}\+ imóveis ou administradora\)`/);
  assert.doesNotMatch(ler("src/app/(dashboard)/dashboard/simulador/page.tsx"), /Gestor \(31\+\)/);
  // 078 (Daniel, 16/11/2026): antes /modelodenegocio usava /Plano Gestor: {GESTOR_TEXTO}./, reexportado por lib/planos/gestor (para
  // não ler @/config/planos). Agora a mesma porta reexporta a linha das carteiras, e o texto do Gestor não existe mais.
  const modelo = ler("src/components/modelo-negocio/modelo-negocio.tsx");
  assert.match(modelo, /Imóvel ativo = publicado e aprovado\. \{TEXTO_CARTEIRAS\}/);
  // A página dos sócios lê a linha pela porta de lib/planos/gestor (a guarda de textos-socios proíbe @/config/planos ali).
  assert.match(modelo, /import \{ TEXTO_CARTEIRAS \} from "@\/lib\/planos\/gestor";/);
  assert.doesNotMatch(modelo, /GESTOR_TEXTO|@\/config\/planos/);
  // 078 (Daniel, 16/11/2026): antes /GESTOR_MIN_IMOVEIS_VALIDADOS: number = GESTOR_PRECO.minimoImoveis;/ em lib/planos/gestor. O
  // mínimo de elegibilidade saiu de lá (não há plano para ativar) — e o arquivo não guarda número próprio de imóveis.
  assert.doesNotMatch(ler("src/lib/planos/gestor.ts"), /GESTOR_MIN_IMOVEIS_VALIDADOS|GESTOR_PRECO|\b20\b/);
});

test("os textos prontos das carteiras saem da constante (mudam juntos com ela); nenhum cita o Plano Gestor", () => {
  // 078 (Daniel, 16/11/2026): antes uma resposta da Ajuda TINHA "O Plano Gestor tem taxa de 4%, sem mensalidade, para
  // ${PORTA_GESTOR_TEXTO}". Agora nenhuma cita o plano; a de "Quanto custa anunciar?" traz a escada da regra + a linha das carteiras.
  assert.equal(FAQ.map((q) => q.resposta).find((r) => r.includes("Plano Gestor")), undefined);
  const taxa = FAQ.find((q) => q.id === "custo-anunciar")?.resposta;
  assert.ok(taxa?.includes(`(publicados, com documento aprovado e calendário em dia): ${escadaTaxasCurta()}. ${TEXTO_CARTEIRAS} Exemplo:`));
  assert.doesNotMatch(taxa ?? "", /(?<![\d,.])4\s?%/);
  // 078 (Daniel, 16/11/2026): antes PORTA_GESTOR_TEXTO.startsWith(`${N} imóveis ou mais`).
  assert.ok(TEXTO_CARTEIRAS.startsWith(`Carteira a partir de ${N} imóveis ou administradora de imóveis`));
  // 078 (Daniel, 16/11/2026): antes EMPRESAS_E_GESTORES incluía `Plano Gestor, 4% sem mensalidade, para ${PORTA_GESTOR_TEXTO}`.
  assert.ok(EMPRESAS_E_GESTORES.includes(`a taxa de serviço cai com o volume (${escadaTaxasCurta()}). ${TEXTO_CARTEIRAS}`));
  assert.doesNotMatch(EMPRESAS_E_GESTORES, /Plano Gestor|(?<![\d,.])4\s?%/);
});

test("E564/078: a faixa sem teto NÃO é mais a do Plano Gestor — começa em 16, a 6%; o mínimo das carteiras não é degrau; a '31+ negociável' saiu", () => {
  const ultima = FAIXAS_COMISSAO_PADRAO[FAIXAS_COMISSAO_PADRAO.length - 1];
  // 078 (Daniel, 16/11/2026): antes ultima.minImoveis === GESTOR_PRECO.minimoImoveis (20); a última faixa começa em 16.
  assert.equal(ultima.minImoveis, 16);
  assert.equal(ultima.maxImoveis, null);
  // 078 (Daniel, 16/11/2026): antes ultima.taxa === GESTOR_PRECO.taxa (0.04).
  assert.equal(ultima.taxa, 0.06);
  // 078 (Daniel, 16/11/2026): antes ultima.gestor === true; nenhuma faixa é marcada como Gestor.
  assert.equal(FAIXAS_COMISSAO_PADRAO.some((f) => "gestor" in f), false);
  assert.equal(FAIXAS_COMISSAO_PADRAO.some((f) => f.negociavel), false);
  // 078 (Daniel, 16/11/2026): antes a penúltima faixa terminava em GESTOR_PRECO.minimoImoveis − 1 (19). Termina em 15 (colada na
  // última), e a carteira de N (20) imóveis cai DENTRO da última faixa — o mínimo das carteiras não muda a taxa.
  assert.equal(FAIXAS_COMISSAO_PADRAO[FAIXAS_COMISSAO_PADRAO.length - 2].maxImoveis, ultima.minImoveis - 1);
  assert.equal(faixaPorImoveisAtivos(N), ultima);
  assert.equal(faixaPorImoveisAtivos(N - 1), ultima);
});

test("E564/078: os rótulos da tabela — a faixa sem teto é só '16–19 imóveis' (nem 'Plano Gestor', nem 'taxa negociável')", async () => {
  const { FAIXAS_COMISSAO_PADRAO: faixas, rotuloFaixaTaxa } = await import("../cobranca/regra.ts");
  // 078 (Daniel, 16/11/2026): antes […, "16–19 imóveis", `${N}+ imóveis · Plano Gestor`].
  assert.deepEqual(faixas.map((f) => rotuloFaixaTaxa(f, true)), ["1–2 imóveis", "3–5 imóveis", "6–15 imóveis", "16–19 imóveis"]);
  // 078 (Daniel, 16/11/2026): antes a última faixa ficava de fora desta checagem (slice(0, -1)), porque levava "Plano Gestor"; agora
  // NENHUM rótulo, nem o da última, cita Gestor ou negociação.
  for (const r of faixas.map((f) => rotuloFaixaTaxa(f))) assert.doesNotMatch(r, /Gestor|negoci/);
});
