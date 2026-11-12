/* Roda: node --test src/lib/parceiros/e791-prazo-resposta.test.ts
   E791: /parceiros não dizia o prazo de resposta ao pedido de parceria; o formulário (depois de enviar) e o onboarding
   prometiam "1 dia útil", e a equipe recebe alerta quando passa de 1 dia útil sem decisão. Um prazo só, numa fonte só,
   em todas as superfícies do pedido de parceria. (/empresas promete 7 dias para OUTRA coisa: o pedido de empresa.) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRAZO_RESPOSTA_PARCERIA, TEXTO_PRAZO_PARCERIA } from "./regras.ts";
import { parceiroSemResposta } from "../lembretes/regras.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const PAGINA = ler("src/app/(public)/parceiros/page.tsx");

test("o prazo é um só: 1 dia útil, o mesmo que dispara o alerta da equipe", () => {
  assert.equal(PRAZO_RESPOSTA_PARCERIA, "1 dia útil");
  assert.equal(TEXTO_PRAZO_PARCERIA, "A Viva responde por e-mail em até 1 dia útil.");
  // segunda 10h → terça 10h é 1 dia útil: ainda no prazo; terça 11h já passou (o alerta só nasce depois do prazo público)
  const pedido = "2026-11-09T13:00:00Z";
  assert.equal(parceiroSemResposta(pedido, null, new Date("2026-11-10T12:59:00Z")), false);
  assert.equal(parceiroSemResposta(pedido, null, new Date("2026-11-10T14:00:00Z")), true);
});

test("/parceiros mostra o prazo no passo 'A Viva confere' e no 'Seja parceiro' (antes: nenhum)", () => {
  assert.match(PAGINA, /import \{[^}]*TEXTO_PRAZO_PARCERIA[^}]*\} from "@\/lib\/parceiros\/regras"/);
  const passo = PAGINA.slice(PAGINA.indexOf('t: "A Viva confere"'), PAGINA.indexOf('t: "Receba pedidos"'));
  assert.match(passo, /TEXTO_PRAZO_PARCERIA/);
  const seja = PAGINA.slice(PAGINA.indexOf('id="h-form"'), PAGINA.indexOf('id="h-duvidas"'));
  assert.match(seja, /data-testid="parceiros-prazo-resposta"[^>]*>\s*\{TEXTO_PRAZO_PARCERIA\}/);
  assert.doesNotMatch(PAGINA, /7 dias/, "o prazo de /empresas é de outro pedido e não entra aqui");
});

test("formulário (pedido enviado) e onboarding usam a MESMA fonte, sem o texto solto", () => {
  const form = ler("src/components/parceiros/seja-parceiro-form.tsx");
  assert.match(form, /pendente: `Aguardando aprovação da Viva\. Resposta em até \$\{PRAZO_RESPOSTA_PARCERIA\}, por e-mail\.`/);
  const onboarding = ler("src/lib/onboarding/ativacao.ts");
  assert.match(onboarding, /`Em análise\. Resposta em até \$\{PRAZO_RESPOSTA_PARCERIA\}\.`/);
  for (const [nome, src] of [["form", form], ["onboarding", onboarding], ["página", PAGINA]] as const)
    assert.doesNotMatch(src, /"[^"]*1 dia útil[^"]*"/, `${nome}: o prazo não fica escrito à mão`);
});
