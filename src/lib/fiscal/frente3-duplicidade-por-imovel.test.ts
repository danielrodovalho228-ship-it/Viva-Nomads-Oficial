/*
  Frente 3 (admin, t227): a guarda do E546 (009951373) comparava o imóvel pelo TEXTO do endereço do documento. Dois imóveis
  diferentes do mesmo dono com o mesmo endereço em texto (sem o exato preenchido: "Centro, Uberlândia/MG"; ou dois
  apartamentos do mesmo prédio sem o complemento) viravam "duplicidade" e o 2º recibo legítimo não saía. O caso do E546
  (mesmo imóvel em dois contratos — o encerrado e o refeito) continua barrado: a comparação passa a ser pelo imóvel do
  contrato; o texto do endereço só vale para documento antigo sem imóvel conhecido.
  Roda: node --test src/lib/fiscal/frente3-duplicidade-por-imovel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { duplicidadeDeRecibo } from "./duplicidade.ts";

const base = { ownerId: "dono", tenantId: "mor", imovelEndereco: "Centro, Uberlândia/MG", valor: 6400, periodoInicio: "2026-11-12", periodoFim: "2027-01-10" };

test("imóveis DIFERENTES com o mesmo endereço em texto não são duplicidade", () => {
  const emitido = { ...base, propertyId: "imovel-A", numero: "REC-1" };
  assert.equal(duplicidadeDeRecibo({ ...base, propertyId: "imovel-B" }, [emitido]), null);
});

test("o MESMO imóvel em dois contratos (o caso do E546) continua duplicidade", () => {
  const emitido = { ...base, propertyId: "imovel-A", numero: "REC-1" };
  assert.equal(duplicidadeDeRecibo({ ...base, propertyId: "imovel-A" }, [emitido])?.numero, "REC-1");
});

test("documento antigo sem imóvel conhecido: vale o texto do endereço, como antes", () => {
  const emitido = { ...base, propertyId: null, numero: "REC-1" };
  assert.equal(duplicidadeDeRecibo({ ...base, propertyId: "imovel-A" }, [emitido])?.numero, "REC-1");
});

test("a emissão lê o imóvel do contrato do documento novo e dos já emitidos", () => {
  const emitir = readFileSync("src/lib/fiscal/emitir.ts", "utf8");
  assert.match(emitir, /contratos\(property_id\)/);
  assert.match(emitir, /propertyId: partes\.propertyId/);
});
