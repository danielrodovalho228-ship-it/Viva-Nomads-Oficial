/*
  E648 — consequências práticas (decisão do Daniel, 06/11/2026: CNPJ para TODOS os parceiros; CPF não é aceito).
  (a) O caminho PF de "recibo de serviço" (prefixo RSV) fica DESATIVADO: o prefixo é só reservado (nenhum gerador o usa), e
      parceiro PF não gera "recibo" ao cliente; o documento do serviço é nota (PJ que emite) ou nada.
  (b) Cadastro de parceiro com CPF já existente segue VISÍVEL no admin (com o aviso), mas NÃO recebe serviço até apresentar
      CNPJ: nenhum dos caminhos de entrada de serviço (orçamento, vínculo fixo, convite aceito, pedido automático) o alcança.
  Roda: node --test src/lib/parceiros/e648-sem-cnpj-sem-servico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { documentoDoServico } from "./fiscal.ts";
import { PREFIXOS } from "../fiscal/prefixos.ts";

const RAIZ = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) acc.push(p);
  }
  return acc;
}

test("(a) parceiro PF não gera 'recibo' ao cliente: o documento do serviço é nota (PJ que emite) ou nada", () => {
  assert.equal(documentoDoServico({ tipoPessoa: "pf", emiteNota: null }), null);
  assert.equal(documentoDoServico({ tipoPessoa: "pf", emiteNota: true }), null);
  assert.equal(documentoDoServico({ tipoPessoa: "pj", emiteNota: true }), "nota");
  assert.equal(documentoDoServico({ tipoPessoa: "pj", emiteNota: false }), null);
});

test("(a) o prefixo RSV (recibo de serviço do parceiro PF) é só reservado e NENHUM código o gera", () => {
  assert.equal("reservado" in PREFIXOS.RSV && PREFIXOS.RSV.reservado, true);
  for (const f of arquivos(join(RAIZ, ""))) {
    const t = semComentarios(readFileSync(f, "utf8"));
    assert.doesNotMatch(t, /prefixo:\s*["']RSV["']/, `${f} gera RSV`);
  }
  const pref = ler("lib/fiscal/prefixos.ts");
  assert.match(pref, /DESATIVADO \(E648\)/, "o motivo está escrito junto do prefixo");
});

test("(b) CPF já cadastrado: visível no admin com o aviso, mas fora de todo caminho de serviço", () => {
  const ficha = ler("app/(dashboard)/admin/parceiros/fichas.tsx");
  assert.match(ficha, /data-testid="ficha-sem-cnpj"/);
  assert.match(ficha, /PENDENCIA_CNPJ|Sem CNPJ/);
  // Os quatro caminhos de entrada de serviço conferem o CNPJ.
  const orc = ler("lib/parceiros/pedido-actions.ts");
  assert.match(orc, /parceiroPodeReceberServico\(parceiro\.tipo_pessoa\)/);
  const acoes = ler("lib/automacao/acoes.ts");
  assert.equal((acoes.match(/parceiroPodeReceberServico\(/g) ?? []).length >= 2, true, "convite fixo e aceite do convite");
  assert.match(acoes, /select\("id, user_id, status, categorias, nome_publico, tipo_pessoa"\)/);
  const auto = ler("lib/automacao/servidor.ts");
  assert.match(auto, /parceiroPodeReceberServico\(parceiro\.tipo_pessoa\)/);
  assert.match(auto, /select\("id, user_id, status, tipo_pessoa"\)/);
});
