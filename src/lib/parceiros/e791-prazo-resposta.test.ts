/* Roda: node --test src/lib/parceiros/e791-prazo-resposta.test.ts
   E791: /parceiros não dizia o prazo de resposta ao pedido de parceria, e /empresas promete 7 dias (E770, provado). Decisão da
   vigia (12/11): /parceiros exibe o MESMO prazo de 7 dias. Um prazo só, numa fonte só, em todas as superfícies do pedido de
   parceria: página, formulário depois de enviar, onboarding E o alerta à equipe (que disparava em 1 dia útil). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DIAS_RESPOSTA_PARCERIA, PRAZO_RESPOSTA_PARCERIA, TEXTO_PRAZO_PARCERIA } from "./regras.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";
import { juntarParcerias } from "../admin/decisoes-admin.ts";
import { parceiroSemResposta } from "../lembretes/regras.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const PAGINA = ler("src/app/(public)/parceiros/page.tsx");

test("o prazo é um só: 7 dias, o mesmo de /empresas", () => {
  assert.equal(DIAS_RESPOSTA_PARCERIA, 7);
  assert.equal(PRAZO_RESPOSTA_PARCERIA, "7 dias");
  assert.equal(TEXTO_PRAZO_PARCERIA, "A Viva responde por e-mail em até 7 dias.");
  assert.match(ler("src/app/(public)/empresas/page.tsx"), /Respondemos em até 7 dias/, "a promessa de /empresas (E770) é a mesma");
});

test("o alerta à equipe dispara no MESMO prazo (7 dias), não em 1 dia útil", () => {
  const pedido = "2026-11-09T13:00:00Z"; // segunda 10h (Brasília)
  // Antes: terça 14h (1 dia útil depois) já disparava — com a promessa pública ainda em pé.
  assert.equal(parceiroSemResposta(pedido, null, new Date("2026-11-10T14:00:00Z")), false, "1 dia depois: ainda dentro dos 7 dias");
  assert.equal(parceiroSemResposta(pedido, null, new Date("2026-11-16T12:59:00Z")), false, "6 dias e 23h59: ainda no prazo");
  assert.equal(parceiroSemResposta(pedido, null, new Date("2026-11-16T13:01:00Z")), true, "passou dos 7 dias: alerta");
  assert.equal(parceiroSemResposta(pedido, "2026-11-10T09:00:00Z", new Date("2026-11-20T00:00:00Z")), false, "decidida: sem alerta");
  // O aviso do cron, o e-mail e a fila de decisões do admin falam o mesmo prazo, da mesma fonte.
  assert.match(ler("src/lib/lembretes/regras.ts"), /DIAS_RESPOSTA_PARCERIA \* 24 \* H/);
  assert.match(ler("src/lib/lembretes/servidor.ts"), /`Solicitação de parceria sem resposta há mais de \$\{PRAZO_RESPOSTA_PARCERIA\}\.`/);
  const email = TEMPLATES.parceiro_sem_resposta;
  assert.equal(email.subject, "Solicitação de parceria sem resposta há 7 dias");
  assert.equal(juntarParcerias({ parceiros_para_aprovar: { n: 2 }, parceiros_sem_resposta_1_dia: { n: 1 } }).parceiros_para_aprovar?.detalhe, "1 sem resposta há mais de 7 dias");
  for (const f of ["src/lib/lembretes/servidor.ts", "src/lib/notifications/eventos-email.ts", "src/lib/admin/decisoes-admin.ts"])
    assert.doesNotMatch(ler(f).split("\n").filter((l) => /parceri/i.test(l)).join("\n"), /1 dia útil/, `${f}: a parceria não fala mais em 1 dia útil`);
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
