/*
  E1118 (ORDEM-DUET-506) — os prazos da avaliação de imóveis escritos à mão passam às constantes. Havia "24 horas",
  "72 horas" e `max={72}` soltos em textos de e-mail, mensagens de ação e telas; uma constante duplicada
  (HORAS_PARA_RESPONDER) e uma função morta com a regra antiga (prazoResposta). Mudar o prazo numa fonte deixava as
  outras a dizer o número velho.
  A fonte única: src/lib/vistoria/prazos.ts (resposta do avaliador: padrão e máximo; aceite do dono) e
  REGRAS_AGENDA.antecedenciaReagendarHoras em regras.ts (reagendar).
  Travado aqui:
   1. varredura: nenhum literal destes prazos (24 ou 72 horas) no código das superfícies da avaliação, fora das fontes;
   2. as fontes existem uma vez só; a duplicada e a função morta saíram;
   3. os textos continuam a dizer o mesmo (saem das constantes): e-mails (com e sem os fatos do pedido), mensagem da
      escolha, reagendar, rótulos.
  Fora deste item, de propósito: as "48 horas úteis" do laudo (outra regra, com a sua própria fonte em laudo.ts).
  ORDEM-DUET-547 (endurecimento): a varredura apanha também o prazo escrito em forma ARITMÉTICA — `24 * 3_600_000`,
  `72*3600000`, `3_600_000 * 24`, `24 * 60 * 60 * 1000`… A regra é uma só: 24 ou 72, em algarismos, como fator de uma
  multiplicação. Antes, um prazo novo escrito assim passava pela varredura sem cair (caso 4).
  ORDEM-DUET-550: entra também a forma EM DIAS — o dia em milissegundos (`86_400_000`, `86400000`) multiplicado por um
  número escrito à mão, qualquer que seja: `3 * 86_400_000`, `7 * 86_400_000`, `86400000 * 30`. Quem conta dias dá nome
  ao número (`PRAZO_RESSALVA_DIAS * 86_400_000`). As três linhas que a regra apanhou no código ganharam nome (caso 5).
  Decisão do Gerente (DUET-1773): o número cru vezes o dia COM nome (`7 * DIA_MS`, `365 * DIA`) também cai — "o que tem
  de ter nome é o valor do prazo, não só a unidade". Apanhou mais uma linha no código (laudo-servidor.ts), hoje com nome.
  Roda: node --test src/lib/vistoria/e1118-prazos-sem-literal.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PRAZO_DONO_ACEITAR_HORAS, PRAZO_RESPOSTA_MAX_HORAS, PRAZO_RESPOSTA_PADRAO_HORAS } from "./prazos.ts";
import * as escolha from "./escolha.ts";
import { REGRAS_AGENDA, designacaoVencida, podeReagendar } from "./regras.ts";
import { corpoVistoria } from "./corpo-email.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const RAIZ = new URL("../../../", import.meta.url).pathname;
/** O dia em milissegundos, para as contas deste teste. */
const DIA = 86_400_000;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

/** As superfícies varridas: a regra, as ações, os e-mails e as telas da avaliação de imóveis (sem os testes). */
function arquivosVarridos(): string[] {
  const pastas = ["src/lib/vistoria", "src/components/vistoria", "src/components/avaliadores", "src/app/(dashboard)/dashboard/parceiro/avaliacao", "src/app/(dashboard)/admin/avaliadores"];
  const achados: string[] = [];
  const andar = (dir: string) => {
    for (const nome of readdirSync(join(RAIZ, dir))) {
      const rel = `${dir}/${nome}`;
      if (statSync(join(RAIZ, rel)).isDirectory()) andar(rel);
      else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.ts$/.test(nome)) achados.push(rel);
    }
  };
  pastas.forEach(andar);
  return achados.sort();
}
/** Onde os números moram, e só ali. */
const FONTES = new Set(["src/lib/vistoria/prazos.ts"]);
/** Um prazo destes escrito à mão: "24 horas", "72 h", `max={72}`, `?? 24`, `= 24;`, `: 24,`. */
const LITERAL = /\b(24|72)\s?(horas?|h)\b|max=\{(24|72)\}|\?\?\s*(24|72)\b|[=:]\s*(24|72)\s*[;,]/;
/**
 * ORDEM-DUET-547: o mesmo prazo em forma de conta — 24 ou 72, em algarismos, a multiplicar ou a ser multiplicado
 * (`24 * 3_600_000`, `3600000*72`, `24 * 60 * 60 * 1000`, `24 * HORA_MS`). O número tem de estar inteiro: 124, 240,
 * 24.5, 0.72 e um nome que acabe em 24 não contam. Quem multiplica uma CONSTANTE (`horas * 3_600_000`) não cai.
 */
const ARITMETICO = /(?<![\w.])(24|72)\s*\*|\*\s*(24|72)(?![\w.])/;
/**
 * ORDEM-DUET-550: a forma EM DIAS — o dia em milissegundos (`86_400_000`, `86400000`, `864e5`) multiplicado por um
 * número escrito à mão, dos dois lados da conta: `3 * 86_400_000`, `7 * 86_400_000`, `30.4375 * 86_400_000`,
 * `86400000 * 30`. E as 72 horas já feitas (`259_200_000`).
 * NÃO conta o dia sozinho (`const DIA = 86_400_000`, "o dia seguinte" da agenda): é a unidade. Nem a conta com um
 * número que tem nome (`c.dias * 86_400_000`, `PRAZO_RESSALVA_DIAS * 86_400_000`): é o jeito certo.
 */
const DIA_EM_MS = String.raw`(?:86_?400_?000|864e5)`;
const EM_DIAS = new RegExp(String.raw`(?<![\w.])\d[\d_.]*\s*\*\s*${DIA_EM_MS}\b|\b${DIA_EM_MS}\s*\*\s*\d|\b259_?200_?000\b`);
/**
 * Decisão do Gerente (DUET-1773): o mesmo com o dia COM nome — um número escrito à mão vezes uma constante que é o dia
 * (`7 * DIA_MS`, `365 * DIA`, `dia * 2`, `MS_POR_DIA * 3`). O nome do dia: DIA, UM_DIA, DIA_MS, DIA_EM_MS, MS_POR_DIA,
 * em maiúsculas ou em camelCase. Não é o dia: `dias`, `diaria`, `x.dia` (um campo). Com o número de dias também com
 * nome (`PRAZO_DEVOLUCAO_DIAS * DIA`, `d * dia`) não cai: é o jeito certo.
 */
const NOME_DO_DIA = String.raw`(?:(?:um_?)?dia(?:_?em)?(?:_?ms)?|ms_?por_?dia)`;
const EM_DIAS_COM_NOME = new RegExp(String.raw`(?<![\w.])\d[\d_.]*\s*\*\s*${NOME_DO_DIA}(?![\w.(])|(?<![\w.])${NOME_DO_DIA}\s*\*\s*\d`, "i");
const prazoAMao = (linha: string) => LITERAL.test(linha) || ARITMETICO.test(linha) || EM_DIAS.test(linha) || EM_DIAS_COM_NOME.test(linha);

test("E1118 (1): varredura — nenhum prazo da avaliação escrito à mão fora das fontes", () => {
  const arquivos = arquivosVarridos();
  assert.ok(arquivos.length > 40, `a varredura achou as superfícies (${arquivos.length} arquivos)`);
  for (const obrigatorio of ["src/lib/vistoria/corpo-email.ts", "src/lib/vistoria/actions.ts", "src/lib/vistoria/regras.ts", "src/lib/vistoria/telas-exibicao.ts", "src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx", "src/app/(dashboard)/admin/avaliadores/page.tsx", "src/components/vistoria/bloco-avaliacao-dono.tsx"]) {
    assert.ok(arquivos.includes(obrigatorio), `varre ${obrigatorio}`);
  }
  const achados: string[] = [];
  for (const arq of arquivos) {
    if (FONTES.has(arq)) continue;
    semComentarios(ler(arq))
      .split("\n")
      .forEach((linha, i) => {
        // A antecedência de reagendar tem a sua fonte em REGRAS_AGENDA (regras.ts): é a única linha permitida ali.
        if (arq === "src/lib/vistoria/regras.ts" && /^\s*antecedenciaReagendarHoras: 24,\s*$/.test(linha)) return;
        if (prazoAMao(linha)) achados.push(`${arq}:${i + 1}: ${linha.trim().slice(0, 140)}`);
      });
  }
  // Os e-mails genéricos da avaliação (o texto de reserva, sem os fatos do pedido) moram fora da pasta: só as linhas dela.
  semComentarios(ler("src/lib/notifications/eventos-email.ts"))
    .split("\n")
    .forEach((linha, i) => {
      if (/^\s*vistoria_\w+: \{/.test(linha) && prazoAMao(linha)) achados.push(`src/lib/notifications/eventos-email.ts:${i + 1}: ${linha.trim().slice(0, 140)}`);
    });
  assert.deepEqual(achados, [], "prazo escrito à mão (use a constante)");
});

test("E1118 (2): as fontes existem uma vez só; a constante duplicada e a função morta saíram", () => {
  assert.equal(PRAZO_RESPOSTA_PADRAO_HORAS, 24);
  assert.equal(PRAZO_RESPOSTA_MAX_HORAS, 72);
  assert.equal(PRAZO_DONO_ACEITAR_HORAS, 72);
  assert.equal(REGRAS_AGENDA.antecedenciaReagendarHoras, 24);
  // Quem importava de escolha.ts continua a receber as MESMAS constantes (reexportadas, não copiadas).
  assert.equal(escolha.PRAZO_RESPOSTA_PADRAO_HORAS, PRAZO_RESPOSTA_PADRAO_HORAS);
  assert.equal(escolha.PRAZO_RESPOSTA_MAX_HORAS, PRAZO_RESPOSTA_MAX_HORAS);
  assert.equal(escolha.PRAZO_DONO_ACEITAR_HORAS, PRAZO_DONO_ACEITAR_HORAS);
  assert.match(ler("src/lib/vistoria/escolha.ts"), /export \{ PRAZO_DONO_ACEITAR_HORAS, PRAZO_RESPOSTA_MAX_HORAS, PRAZO_RESPOSTA_PADRAO_HORAS \} from "\.\/prazos\.ts";/);
  assert.doesNotMatch(ler("src/lib/vistoria/escolha.ts"), /export const PRAZO_(RESPOSTA|DONO)/);
  // A duplicada (HORAS_PARA_RESPONDER) saiu de todo o código; o padrão da designação vencida é a fonte.
  for (const arq of arquivosVarridos()) assert.doesNotMatch(ler(arq), /HORAS_PARA_RESPONDER/, arq);
  const t0 = "2026-11-07T10:00:00Z";
  assert.equal(designacaoVencida(t0, new Date("2026-11-08T09:59:00Z")), false);
  assert.equal(designacaoVencida(t0, new Date("2026-11-08T10:00:00Z")), true);
  // A função morta com a regra antiga (contava sempre do padrão) saiu de telas-exibicao.
  assert.doesNotMatch(ler("src/lib/vistoria/telas-exibicao.ts"), /export function prazoResposta\b/);
});

test("E1118 (3): os textos dizem o mesmo de antes, agora a partir das constantes", () => {
  const ev = (e: string, extra: Record<string, unknown> = {}) => corpoVistoria(e as never, { titulo: "Apto Santa Mônica", ...extra } as never)!.body("Lara");
  assert.match(ev("vistoria_designada"), /Responda no prazo que você declarou \(padrão: 24 horas\) com o seu valor e o seu prazo/);
  // E1160 (1) (asserções alteradas, ORDEM-DUET-674): o aviso da proposta diz o prazo pela frase da fonte (E1154), a
  // mesma do bloco do dono; continua a dizer 72 horas, a partir da constante.
  assert.match(ev("vistoria_designado_dono"), /Aceite em até 72 horas depois da proposta/);
  assert.match(ev("vistoria_agendada"), /Reagendar sem custo: uma vez, com pelo menos 24 horas de aviso\./);
  // O texto de reserva (sem os fatos do pedido) diz os mesmos prazos.
  assert.match(TEMPLATES.vistoria_designada.body("Lara"), /\(padrão: 24 horas\)/);
  assert.match(TEMPLATES.vistoria_designado_dono.body("Lara"), /Aceite em até 72 horas depois da proposta/);
  assert.match(TEMPLATES.vistoria_agendada.body("Lara"), /com pelo menos 24 horas de aviso\./);
  const cedo = podeReagendar(new Date(Date.parse("2026-11-22T12:00:00Z") + 23 * 3_600_000).toISOString(), new Date("2026-11-22T12:00:00Z"), false);
  assert.deepEqual(cedo, { ok: false, motivo: "Reagendar sem custo só com pelo menos 24 horas de aviso." });
  // No código, os textos levam a constante (não o número).
  const email = ler("src/lib/vistoria/corpo-email.ts");
  assert.match(email, /\(padrão: \$\{PRAZO_RESPOSTA_PADRAO_HORAS\} horas\)/);
  // E1160 (asserções alteradas, ORDEM-DUET-674): os dois textos deixaram de ser montados no e-mail — ele lê a frase
  // da fonte de cada um, e é a fonte que leva a constante.
  assert.match(email, /\$\{textoDoPrazoDeAceiteDesdeAProposta\(f\.propostaEm\)\}/);
  assert.match(ler("src/lib/vistoria/relogio-do-pedido.ts"), /Aceite em até \$\{PRAZO_DONO_ACEITAR_HORAS\} horas depois da proposta/);
  assert.match(email, /\$\{REGRA_DO_REAGENDAMENTO\}/);
  assert.match(ler("src/lib/vistoria/regras.ts"), /com pelo menos \$\{REGRAS_AGENDA\.antecedenciaReagendarHoras\} horas de aviso/);
  assert.match(ler("src/lib/vistoria/actions.ts"), /no prazo que declarou \(padrão: \$\{PRAZO_RESPOSTA_PADRAO_HORAS\} horas\)/);
  const lista = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
  assert.match(lista, /name="prazoRespostaHoras" type="number" min=\{1\} max=\{PRAZO_RESPOSTA_MAX_HORAS\} defaultValue=\{cred\.prazo_resposta_horas \?\? PRAZO_RESPOSTA_PADRAO_HORAS\}/);
});

test("E1118 (4, ORDENS 547 e 550): a varredura apanha o prazo em forma aritmética e em dias — e só ele", () => {
  // O que tem de cair: 24 ou 72 como fator, em qualquer ordem, com ou sem espaços e sublinhados.
  const caem = [
    "const fim = t + 24 * 3_600_000;",
    "const fim = t + 24*3600000;",
    "return agora.getTime() >= t + 72 * 3_600_000;",
    "const prazo = 3_600_000 * 24;",
    "const prazo = 3600000*72;",
    "const limite = Date.now() + 24 * 60 * 60 * 1000;",
    "const limite = Date.now() + 72 * 60 * 60_000;",
    "const limite = Date.now() + 1000 * 60 * 60 * 24;",
    "const emSegundos = 24 * 3600;",
    "const ms = 24 * 36e5;",
    "const ms = (72 * HORA_MS);",
    "const ms = horaEmMs * 24;",
    "if (agora.getTime() - Date.parse(designadoEm) >= 24 *3_600_000) return true;",
    // A forma em dias (ORDEM-DUET-550): o dia em milissegundos multiplicado por um número escrito à mão, qualquer um.
    "const fim = t + 3 * 86_400_000;",
    "const fim = t + 3*86400000;",
    "const fim = t + 86_400_000 * 3;",
    "const fim = t + 1 * 86_400_000;",
    "const fim = t + 3 * 864e5;",
    "const fim = t + 259_200_000;",
    "const fim = t + 259200000;",
    "const g = 13 * 86_400_000;",
    "const h = 31 * 86_400_000;",
    "const i = 0.3 * 86_400_000;",
    "const j = 86_400_000 * 30;",
    "const k = 86400000*7;",
    "const l = 1_000 * 86_400_000;",
    // As três linhas que estavam no código antes desta ordem (hoje com nome: caso 5).
    "return t >= -12 * 3_600_000 && t <= 7 * 86_400_000;",
    "const MES = 30.4375 * 86_400_000;",
    "const trintaDias = new Date(agora.getTime() - 30 * 86_400_000).toISOString();",
    // O dia COM nome vezes um número cru (decisão do Gerente, DUET-1773): o valor do prazo é que tem de ter nome.
    "const p = 7 * DIA_MS;",
    "const q = 3 * DIA;",
    "const r = 2 * dia;",
    "const s = DIA_MS * 7;",
    "const t = diaEmMs * 30;",
    "const u = 3 * MS_POR_DIA;",
    "const v = 1.5 * UM_DIA;",
    "const w = 30*umDia;",
    // A linha que estava no código antes desta decisão (hoje com nome: caso 5).
    'admin.from("vistoria_laudos").select("property_id").gte("emitido_em", new Date(agora.getTime() - 365 * DIA).toISOString()),',
  ];
  for (const linha of caem) assert.ok(prazoAMao(linha), `tem de cair: ${linha}`);
  // O que NÃO pode cair: outras regras em horas (3 h, 12 h), números que só contêm 24 ou 72, e a conta feita com a
  // constante — que é o jeito certo.
  const passam = [
    "const alvo = new Date(Date.parse(agendadoPara) - 3 * 3_600_000).toISOString().slice(0, 10);",
    "return t >= -12 * 3_600_000 && t <= DIAS_DA_SEMANA_DA_AGENDA * 86_400_000;",
    "const MES = DIAS_DO_MES_MEDIO * 86_400_000;",
    "const trintaDias = new Date(agora.getTime() - DIAS_DA_JANELA_DE_RECUSAS * 86_400_000).toISOString();",
    "return agora.getTime() - Date.parse(designadoEm) >= horas * 3_600_000;",
    "return Number.isFinite(t) && agora.getTime() >= t + PRAZO_DONO_ACEITAR_HORAS * 3_600_000;",
    "if (x < REGRAS_AGENDA.antecedenciaReagendarHoras * 3_600_000) {",
    "const a = 124 * 3_600_000;",
    "const b = 240 * 60_000;",
    "const c = 24.5 * fator;",
    "const d = 0.72 * fator;",
    "const e = fator * 724;",
    "const f = lote24 * fator;",
    "const dia = 86_400_000;",
    // A forma em dias: o dia sozinho é a unidade, e o número de dias com nome é o jeito certo (linhas reais de hoje).
    "const DIA = 86_400_000;",
    "const d = new Date(Date.parse(`${hojeBrasilia}T12:00:00-03:00`) + 86_400_000).toISOString().slice(0, 10);",
    "const limite = agora.getTime() - REGRAS_AGENDA.janelaAusenciasDias * 86_400_000;",
    "const dentro = agora.getTime() - t <= c.dias * 86_400_000;",
    "export const prazoRessalva = (emitidoEm: string) => new Date(Date.parse(emitidoEm) + PRAZO_RESSALVA_DIAS * 86_400_000);",
    "const m = 86_400_000 * dias;",
    "const n = lote3 * 86_400_000;",
    "const o = 186_400_000 * fator;",
    // O dia com nome: declarar a unidade e multiplicá-la por um número COM nome é o jeito certo (linhas reais de hoje).
    "const DIA_MS = 86_400_000;",
    "prazo_ate: new Date(agora.getTime() + PRAZO_DEVOLUCAO_DIAS * DIA).toISOString(),",
    "const desde = (d: number) => new Date(agora.getTime() - d * dia).toISOString();",
    "if (Date.parse(em) > Date.parse(x.proposta_aceita_em) + x.prazo_proposto_dias * dia) foraDoPrazo++;",
    "const limite = agora.getTime() - DIAS_DA_JANELA_DE_REPROVACOES * DIA;",
    // Nomes que só se parecem com o dia: o número de dias, uma diária, um campo, uma função.
    "const total = 7 * dias;",
    "const valor = 2 * diaria;",
    "const x = 2 * data.dia;",
    "const y = linha.dia * 2;",
    "const z = 3 * dia(agora);",
    "const k = 2 * meioDia;",
  ];
  for (const linha of passam) assert.equal(prazoAMao(linha), false, `não pode cair: ${linha}`);
  // E a varredura usa esta regra nas duas leituras (as pastas e as linhas da avaliação nos e-mails).
  const estaTrava = ler("src/lib/vistoria/e1118-prazos-sem-literal.test.ts");
  assert.equal((estaTrava.match(/prazoAMao\(linha\)\) achados\.push/g) ?? []).length, 2);
});

test("E1118 (5, ORDEM-DUET-550 e DUET-1773): as quatro contas em dias que a regra apanhou ganharam nome, com o mesmo valor", async () => {
  // Antes: `30.4375 * 86_400_000` (regras.ts), `7 * 86_400_000` (telas-exibicao.ts) e `30 * 86_400_000` (Central).
  const regras = ler("src/lib/vistoria/regras.ts");
  assert.match(regras, /^const DIAS_DO_MES_MEDIO = 30\.4375;$/m);
  assert.match(regras, /^const MES = DIAS_DO_MES_MEDIO \* 86_400_000;$/m);
  const telas = ler("src/lib/vistoria/telas-exibicao.ts");
  assert.match(telas, /^const DIAS_DA_SEMANA_DA_AGENDA = 7;$/m);
  assert.match(telas, /t <= DIAS_DA_SEMANA_DA_AGENDA \* 86_400_000;/);
  const central = ler("src/app/(dashboard)/admin/avaliadores/page.tsx");
  // E1158 (14; ORDEM-DUET-658): a janela subiu da Central para a fonte das telas — o título, o vazio e o número leem-na.
  assert.match(telas, /^export const DIAS_DA_JANELA_DE_RECUSAS = 30;$/m);
  assert.doesNotMatch(central, /const DIAS_DA_JANELA_DE_RECUSAS\b/);
  assert.match(central, /agora\.getTime\(\) - DIAS_DA_JANELA_DE_RECUSAS \* 86_400_000\)/);
  // DUET-1773: a quarta, o número cru vezes o dia com nome — antes `365 * DIA` (a escada de strikes do proprietário).
  const laudoServidor = ler("src/lib/vistoria/laudo-servidor.ts");
  assert.match(laudoServidor, /^const DIAS_DA_JANELA_DE_REPROVACOES = 365;$/m);
  assert.match(laudoServidor, /agora\.getTime\(\) - DIAS_DA_JANELA_DE_REPROVACOES \* DIA\)/);
  // O comportamento é o mesmo: a "semana" da agenda continua a ser 7 dias, na fronteira exata.
  const { visitaNaSemana } = await import("./telas-exibicao.ts");
  const agora = new Date("2026-11-23T12:00:00Z");
  assert.equal(visitaNaSemana(new Date(agora.getTime() + 7 * DIA).toISOString(), agora), true);
  assert.equal(visitaNaSemana(new Date(agora.getTime() + 7 * DIA + 1).toISOString(), agora), false);
  assert.equal(visitaNaSemana(new Date(agora.getTime() - 12 * 3_600_000).toISOString(), agora), true);
  assert.equal(visitaNaSemana(new Date(agora.getTime() - 12 * 3_600_000 - 1).toISOString(), agora), false);
});

test("E1118 (6; E1158, sub-ponto 20, ORDEM-DUET-659): os prazos em dias e em meses do laudo não estão escritos à mão nos e-mails nem na fila", () => {
  // "15 dias" (ressalva e devolução), "30 dias" (aviso de expiração) e "12 meses" (validade): as fontes são as
  // constantes de laudo.ts. Varre os corpos, as linhas da avaliação na matriz, os rótulos da fila e os motivos que a
  // rotina grava na fila. Fora daqui, de propósito: os textos de tela que explicam a regra (outro item).
  const PRAZO_DO_LAUDO_A_MAO = /\b(15|30)\s?dias\b|\b12\s?meses\b/;
  const achados: string[] = [];
  const varrer = (arq: string, so?: (linha: string) => boolean) =>
    semComentarios(ler(arq))
      .split("\n")
      .forEach((linha, i) => {
        if (so && !so(linha)) return;
        if (PRAZO_DO_LAUDO_A_MAO.test(linha)) achados.push(`${arq}:${i + 1}: ${linha.trim().slice(0, 140)}`);
      });
  varrer("src/lib/vistoria/corpo-email.ts");
  varrer("src/lib/vistoria/rotulos-da-fila.ts");
  varrer("src/lib/notifications/eventos-email.ts", (l) => /^\s*vistoria_\w+: \{/.test(l));
  varrer("src/lib/vistoria/laudo-servidor.ts", (l) => /motivo: /.test(l));
  assert.deepEqual(achados, [], `prazo do laudo escrito à mão:\n${achados.join("\n")}`);
  // A regra apanha o que apanhava antes do item (as cópias que saíram).
  for (const antes of ["o prazo de 15 dias para corrigir", "completa 12 meses em 30 dias", "em até 15 dias; ele confirma", 'motivo: "Ressalva não corrigida em 15 dias"']) assert.ok(PRAZO_DO_LAUDO_A_MAO.test(antes), antes);
  assert.ok(!PRAZO_DO_LAUDO_A_MAO.test("o prazo de ${PRAZO_RESSALVA_DIAS} dias"));
});

