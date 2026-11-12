/* Roda: node --test src/lib/parceiros/e791-prazo-resposta.test.ts
   E791: /parceiros não dizia o prazo de resposta ao pedido de parceria, e /empresas promete 7 dias (E770, provado). Decisão da
   vigia (12/11): /parceiros exibe o MESMO prazo de 7 dias. Um prazo só, numa fonte só, em todas as superfícies do pedido de
   parceria (página, formulário depois de enviar e onboarding). O alerta interno à equipe (1 dia útil) fica mais curto. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRAZO_RESPOSTA_PARCERIA, TEXTO_PRAZO_PARCERIA } from "./regras.ts";
import { parceiroSemResposta } from "../lembretes/regras.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const PAGINA = ler("src/app/(public)/parceiros/page.tsx");

test("o prazo é um só: 7 dias, o mesmo de /empresas; o alerta interno à equipe segue em 1 dia útil (antes da promessa)", () => {
  assert.equal(PRAZO_RESPOSTA_PARCERIA, "7 dias");
  assert.equal(TEXTO_PRAZO_PARCERIA, "A Viva responde por e-mail em até 7 dias.");
  const empresas = ler("src/app/(public)/empresas/page.tsx");
  assert.match(empresas, /Respondemos em até 7 dias/, "a promessa de /empresas (E770) é a mesma");
  // o alerta à equipe nasce depois de 1 dia útil sem decisão — bem antes do prazo público
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
  assert.doesNotMatch(PAGINA, /1 dia útil/, "nenhum prazo antigo solto na página");
});

test("formulário (pedido enviado) e onboarding usam a MESMA fonte, sem o texto solto", () => {
  const form = ler("src/components/parceiros/seja-parceiro-form.tsx");
  assert.match(form, /pendente: `Aguardando aprovação da Viva\. Resposta em até \$\{PRAZO_RESPOSTA_PARCERIA\}, por e-mail\.`/);
  const onboarding = ler("src/lib/onboarding/ativacao.ts");
  assert.match(onboarding, /`Em análise\. Resposta em até \$\{PRAZO_RESPOSTA_PARCERIA\}\.`/);
  for (const [nome, src] of [["form", form], ["onboarding", onboarding], ["página", PAGINA]] as const)
    assert.doesNotMatch(src, /"[^"]*(1 dia útil|7 dias)[^"]*"/, `${nome}: o prazo não fica escrito à mão`);
});
