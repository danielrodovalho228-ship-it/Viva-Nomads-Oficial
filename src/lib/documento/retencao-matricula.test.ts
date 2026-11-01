/*
  E293 P1 — a matrícula guarda só o veredito. Antes, property_ownership_checks guardava o nome de cada proprietário, o
  final do CPF/CNPJ, o endereço, a unidade, as áreas, a vaga e o credor de cada ônus, e nada disso saía quando o arquivo
  era eliminado. Agora: só o veredito por proprietário; ônus sem credor; e, quando o arquivo sai, saem também os campos
  lidos, os ônus, o número da matrícula e o cartório. (As 3 linhas antigas em produção NÃO são limpas aqui: isso é
  apagar dado existente e fica listado, esperando.)
  Roda: node --test src/lib/documento/retencao-matricula.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { camposParaGravar, LIMPEZA_MATRICULA_ELIMINADA, onusParaGravar, type LeituraMatricula } from "./conferencia-matricula.ts";
import { proprietariosParaAdmin } from "./fila-matricula.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

const leitura: LeituraMatricula = {
  numero: "12345",
  cartorio: "2º Registro de Imóveis",
  endereco: { rua: "Rua das Flores", numero: "100", bairro: "Centro", cidade: "Curitiba", uf: "PR", cep: "80000000" },
  unidade: "Apto 51",
  areaPrivativa: 62.5,
  areaTotal: 80,
  vaga: "1 vaga",
  proprietarios: [{ nome: "Maria Souza", documento: "11144477735", fracao: "50%" }],
  dataUltimoAto: "2024-03-10",
  onus: [{ tipo: "alienacao_fiduciaria", credor: "Caixa Econômica Federal", emFavorDeTerceiro: false }],
  legivel: true,
  sinaisDeEdicao: [],
  baixaConfianca: false,
};

test("campos gravados: só o veredito por proprietário e quantos são — sem nome, documento, endereço, áreas nem vaga", () => {
  const g = camposParaGravar(leitura, [
    { nome: "Maria Souza", documentoFinal: "735", documentoConfere: false, nomeConfere: false, fracao: "50%" },
    { nome: "Dora Lima", documentoFinal: "001", documentoConfere: true, nomeConfere: true, fracao: "50%" },
  ]);
  assert.deepEqual(g, {
    data_ultimo_ato: "2024-03-10",
    proprietarios_qtd: 2,
    proprietarios: [
      { documento_confere: false, nome_confere: false, fracao: "50%" },
      { documento_confere: true, nome_confere: true, fracao: "50%" },
    ],
  });
  const json = JSON.stringify(g);
  for (const proibido of ["Maria", "Dora", "735", "001", "Flores", "Curitiba", "Apto", "62.5", "vaga", "endereco", "area_"]) {
    assert.ok(!json.includes(proibido), proibido);
  }
});

test("ônus gravados: o tipo e se é em favor de terceiro — sem o credor", () => {
  assert.deepEqual(onusParaGravar(leitura.onus), [{ tipo: "alienacao_fiduciaria", emFavorDeTerceiro: false }]);
  assert.ok(!JSON.stringify(onusParaGravar(leitura.onus)).includes("Caixa"));
  const rota = ler("src/app/api/documentos/conferir/route.ts");
  assert.match(rota, /onus: mat \? onusParaGravar\(mat\.onus\) : \[\],/);
  assert.doesNotMatch(rota, /onus: mat\?\.onus/);
});

test("quando o arquivo sai, saem campos lidos, ônus, número da matrícula e cartório (fica o veredito)", () => {
  assert.deepEqual(LIMPEZA_MATRICULA_ELIMINADA, { campos_extraidos: {}, onus: [], matricula_numero: null, cartorio: null });
  const min = ler("src/lib/minimizacao/servidor.ts");
  assert.match(min, /\.update\(\{ \.\.\.LIMPEZA_MATRICULA_ELIMINADA, arquivo_path: null, caso_documento_path: null, arquivo_eliminado_em:/);
  // O inventário diz a verdade sobre o que fica.
  const inv = ler("src/config/retencao.ts");
  assert.match(inv, /"property_ownership_checks".*sem nome nem CPF.*sem credor/);
});

test("fila da equipe: linha nova mostra o veredito sem nome; linha antiga segue legível", () => {
  assert.deepEqual(
    proprietariosParaAdmin({ proprietarios: [{ documento_confere: false, nome_confere: false, fracao: "50%" }, { documento_confere: null, nome_confere: true, fracao: null }] }),
    ["Proprietário 1 · CPF/CNPJ não confere · nome diferente · 50%", "Proprietário 2 · sem CPF · nome igual ao do perfil"],
  );
  assert.deepEqual(proprietariosParaAdmin({ proprietarios: [{ nome: "JOSE SILVA", documento_final: null, documento_confere: null, nome_confere: true, fracao: null }] }), [
    "JOSE SILVA · sem CPF · nome igual ao do perfil",
  ]);
});
