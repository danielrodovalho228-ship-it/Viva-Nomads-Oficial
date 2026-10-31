/*
  Admin › Contrato: sem assinatura, dizia só "Nenhuma assinatura ainda."; a conferência sem resposta, "Nenhuma resposta
  ainda.". Agora diz quem falta e como assina (o código por e-mail, que é o fluxo real da assinatura).
  Roda: node --test src/lib/painel/vazio-admin-contrato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RAIZ = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, RAIZ), "utf8");
const PAGINA = ler("src/app/(dashboard)/admin/contratos/[id]/page.tsx");

test("sem assinatura: quem falta e como assina; conferência sem resposta: das duas partes", () => {
  assert.doesNotMatch(PAGINA, />Nenhuma assinatura ainda\.</);
  assert.doesNotMatch(PAGINA, />Nenhuma resposta ainda\.</);
  assert.match(PAGINA, /data-testid="admin-contrato-sem-assinatura">Nenhuma das partes assinou ainda\. O proprietário e o morador assinam pela página do contrato, cada um com o código que recebe por e-mail\./);
  assert.match(PAGINA, /admin-conferencia-\$\{conf\.tipo\}-sem-resposta/);
});

test("o que o texto promete é o fluxo real: a assinatura manda o código por e-mail", () => {
  assert.match(ler("src/lib/data/contrato-assinar-actions.ts"), /emailCodigoAssinatura\(SITE_URL, \{ imovel: visao\.imovel, codigo \}\)/);
});

test("as specs que conferem 'há assinatura' olham a frase nova (senão passariam sem testar nada)", () => {
  assert.match(ler("tests/e2e/specs/t240-conferencia-provas-admin.spec.ts"), /not\.toContainText\("Nenhuma das partes assinou ainda\."\)/);
  assert.match(ler("tests/e2e/specs/t537-e165-admin-contrato-assinaturas.spec.ts"), /not\.toContain\("Nenhuma das partes assinou ainda\."\)/);
});
