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

const RAIZ = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");
/** Tira os comentários (de linha, de bloco e de JSX). Um `/*` no meio de uma string (accept="image/*") não abre bloco. */
const semComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|\n)[ \t]*\/\*[\s\S]*?\*\//g, "$1")
    .replace(/(^|[\s;,{(])\/\/[^\n]*/g, "$1");

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
const prazoAMao = (linha: string) => LITERAL.test(linha) || ARITMETICO.test(linha);

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
  assert.match(ev("vistoria_designado_dono"), /você tem 72 horas depois/);
  assert.match(ev("vistoria_agendada"), /Reagendar sem custo: uma vez, com pelo menos 24 horas de aviso\./);
  // O texto de reserva (sem os fatos do pedido) diz os mesmos prazos.
  assert.match(TEMPLATES.vistoria_designada.body("Lara"), /\(padrão: 24 horas\)/);
  assert.match(TEMPLATES.vistoria_designado_dono.body("Lara"), /você tem 72 horas depois da proposta/);
  assert.match(TEMPLATES.vistoria_agendada.body("Lara"), /com pelo menos 24 horas de aviso\./);
  const cedo = podeReagendar(new Date(Date.parse("2026-11-22T12:00:00Z") + 23 * 3_600_000).toISOString(), new Date("2026-11-22T12:00:00Z"), false);
  assert.deepEqual(cedo, { ok: false, motivo: "Reagendar sem custo só com pelo menos 24 horas de aviso." });
  // No código, os textos levam a constante (não o número).
  const email = ler("src/lib/vistoria/corpo-email.ts");
  assert.match(email, /\(padrão: \$\{PRAZO_RESPOSTA_PADRAO_HORAS\} horas\)/);
  assert.match(email, /você tem \$\{PRAZO_DONO_ACEITAR_HORAS\} horas depois/);
  assert.match(email, /com pelo menos \$\{REGRAS_AGENDA\.antecedenciaReagendarHoras\} horas de aviso/);
  assert.match(ler("src/lib/vistoria/actions.ts"), /no prazo que declarou \(padrão: \$\{PRAZO_RESPOSTA_PADRAO_HORAS\} horas\)/);
  const lista = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
  assert.match(lista, /name="prazoRespostaHoras" type="number" min=\{1\} max=\{PRAZO_RESPOSTA_MAX_HORAS\} defaultValue=\{cred\.prazo_resposta_horas \?\? PRAZO_RESPOSTA_PADRAO_HORAS\}/);
});

test("E1118 (4, ORDEM-DUET-547): a varredura apanha o prazo em forma aritmética — e só ele", () => {
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
  ];
  for (const linha of caem) assert.ok(prazoAMao(linha), `tem de cair: ${linha}`);
  // O que NÃO pode cair: outras regras (3 h, 12 h, 7 e 30 dias), números que só contêm 24 ou 72, e a conta feita com
  // a constante — que é o jeito certo.
  const passam = [
    "const alvo = new Date(Date.parse(agendadoPara) - 3 * 3_600_000).toISOString().slice(0, 10);",
    "return t >= -12 * 3_600_000 && t <= 7 * 86_400_000;",
    "const MES = 30.4375 * 86_400_000;",
    "const trintaDias = new Date(agora.getTime() - 30 * 86_400_000).toISOString();",
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
  ];
  for (const linha of passam) assert.equal(prazoAMao(linha), false, `não pode cair: ${linha}`);
  // E a varredura usa esta regra nas duas leituras (as pastas e as linhas da avaliação nos e-mails).
  const estaTrava = ler("src/lib/vistoria/e1118-prazos-sem-literal.test.ts");
  assert.equal((estaTrava.match(/prazoAMao\(linha\)\) achados\.push/g) ?? []).length, 2);
});
