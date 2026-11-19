import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2147 — E632 @E632: no leitor de e-mails de QA, cada versão HTML diz de QUAL e-mail é.
  Regra decidida (E632; unitário src/lib/notifications/e632-proposta-sem-bloco-de-visita.test.ts): a tela guarda o HTML
  de vários e-mails na mesma página (um iframe por e-mail). Quem lia o DOM atribuía o bloco "Sua visita é hoje" de um
  e-mail de visita ao e-mail da proposta. Agora cada iframe leva o título "Versão HTML do e-mail: <assunto>" e o
  data-email-id do próprio e-mail, e o HTML de cada um fica só no seu iframe.
  A prova: dois e-mails da mesma conta de teste, na caixa de testes (emails_teste) — uma proposta (sem bloco de visita)
  e uma véspera de visita ("Sua visita é hoje"). Uma conta de teste com a marca de leitor de QA abre /dashboard/qa/emails
  filtrada por essa conta, a 390 e a 1280 px: cada iframe tem o título com o SEU assunto e o id da SUA linha, e o
  "Sua visita é hoje" está só no iframe da visita.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const leitor = { email: `qa.t2147.${sufixo}@lab.vivanomads.test`, nome: "Leitora Tânia", role: "owner" as const };
const alvo = { email: `alvo.t2147.${sufixo}@lab.vivanomads.test`, nome: "Alvo Ulisses", role: "tenant" as const };
const ids: Record<string, string> = {};
const EVENTO_PROPOSTA = `lab2147_proposta_${sufixo}`;
const EVENTO_VISITA = `lab2147_visita_${sufixo}`;
const ASSUNTO_PROPOSTA = `Proposta de Apto da revisão ${sufixo}`;
const ASSUNTO_VISITA = `Sua visita é amanhã: Apto da revisão ${sufixo}`;
const MARCA_VISITA = "Sua visita é hoje";

async function abrir(browser: Browser, largura: number) {
  const p = await entrar(browser, leitor.email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return p;
}

test.describe("T2147 — E632: cada versão HTML do leitor de QA diz de qual e-mail é @E632", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.leitor = await criarConta(leitor, senha);
    ids.alvo = await criarConta(alvo, senha);
    await adm().from("profiles").update({ is_teste: true, qa_leitor: true }).eq("id", ids.leitor);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.alvo);
    const { data, error } = await adm()
      .from("emails_teste")
      .insert([
        { evento: EVENTO_PROPOSTA, assunto: ASSUNTO_PROPOSTA, corpo: "Você recebeu uma proposta.", destinatario_mascarado: "a•••@lab.vivanomads.test", usuario_id: ids.alvo, html: `<html><body><p>Você recebeu uma proposta de Apto da revisão ${sufixo}.</p></body></html>` },
        { evento: EVENTO_VISITA, assunto: ASSUNTO_VISITA, corpo: "Lembrete da visita.", destinatario_mascarado: "a•••@lab.vivanomads.test", usuario_id: ids.alvo, html: `<html><body><h2>${MARCA_VISITA}</h2><p>Visita em Apto da revisão ${sufixo}.</p></body></html>` },
      ])
      .select("id, evento");
    if (error) throw error;
    for (const l of (data ?? []) as { id: string; evento: string }[]) ids[l.evento === EVENTO_PROPOSTA ? "proposta" : "visita"] = l.id;
  });

  test.afterAll(async () => {
    await adm().from("emails_teste").delete().in("evento", [EVENTO_PROPOSTA, EVENTO_VISITA]);
    await apagarContas([ids.leitor, ids.alvo]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — cada iframe tem o título com o seu assunto e o id da sua linha; "${MARCA_VISITA}" só no da visita`, async ({ browser }) => {
      const p = await abrir(browser, largura);
      const r = await p.goto(`/dashboard/qa/emails?conta=${ids.alvo}`, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      await expect(p.getByTestId("qa-emails")).toBeVisible({ timeout: 20_000 });

      const proposta = p.locator(`iframe[data-email-id="${ids.proposta}"]`).first();
      const visita = p.locator(`iframe[data-email-id="${ids.visita}"]`).first();
      await expect(proposta, "o HTML da proposta tem o seu iframe").toHaveCount(1, { timeout: 20_000 });
      await expect(visita, "o HTML da visita tem o seu iframe").toHaveCount(1);

      await expect(proposta, "o título diz que é o HTML da proposta").toHaveAttribute("title", `Versão HTML do e-mail: ${ASSUNTO_PROPOSTA}`);
      await expect(visita, "o título diz que é o HTML da visita").toHaveAttribute("title", `Versão HTML do e-mail: ${ASSUNTO_VISITA}`);

      const htmlProposta = (await proposta.getAttribute("srcdoc")) ?? "";
      const htmlVisita = (await visita.getAttribute("srcdoc")) ?? "";
      expect(htmlVisita, "o bloco de visita está no iframe da visita").toContain(MARCA_VISITA);
      expect(htmlProposta, "o iframe da proposta não traz o bloco de visita").not.toContain(MARCA_VISITA);
      await p.context().close();
    });
  }
});
