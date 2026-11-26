/*
  E1151 (ORDEM-DUET-641/645; P2+P3+P4 da varredura da classe E1145): os textos da taxa do parceiro saem de UMA fonte,
  src/config/taxa-servico-parceiros.ts. Percentuais sempre de PCT_TAXA_SERVICO_PARCEIROS / PCT_PARCEIRO_RECEBE (nunca
  escritos à mão); a divisão na origem tem uma redacção canónica, com "A Viva não guarda o dinheiro."; as duas aparições
  em /parceiros (secção de regras e formulário) dizem a mesma frase; a constante duplicada PAGAMENTO_EM_BREVE sai.
  O gate de frases recusa as redacções antigas em todo o código de produção.
  Roda: node --test src/lib/parceiros/e1151-fonte-unica-taxa-parceiro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as fonte from "../../config/taxa-servico-parceiros.ts";
import * as regras from "./regras.ts";
import { TEXTO_DIVISAO_NA_ORIGEM as DIVISAO_DO_PEDIDO } from "./pedido.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const F = fonte as unknown as Record<string, unknown>;

test("E1151: a divisão na origem tem uma redacção canónica, feita das constantes", () => {
  const divisao = F.textoDivisaoNaOrigem as (para: "você" | "o parceiro") => string;
  assert.equal(typeof divisao, "function", "textoDivisaoNaOrigem existe na fonte");
  const { PCT_PARCEIRO_RECEBE: r, PCT_TAXA_SERVICO_PARCEIROS: t } = fonte;
  assert.equal(divisao("você"), `Quando o pagamento pela plataforma estiver ativo, o valor é dividido na origem: ${r} vai direto para você e ${t} para a Viva. A Viva não guarda o dinheiro.`);
  assert.equal(fonte.TEXTO_DIVISAO_NA_ORIGEM, divisao("você"));
  // O pedido (dito ao dono) e a Ajuda (3.ª pessoa) usam a mesma frase, com "o parceiro".
  assert.equal(DIVISAO_DO_PEDIDO, divisao("o parceiro"));
  assert.equal(fonte.TEXTO_TAXA_SERVICO_PARCEIROS, `Taxa de serviço: ${t} sobre o valor do serviço, para todas as categorias. ${divisao("o parceiro")}`);
});

test("E1151: as regras públicas vêm da fonte — a 3.ª regra É a divisão canónica", () => {
  const rc = F.REGRAS_CLARAS as readonly string[];
  assert.ok(Array.isArray(rc), "REGRAS_CLARAS vive na fonte");
  assert.equal(rc[1], `Taxa de serviço: ${fonte.PCT_TAXA_SERVICO_PARCEIROS} sobre o valor do serviço, para todas as categorias. Você só paga quando há serviço contratado.`);
  assert.equal(rc[2], fonte.TEXTO_DIVISAO_NA_ORIGEM);
  // A constante duplicada e a cópia das regras saem de regras.ts.
  assert.equal((regras as Record<string, unknown>).PAGAMENTO_EM_BREVE, undefined);
  assert.equal((regras as Record<string, unknown>).REGRAS_CLARAS, undefined);
});

test("E1151: em /parceiros, a secção de regras e o formulário dizem a MESMA frase da divisão", () => {
  const regrasTsx = ler("src/components/parceiros/regras-parceiros.tsx");
  assert.match(regrasTsx, /import \{[^}]*\bREGRAS_CLARAS\b[^}]*\} from "@\/config\/taxa-servico-parceiros";/);
  assert.match(regrasTsx, /\{TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE\}/);
  const form = semComentarios(ler("src/components/parceiros/seja-parceiro-form.tsx"));
  assert.doesNotMatch(form, /TEXTO_REGRA_90_10/);
  assert.match(form, /data-testid="seja-parceiro-regra-90-10">\s*\{TEXTO_DIVISAO_NA_ORIGEM\}/);
  assert.match(form, /data-testid="seja-parceiro-regra">\{TEXTO_DIVISAO_NA_ORIGEM\}/);
});

function ficheiros(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) ficheiros(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

test("E1151 (gate de frases): nenhuma redacção antiga da taxa do parceiro no código de produção", () => {
  const ANTIGAS = [/não guarda o seu dinheiro/, /direto ao parceiro e/, /% à Viva\./, /Regra 90\/10:/, /TEXTO_REGRA_90_10/];
  const achados: string[] = [];
  for (const f of ficheiros("src")) {
    const s = semComentarios(ler(f));
    for (const re of ANTIGAS) if (re.test(s)) achados.push(`${f}: ${re}`);
  }
  assert.deepEqual(achados, []);
  // Nas regras do parceiro, nenhum percentual escrito à mão.
  for (const f of ["src/lib/parceiros/regras.ts", "src/lib/parceiros/pedido.ts", "src/config/taxa-servico-parceiros.ts"]) {
    assert.doesNotMatch(semComentarios(ler(f)), /["`][^"`]*\b(10|90)%/, `${f}: percentual à mão`);
  }
});
