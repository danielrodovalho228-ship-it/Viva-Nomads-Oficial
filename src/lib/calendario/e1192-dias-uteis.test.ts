/*
  E1192 (ORDEM-DUET-861) — os dias úteis pulam os feriados nacionais, e a conta mora num módulo só.
  Antes: "dia útil" era segunda a sexta. O prazo do laudo podia cair em 25/12 ou 01/01, e o sinal de "laudo atrasado"
  (que pesa na conduta do avaliador) cobrava trabalho num feriado. Havia duas contas, cada uma com a sua regra de fim de
  semana: a do laudo (laudo.ts) e a do relógio do dono na pré-aceitação (pre-aceitacao.ts).
  Travado aqui:
   1. os feriados nacionais oficiais (nove fixos + a Sexta-feira Santa, calculada da Páscoa) não são dia útil; os pontos
      facultativos (Carnaval, Corpus Christi) continuam a ser;
   2. os três casos do coordenador: 2 dias úteis a partir de 23/12/2026 → 28/12; a Sexta-feira Santa de 2027 (26/03) é
      pulada; 20/11 é pulado;
   3. sem feriado no caminho, a conta dá o que dava (os casos antigos do laudo e do relógio do dono);
   4. a regra nova nunca traz uma data para TRÁS (ORDEM-865): varredura de três anos contra a regra de antes. Sem
      feriado no caminho a data é a mesma, com uma exceção, sempre para a frente: quando a conta de antes acabava às
      00:00 de um sábado (o fim da sexta — acontecia com a visita no fim de semana e 5 dias úteis), a de agora acaba
      às 00:00 da segunda. O prazo cai sempre num dia útil;
   5. o prazo do laudo e o relógio do dono usam o módulo; não sobra conta de dia útil fora dele (estático);
   6. a nota "Dias úteis: segunda a sexta, sem feriados nacionais." é uma constante só, e as telas e os e-mails da
      avaliação que dizem um prazo em dias úteis mostram-na (o pedido anterior à regra, "laudo em 7 dias", fica sem).
  Roda: node --test src/lib/calendario/e1192-dias-uteis.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NOTA_DIAS_UTEIS, citaDiasUteis, diaUtil, feriadoNacional, somarDiasUteis } from "./dias-uteis.ts";
import { corpoVistoria } from "../vistoria/corpo-email.ts";
import { prazoLaudo } from "../vistoria/laudo.ts";
import { prazoDoDono } from "../propostas/pre-aceitacao.ts";

/** Um instante dito em horário de Brasília (UTC−3). */
const brt = (iso: string) => new Date(`${iso}:00-03:00`);
/** O instante lido de volta em Brasília: "AAAA-MM-DDTHH:MM". */
const ver = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 16);

test("1. os nove feriados nacionais fixos não são dia útil", () => {
  for (const d of ["2026-01-01", "2026-04-21", "2026-05-01", "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-20", "2026-12-25", "2027-11-15"]) {
    assert.ok(feriadoNacional(d), `${d} é feriado nacional`);
    assert.equal(diaUtil(d), false, `${d} não é dia útil`);
  }
});

test("1. a Sexta-feira Santa sai da Páscoa: 03/04/2026, 26/03/2027, 14/04/2028, 30/03/2029, 19/04/2030", () => {
  for (const d of ["2026-04-03", "2027-03-26", "2028-04-14", "2029-03-30", "2030-04-19"]) {
    assert.equal(feriadoNacional(d), "Sexta-feira Santa", d);
    assert.equal(diaUtil(d), false, d);
  }
  assert.equal(feriadoNacional("2027-04-02"), null, "a sexta seguinte é um dia comum");
});

test("1. ponto facultativo não é feriado: Carnaval e Corpus Christi continuam dias úteis", () => {
  for (const [d, nome] of [["2027-02-08", "segunda de Carnaval"], ["2027-02-09", "terça de Carnaval"], ["2027-05-27", "Corpus Christi"]] as const) {
    assert.equal(feriadoNacional(d), null, nome);
    assert.equal(diaUtil(d), true, nome);
  }
});

test("1. dia útil é o dia de Brasília: sábado e domingo ficam fora; o instante lê-se em Brasília", () => {
  assert.equal(diaUtil("2026-11-21"), false, "sábado");
  assert.equal(diaUtil("2026-11-22"), false, "domingo");
  assert.equal(diaUtil("2026-11-23"), true, "segunda");
  // 25/12/2026 01:00 UTC ainda é 24/12 (quinta) em Brasília.
  assert.equal(diaUtil(new Date("2026-12-25T01:00:00Z")), true);
  // 26/12/2026 02:00 UTC ainda é 25/12 (Natal) em Brasília.
  assert.equal(diaUtil(new Date("2026-12-26T02:00:00Z")), false);
});

test("2. os casos do coordenador: 23/12/2026 + 2 → 28/12; a Sexta-feira Santa de 2027 e o 20/11 são pulados", () => {
  // quarta 23/12 → quinta 24/12 (1) → sexta 25/12 Natal, sábado, domingo → segunda 28/12 (2)
  assert.equal(ver(somarDiasUteis(brt("2026-12-23T10:00"), 2)), "2026-12-28T10:00");
  // quinta 25/03/2027 → sexta 26/03 Sexta-feira Santa, sábado, domingo → segunda 29/03
  assert.equal(ver(somarDiasUteis(brt("2027-03-25T10:00"), 1)), "2027-03-29T10:00");
  // quinta 19/11/2026 → sexta 20/11 feriado, sábado, domingo → segunda 23/11
  assert.equal(ver(somarDiasUteis(brt("2026-11-19T10:00"), 1)), "2026-11-23T10:00");
});

test("2. o prazo do laudo é essa conta: visita em 23/12/2026, 2 dias úteis → 28/12; virada do ano pula 01/01", () => {
  assert.equal(ver(prazoLaudo(brt("2026-12-23T10:00").toISOString(), 2)), "2026-12-28T10:00");
  // quinta 31/12/2026 → sexta 01/01 feriado, sábado, domingo → segunda 04/01 (1) → terça 05/01 (2)
  assert.equal(ver(prazoLaudo(brt("2026-12-31T16:30").toISOString(), 2)), "2027-01-05T16:30");
  // sem prazo combinado vale o padrão (2 dias úteis)
  assert.equal(ver(prazoLaudo(brt("2026-12-23T10:00").toISOString(), null)), "2026-12-28T10:00");
});

test("2. o relógio do dono (1 dia útil) é essa conta: 20/11, Natal e Sexta-feira Santa pulados; o teto da entrada fica", () => {
  assert.equal(ver(prazoDoDono(brt("2026-11-19T10:00"), null)), "2026-11-23T10:00");
  assert.equal(ver(prazoDoDono(brt("2026-12-24T15:00"), null)), "2026-12-28T15:00");
  assert.equal(ver(prazoDoDono(brt("2026-04-02T09:30"), null)), "2026-04-06T09:30");
  assert.equal(ver(prazoDoDono(brt("2026-11-19T10:00"), "2026-11-20")), "2026-11-20T00:00", "nunca passa do início do dia da entrada");
});

test("2. começando num feriado, a conta parte das 00h do próximo dia útil — como já era no fim de semana", () => {
  // sexta 20/11/2026 (feriado) 15h → conta a partir de segunda 23/11 00h → +2 → quarta 25/11 00h
  assert.equal(ver(somarDiasUteis(brt("2026-11-20T15:00"), 2)), "2026-11-25T00:00");
  // sábado 07/11/2026 15h → segunda 09/11 00h → +2 → quarta 11/11 00h
  assert.equal(ver(somarDiasUteis(brt("2026-11-07T15:00"), 2)), "2026-11-11T00:00");
});

test("3. sem feriado no caminho, a conta dá o que dava", () => {
  // os dois casos antigos do laudo (laudo.test.ts): quinta 10h + 2 → segunda 10h; sábado 12h + 2 → quarta 00h
  assert.equal(prazoLaudo("2026-10-22T13:00:00Z").toISOString(), "2026-10-26T13:00:00.000Z");
  assert.equal(prazoLaudo("2026-10-24T15:00:00Z").toISOString(), "2026-10-28T03:00:00.000Z");
  // os casos antigos do relógio do dono (e722-pre-aceitacao.test.ts)
  assert.equal(prazoDoDono(new Date("2026-11-10T13:00:00Z"), "2026-12-20").toISOString(), "2026-11-11T13:00:00.000Z");
  assert.equal(prazoDoDono(new Date("2026-11-13T13:00:00Z"), "2026-12-20").toISOString(), "2026-11-16T13:00:00.000Z");
  assert.equal(prazoDoDono(new Date("2026-11-14T15:00:00Z"), "2026-12-20").toISOString(), "2026-11-17T03:00:00.000Z");
});

// ── 4. A regra de antes, guardada só aqui para a comparação (era a de laudo.ts e a de pre-aceitacao.ts) ────────────
const H = 3_600_000;
const DIA = 24 * H;
const BRT = -3 * H;
const fimDeSemana = (t: number) => [0, 6].includes(new Date(t + BRT).getUTCDay());
const meiaNoite = (t: number) => Math.floor((t + BRT) / DIA) * DIA - BRT;
/** O prazo do laudo de antes: horas úteis, de segunda a sexta. */
function laudoDeAntes(inicio: number, dias: number): number {
  let t = inicio;
  let resta = dias * DIA;
  while (resta > 0) {
    if (fimDeSemana(t)) { t = meiaNoite(t) + DIA; continue; }
    const passo = Math.min(resta, meiaNoite(t) + DIA - t);
    t += passo;
    resta -= passo;
  }
  return t;
}
/** O relógio do dono de antes: a mesma hora no próximo dia de segunda a sexta. */
function donoDeAntes(inicio: number): number {
  let base = inicio;
  while (fimDeSemana(base)) base = meiaNoite(base) + DIA;
  let fim = base + DIA;
  while (fimDeSemana(fim)) fim += DIA;
  return fim;
}
/** Há feriado nacional entre os dois instantes (dias de Brasília, pontas incluídas)? */
function temFeriadoEntre(a: number, b: number): boolean {
  for (let t = meiaNoite(a); t <= b; t += DIA) if (feriadoNacional(new Date(t + BRT).toISOString().slice(0, 10))) return true;
  return false;
}
/**
 * Sem feriado no caminho, a data de agora é a de antes — ou a de antes era as 00:00 de um dia não útil (o fim do último
 * dia útil) e a de agora são as 00:00 do dia útil seguinte.
 */
function mesmaDataOuFimDoDiaUtil(antes: number, agora: number): boolean {
  if (agora === antes) return true;
  if (antes !== meiaNoite(antes) || diaUtil(new Date(antes))) return false;
  let t = antes;
  while (!diaUtil(new Date(t))) t += DIA;
  return agora === t;
}

test("4. a regra nova nunca traz a data para trás: três anos de inícios, de 1 a 5 dias úteis, contra a regra de antes", () => {
  const inicio = Date.parse("2026-01-01T03:00:00Z");
  const fim = Date.parse("2029-01-01T03:00:00Z");
  let conferidos = 0;
  let iguais = 0;
  let adiante = 0;
  // passo de 7 h 13 min: passa por todos os dias da semana e por todas as horas do dia
  for (let t = inicio; t < fim; t += 7 * H + 13 * 60_000) {
    for (let n = 1; n <= 5; n++) {
      const antes = laudoDeAntes(t, n);
      const agora = somarDiasUteis(new Date(t), n).getTime();
      assert.ok(agora >= antes, `laudo: ${new Date(t).toISOString()} + ${n} andou para trás (${new Date(agora).toISOString()} < ${new Date(antes).toISOString()})`);
      if (!temFeriadoEntre(t, agora)) assert.ok(mesmaDataOuFimDoDiaUtil(antes, agora), `laudo sem feriado no caminho: ${new Date(t).toISOString()} + ${n} deu ${new Date(agora).toISOString()}, antes ${new Date(antes).toISOString()}`);
      if (!temFeriadoEntre(t, agora) && diaUtil(new Date(t)) && t !== meiaNoite(t)) assert.equal(agora, antes, `laudo, início em dia útil, sem feriado: ${new Date(t).toISOString()} + ${n}`);
      if (agora === antes) iguais++; else adiante++;
      conferidos++;
    }
    const donoAntes = donoDeAntes(t);
    const donoAgora = prazoDoDono(new Date(t), null).getTime();
    assert.ok(donoAgora >= donoAntes, `dono: ${new Date(t).toISOString()} andou para trás`);
    if (!temFeriadoEntre(t, donoAgora)) assert.equal(donoAgora, donoAntes, `dono sem feriado no caminho: ${new Date(t).toISOString()}`);
    conferidos++;
  }
  assert.ok(conferidos > 20_000, `varredura curta demais: ${conferidos}`);
  assert.ok(adiante > 0 && iguais > adiante, `a varredura tem de passar por feriados (${adiante}) e por dias comuns (${iguais})`);
});

test("4. na meia-noite em ponto o prazo sai num dia útil — nunca num sábado nem num feriado", () => {
  // visita no sábado 07/11/2026, 5 dias úteis: a conta parte de segunda 09/11 00:00. A regra de antes acabava no sábado
  // 14/11 às 00:00 (o fim da sexta); a de agora, na segunda 16/11 às 00:00. Para a frente, e num dia útil.
  const sabado = brt("2026-11-07T15:00");
  assert.equal(ver(new Date(laudoDeAntes(sabado.getTime(), 5))), "2026-11-14T00:00");
  assert.equal(ver(somarDiasUteis(sabado, 5)), "2026-11-16T00:00");
  for (let t = Date.parse("2026-01-01T03:00:00Z"); t < Date.parse("2027-01-01T03:00:00Z"); t += DIA) {
    for (let n = 1; n <= 5; n++) assert.equal(diaUtil(somarDiasUteis(new Date(t), n)), true, `${new Date(t).toISOString()} + ${n}`);
  }
});

// ── 5. Estático ─────────────────────────────────────────────────────────────────────────────────────────────────
const RAIZ = new URL("../../", import.meta.url).pathname; // src/
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}
const MODULO = "lib/calendario/dias-uteis.ts";
/**
 * Fora do módulo, só isto olha para sábado ou domingo — e não é conta de dia útil:
 * o dublê do comparador encarece as noites de sexta e sábado (preço de fim de semana), não conta prazo.
 */
const FORA_DA_REGRA: Record<string, string> = { "lib/comparador-airbnb/fonte.ts": "preço de fim de semana do dublê" };
const FIM_DE_SEMANA = /(getUTCDay\(\)|getDay\(\)|\bdow\([^)]*\)|\bdow\b|\bdia\b|\bdiaDaSemana\b)\s*(===|!==|==|!=)\s*[06]\b|\[\s*0\s*,\s*6\s*\]\.includes|\[\s*6\s*,\s*0\s*\]\.includes/;
const LISTA_DE_FERIADOS = /["'`](\d{2}-\d{2}|\d{2}\/\d{2})["'`]\s*:\s*["'`]|feriados?\s*[:=]\s*\[/i;

test("5. estático: nenhuma conta de dia útil fora do módulo do calendário", () => {
  const achados: string[] = [];
  for (const caminho of arquivos(RAIZ)) {
    const rel = caminho.slice(RAIZ.length);
    if (rel === MODULO || rel in FORA_DA_REGRA) continue;
    const linhas = readFileSync(caminho, "utf8").split("\n");
    linhas.forEach((l, i) => {
      if (FIM_DE_SEMANA.test(l)) achados.push(`${rel}:${i + 1} regra de fim de semana: ${l.trim().slice(0, 120)}`);
      if (LISTA_DE_FERIADOS.test(l)) achados.push(`${rel}:${i + 1} lista de feriados: ${l.trim().slice(0, 120)}`);
      if (/somarHorasUteis|HORAS_DO_DIA_UTIL/.test(l)) achados.push(`${rel}:${i + 1} a conta antiga em horas úteis: ${l.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(achados, []);
  // a exceção continua a existir (senão a lista de exceções está velha)
  for (const rel of Object.keys(FORA_DA_REGRA)) assert.match(readFileSync(join(RAIZ, rel), "utf8"), FIM_DE_SEMANA, rel);
});

test("5. estático: o prazo do laudo e o relógio do dono somam pelo módulo", () => {
  const laudo = readFileSync(join(RAIZ, "lib/vistoria/laudo.ts"), "utf8");
  const pre = readFileSync(join(RAIZ, "lib/propostas/pre-aceitacao.ts"), "utf8");
  assert.match(laudo, /import \{[^}]*\bsomarDiasUteis\b[^}]*\} from "\.\.\/calendario\/dias-uteis\.ts"/);
  assert.match(laudo, /prazoLaudo = \(visitaEm: string, diasUteis\?: number \| null\) => somarDiasUteis\(new Date\(visitaEm\), diasUteisDoLaudo\(diasUteis\)\)/);
  assert.match(pre, /import \{[^}]*\bsomarDiasUteis\b[^}]*\} from "\.\.\/calendario\/dias-uteis\.ts"/);
  assert.match(pre, /somarDiasUteis\(inicio, 1\)/);
});

test("6. a nota que explica 'dias úteis' é uma só, a do módulo", () => {
  assert.equal(NOTA_DIAS_UTEIS, "Dias úteis: segunda a sexta, sem feriados nacionais.");
  const copias: string[] = [];
  for (const caminho of arquivos(RAIZ)) {
    const rel = caminho.slice(RAIZ.length);
    if (rel === MODULO) continue;
    if (/segunda a sexta, sem feriados/i.test(readFileSync(caminho, "utf8"))) copias.push(rel);
  }
  assert.deepEqual(copias, [], "a nota escrita à mão fora do módulo");
});

test("6. a nota entra onde o texto cita um prazo em dias úteis — e só aí", () => {
  assert.equal(citaDiasUteis("laudo em até 1 dia útil depois da visita"), true);
  assert.equal(citaDiasUteis("Laudo até 05/05/2026 (2 dias úteis depois da visita)"), true);
  assert.equal(citaDiasUteis("laudo em 7 dias"), false);
  assert.equal(citaDiasUteis("Contatos úteis do prédio"), false);
  assert.equal(citaDiasUteis(null), false);
});

test("6. as telas da avaliação que dizem um prazo em dias úteis mostram a nota, pelo mesmo componente", () => {
  const componente = readFileSync(join(RAIZ, "components/ui/nota-dias-uteis.tsx"), "utf8");
  assert.match(componente, /\{NOTA_DIAS_UTEIS\}/);
  assert.match(componente, /data-testid="nota-dias-uteis"/);
  const telas = [
    "components/vistoria/bloco-avaliacao-dono.tsx", // dono: a proposta, o combinado e a espera da contestação
    "components/avaliadores/pedido.tsx", // avaliador: a proposta enviada e o prazo combinado
    "components/avaliadores/aceitar-pedido.tsx", // avaliador: o campo do prazo na proposta
    "app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx", // avaliador: a lista (campo da proposta e resumo dos pedidos)
    "app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx", // avaliador: o fim da visita e o prazo de envio do laudo
    // E1196 (ORDEM-DUET-887): os três sítios da Triagem/Proposta que dizem um prazo em dias úteis.
    "components/triagem/vinculo-morador.tsx", // equipe: "A equipe confere em até 2 dias úteis."
    "app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx", // dono: "Seu prazo de 1 dia útil para decidir…"
    "app/(dashboard)/dashboard/candidaturas/page.tsx", // morador: "A resposta chega em até 1 dia útil."
  ];
  for (const rel of telas) {
    const fonte = readFileSync(join(RAIZ, rel), "utf8");
    assert.match(fonte, /<NotaDiasUteis\b/, rel);
    assert.match(fonte, /from "@\/components\/ui\/nota-dias-uteis"/, rel);
  }
});

test("6. o e-mail que cita dias úteis fecha com a nota; o que não cita fica como estava", () => {
  const fatos = { imovel: { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" }, avaliador: "Rui Avalia", valorProposto: 250, prazoPropostoDias: 2, prazoLaudoDiasUteis: 2, propostaEm: "2026-04-28T12:15:00Z" };
  const comPrazo = corpoVistoria("vistoria_proposta_aceita", fatos).body("Rui");
  assert.ok(comPrazo.endsWith(`Laudo em até 2 dias úteis depois da visita. ${NOTA_DIAS_UTEIS}`), comPrazo);
  assert.equal(comPrazo.split(NOTA_DIAS_UTEIS).length - 1, 1, "a nota uma vez só");
  const antigo = corpoVistoria("vistoria_proposta_aceita", { ...fatos, prazoPropostoDias: 7, prazoLaudoDiasUteis: null }).body("Rui");
  assert.ok(antigo.endsWith("Laudo em 7 dias."), antigo);
  assert.ok(!antigo.includes(NOTA_DIAS_UTEIS));
});

test("6. E1196: nos textos que vêm da lib, a nota entra só quando o texto cita dias úteis (o `de` do componente)", () => {
  const proposta = readFileSync(join(RAIZ, "app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx"), "utf8");
  assert.match(proposta, /<NotaDiasUteis de=\{\[p\.preAceitacao\.contexto\]\}/);
  const candidaturas = readFileSync(join(RAIZ, "app/(dashboard)/dashboard/candidaturas/page.tsx"), "utf8");
  assert.match(candidaturas, /<NotaDiasUteis de=\{\[PROXIMO_PASSO_CANDIDATURA\[c\.situacao\.chave\]!\.agora\]\}/);
});

test("6. E1196 (ORDEM-DUET-894): o lembrete da pré-aceitação ao dono — o mesmo prazo da tela — fecha com a nota (tela ≡ e-mail)", () => {
  const servidor = readFileSync(join(RAIZ, "lib/propostas/pre-aceitacao-servidor.ts"), "utf8");
  assert.match(servidor, /import \{[^}]*\bNOTA_DIAS_UTEIS\b[^}]*\} from "@\/lib\/calendario\/dias-uteis"/);
  assert.match(servidor, /\$\{linhaDeContexto\("owner", "vigente", textoDoPrazo\(prazo\), null\)\} \$\{NOTA_DIAS_UTEIS\}`/, "a nota logo a seguir à frase do prazo do dono");
  assert.equal((servidor.match(/NOTA_DIAS_UTEIS\}/g) ?? []).length, 1, "a nota uma vez só, no lembrete do dono");
});
