import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhaLocalizacao } from "../../src/lib/localizacao.ts";

/*
  Lab 10/11 (5eb1fad9): t439 "1. sem UF ... com UF, 'Bairro, Cidade - UF'" gravava state = "MG" direto no banco e
  recarregava UMA vez; a tela seguia "Santa Mônica, Uberlândia". A regra está certa (abaixo); o que mudou é que a
  página pública do imóvel guarda cópia por 60 s (F9: revalidate = 60) e a gravação pela chave de serviço não chama
  revalidatePath. A spec passa a recarregar até a cópia nova entrar (mesmo padrão do t28/t74), com folga de 120 s.
*/
test("t439: a regra da linha de localização segue a do E101", () => {
  assert.equal(linhaLocalizacao("Santa Mônica", "Uberlândia", ""), "Santa Mônica, Uberlândia");
  assert.equal(linhaLocalizacao("Santa Mônica", "Uberlândia", "MG"), "Santa Mônica, Uberlândia - MG");
});

test("t439: a página do imóvel tem cache de 60 s, e a spec recarrega até a UF aparecer", () => {
  const pagina = readFileSync("src/app/(public)/imoveis/[id]/page.tsx", "utf8");
  assert.match(pagina, /export const revalidate = 60;/);
  const spec = readFileSync("tests/e2e/specs/t439-e101-deteccao-espelho.spec.ts", "utf8");
  const teste1 = spec.slice(spec.indexOf('test("1. sem UF'), spec.indexOf("for (const w of LARGURAS)"));
  assert.match(teste1, /toPass\(\{[^}]*timeout: 120_000/);
  assert.match(teste1, /await page\.reload\(\{ waitUntil: "domcontentloaded" \}\);\s*await expect\(page\.locator\("main"\)\)\.toContainText\("Santa Mônica, Uberlândia - MG", \{ timeout: 5_000 \}\);/);
});
