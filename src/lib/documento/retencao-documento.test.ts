/*
  E293 P2 — o documento do imóvel (IPTU, conta, contrato) sem a leitura bruta. Antes, qualification_checklists.conferencia
  guardava a saída inteira do modelo (`leitura`): titular, trecho do CPF/CNPJ, endereço, data, nomes listados e o texto
  dos sinais de edição. Agora guarda só sim/não e contagens (`lido`). A equipe lê o próprio documento pelo link curto.
  (As 3 linhas antigas com `leitura` em produção NÃO são limpas aqui: apagar dado existente fica listado, esperando.)
  Roda: node --test src/lib/documento/retencao-documento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decidirConferencia, leituraParaGravar, lidoParaAdmin, type LeituraDocumento } from "./conferencia.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

const leitura: LeituraDocumento = {
  tipo: "iptu",
  titular: "Dora Lima",
  cpfCnpjParcial: "444777",
  endereco: { rua: "Rua das Flores", numero: "100", bairro: "Centro", cidade: "Curitiba", cep: "80000000" },
  dataDocumento: "2026",
  legivel: true,
  completo: true,
  sinaisDeEdicao: ["fonte diferente no número"],
  proprietariosListados: ["Dora Lima", "Rui Lima"],
  baixaConfianca: false,
};

test("gravado: só sim/não e contagens — nenhum nome, documento, endereço, data nem texto do modelo", () => {
  const r = decidirConferencia(leitura, {
    nomeConta: "Dora Lima",
    endereco: { rua: "Rua das Flores", numero: "100", bairro: "Centro", cidade: "Curitiba", cep: "80000000" },
    duplicado: 0,
    hoje: "2026-11-01",
  } as Parameters<typeof decidirConferencia>[1]);
  const g = leituraParaGravar(leitura, r.checklist);
  assert.deepEqual(g, {
    tipo: "iptu",
    legivel: true,
    completo: true,
    titularConfere: r.checklist.titular,
    enderecoConfere: r.checklist.imovel,
    sinaisDeEdicao: 1,
    baixaConfianca: false,
  });
  const json = JSON.stringify(g);
  for (const proibido of ["Dora", "Rui", "444777", "Flores", "Curitiba", "80000000", "2026", "fonte"]) assert.ok(!json.includes(proibido), proibido);
  assert.equal(leituraParaGravar(null, r.checklist), null);
});

test("a rota grava `lido` (veredito), nunca `leitura` crua", () => {
  const rota = ler("src/app/api/documentos/conferir/route.ts");
  const bloco = rota.slice(rota.indexOf("const { leitura, conferidor, modelo } = lida;"));
  assert.match(bloco, /lido: leituraParaGravar\(leitura, r\.checklist\),/);
  assert.doesNotMatch(bloco.slice(0, bloco.indexOf("if (erroIns)")), /^\s*leitura,\s*$/m);
});

test("fila da equipe: a trilha nova vira palavras de veredito; a antiga continua lida", () => {
  assert.deepEqual(lidoParaAdmin({ tipo: "iptu", legivel: true, completo: true, titularConfere: false, enderecoConfere: true, sinaisDeEdicao: 2 }), {
    tipo: "iptu",
    titular: "titular diferente",
    endereco: "endereço confere",
    data: "legível e completo",
    cpf: null,
    sinais: ["2 sinal(is) de edição"],
  });
  const adm = ler("src/lib/data/documentos-admin.ts");
  assert.match(adm, /leitura: lido\n\s*\? lidoParaAdmin\(lido\)\n\s*: l\n/);
});
