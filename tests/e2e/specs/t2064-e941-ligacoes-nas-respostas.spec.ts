import { test, expect } from "@playwright/test";

/*
  T2064 — E941 (Pista 3; autorizado pelo Gerente em 17/11; regra fechada na ronda 02:55Z) @E941 @ao-vivo-seguro
  Regra decidida: toda resposta da Central de ajuda que NOMEIA um destino (página, fluxo, caminho) tem de LIGÁ-LO
  dentro do próprio texto da resposta (o botão por baixo dela não conta). Resposta que não referencia nada não inventa
  ligação. Hoje: 0 ligações dentro das respostas. Correção do Code 2 (Família 6); esta spec é a trava (vermelha na main
  até a correção entrar). Três asserções por tema (Morador, Contratos, Segurança e conta):
    1. piso — pelo menos uma resposta do tema tem ligação dentro do texto;
    2. toda ligação dentro de uma resposta é real (endereço do site que abre com 200; nunca "#" nem vazio);
    3. as respostas referenciadoras do CATÁLOGO abaixo ligam o destino que nomeiam.
  Catálogo: 9 referências em 8 respostas (texto da main a7330a976, perfil visitante). Ficaram de fora, por não
  nomearem um destino público: "Qual o prazo…", "Como funciona a caução?" (a conferência de saída é do contrato, sem
  página pública), "Posso renovar…" e "Por que não vejo o telefone…".
  Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

type Referencia = { pergunta: RegExp; nomeia: string; destino: RegExp };

const CATALOGO: Record<string, Referencia[]> = {
  morador: [
    { pergunta: /^O morador paga alguma taxa/, nomeia: "publicar um Pedido de Moradia", destino: /^\/pedidos(\/|\?|$)/ },
    { pergunta: /^Como cancelo um Pedido de Moradia/, nomeia: "Em Pedidos de moradia", destino: /^\/pedidos(\/|\?|$)/ },
  ],
  contratos: [
    { pergunta: /^Algo quebrou no imóvel/, nomeia: "Entre na sua conta e abra pelo seu contrato", destino: /^\/(auth|dashboard)(\/|\?|$)/ },
  ],
  seguranca: [
    { pergunta: /^Pediram para eu pagar por fora/, nomeia: "Abra um chamado", destino: /^\/ajuda\/fale-com-a-viva(\/|\?|$)/ },
    { pergunta: /^Como confiro se um documento/, nomeia: "a página Conferir documento", destino: /^\/conferir(\/|\?|$)/ },
    { pergunta: /^Não recebi o código de acesso/, nomeia: "a tela Entrar", destino: /^\/auth(\/|\?|$)/ },
    { pergunta: /^Não recebi o código de acesso/, nomeia: "abra um chamado", destino: /^\/ajuda\/fale-com-a-viva(\/|\?|$)/ },
    { pergunta: /^Esqueci minha senha/, nomeia: "em Entrar", destino: /^\/auth(\/|\?|$)/ },
    { pergunta: /^Como excluo a minha conta/, nomeia: "a página Excluir conta", destino: /^\/excluir-conta(\/|\?|$)/ },
  ],
};

for (const tema of Object.keys(CATALOGO)) {
  test(`T2064 — E941: as respostas do tema ${tema} ligam os destinos que nomeiam @E941 @ao-vivo-seguro`, async ({ page, request }) => {
    const r = await page.goto(`/ajuda/${tema}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    const perguntas = page.getByTestId("ajuda-perguntas").locator("li > button[aria-expanded]");
    await expect(perguntas.first()).toBeVisible({ timeout: 30_000 });
    const n = await perguntas.count();
    expect(n, "o tema tem perguntas").toBeGreaterThan(0);

    const porPergunta = new Map<string, string[]>();
    for (let i = 0; i < n; i++) {
      const botao = perguntas.nth(i);
      const pergunta = (await botao.innerText()).trim();
      // Abre a resposta (repete até a página hidratar).
      await expect(async () => {
        if ((await botao.getAttribute("aria-expanded")) !== "true") await botao.click();
        await expect(botao).toHaveAttribute("aria-expanded", "true", { timeout: 2_000 });
      }).toPass({ timeout: 30_000 });
      // O texto da resposta é o parágrafo logo abaixo da pergunta; as ligações contam só DENTRO dele.
      const resposta = botao.locator("xpath=following-sibling::div[1]").locator("p").first();
      await expect(resposta).toBeVisible();
      porPergunta.set(pergunta, await resposta.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? "")));
    }

    const falhas: string[] = [];
    // 3. Cada resposta referenciadora do catálogo liga o destino que nomeia.
    for (const ref of CATALOGO[tema]) {
      const achada = [...porPergunta.keys()].find((p) => ref.pergunta.test(p));
      if (!achada) {
        falhas.push(`catálogo: a pergunta ${ref.pergunta} sumiu do tema (rever o catálogo)`);
        continue;
      }
      if (!porPergunta.get(achada)!.some((h) => ref.destino.test(h)))
        falhas.push(`"${achada}" nomeia "${ref.nomeia}" e não liga ${ref.destino} (ligações: ${JSON.stringify(porPergunta.get(achada))})`);
    }
    // 1. Piso: ao menos uma resposta do tema com ligação no texto.
    const todas = [...porPergunta.entries()].flatMap(([pergunta, hrefs]) => hrefs.map((href) => ({ pergunta, href })));
    if (todas.length === 0) falhas.push(`piso: nenhuma ligação dentro das ${n} respostas do tema`);
    // 2. Toda ligação é real e abre.
    for (const l of todas) {
      if (!/^\/[^#\s]/.test(l.href)) {
        falhas.push(`"${l.pergunta}": ligação sem endereço real (${JSON.stringify(l.href)})`);
        continue;
      }
      const resp = await request.get(l.href);
      if (resp.status() !== 200) falhas.push(`"${l.pergunta}": ${l.href} abre com ${resp.status()}`);
    }
    expect(falhas, `tema ${tema}`).toEqual([]);
  });
}
