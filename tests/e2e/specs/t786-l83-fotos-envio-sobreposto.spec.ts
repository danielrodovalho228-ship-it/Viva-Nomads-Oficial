import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T786 — L-83 (Pista C, 31/10). Diagnóstico da falha conhecida da t204 · "fotos: Adicionar, arrastar e soltar" (390 e
  1280, intermitente em quase todo laboratório completo de 30–31/10: "8 / 8 fotos" não chega, a galeria fica com 1 foto,
  ou o aviso da IA não aparece).
  Causa no código: `PhotoUploader.handleFiles` (src/components/photo-uploader.tsx) monta a galeria nova com a lista
  `photos` do momento em que o envio COMEÇOU (`onChange(comPrincipalBoa([...photos, ...novas]))`). Se o dono solta (ou
  escolhe) fotos enquanto outro envio ainda corre, os dois envios partem da mesma lista e o que termina por último
  sobrescreve o outro: as fotos de um dos lotes somem da galeria (e do rascunho). Em produção, é o dono que arrasta mais
  fotos sem esperar o primeiro lote — e perde fotos sem aviso.
  O passo a passo: rascunho sem fotos no Passo 2; escolher 7 fotos e, sem esperar, soltar mais 1 na galeria. Esperado:
  8 fotos na galeria. Hoje: 7 ou 1. `test.fail` até a correção (por exemplo, juntar as novas na lista ATUAL — `onChange`
  com função ou uma ref — ou travar a galeria durante o envio, com aviso). A t204 deixou de soltar durante o envio.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t786.${sufixo}@lab.vivanomads.test`, nome: "Fábio Fotos", role: "owner" as const };
const ids: { dono?: string; rascunho: Record<number, string> } = { rascunho: {} };

test.describe("T786 — L-83: um segundo envio de fotos durante o primeiro não pode apagar fotos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const l of [1280, 390]) ids.rascunho[l] = await prepararRascunho(ids.dono, `Studio t786 ${l} ${sufixo}`, {}, 0);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: 7 fotos escolhidas e, durante o envio, mais 1 solta na galeria → 8 fotos`, async ({ browser }) => {
      test.fail(true, "L-83: o envio que termina por último sobrescreve a galeria com a lista antiga (fotos perdidas)");
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho[largura], "fotos", largura);
      // A conferência da IA não entra aqui: responde "indisponível" na hora, para o teste medir só o envio.
      await p.route("**/api/ai/fotos", (r) => r.fulfill({ status: 503, json: { error: "Leitura indisponível agora.", motivo: "indisponivel" } }));
      const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.getByTestId("fotos-adicionar").click()]);
      await chooser.setFiles([1, 2, 3, 4, 5, 6, 7].map((n) => ({ name: `foto-${n}.png`, mimeType: "image/png", buffer: pngDeTeste(n + 30 * largura) })));
      // Sem esperar o lote: solta a 8ª na galeria logo que o envio começa.
      const png8 = pngDeTeste(8 + 30 * largura).toString("base64");
      await p.getByTestId("fotos-galeria").evaluate((alvo, b64) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], "foto-8.png", { type: "image/png" }));
        alvo.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
        alvo.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
      }, png8);
      // Os dois envios terminam (a contagem sem fotos em envio é a da galeria) e a galeria tem as 8.
      const fotos = p.getByTestId("fotos-galeria").locator('[data-testid="foto-principal"], [data-testid="foto-miniatura"]');
      await expect(fotos).toHaveCount(8, { timeout: 60_000 });
      await p.context().close();
    });
  }
});
