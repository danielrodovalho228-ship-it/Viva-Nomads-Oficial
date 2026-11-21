import { expect, type Page } from "@playwright/test";

/*
  E1064 — o passo 1 do Fechamento abre o portão da identidade de quem fecha.
  Sem identidade confirmada: o botão "Verificar identidade" existe e é clicado (como sempre).
  Com a identidade já confirmada: a tela diz "Sua identidade já está confirmada" e não há nada a clicar.
  Uma das duas coisas TEM de estar na tela; a spec que chama continua a exigir "Continuar" liberado a seguir.
*/
export async function abrirPortaoDaIdentidade(page: Page): Promise<"clicou" | "ja-confirmada"> {
  const botao = page.getByRole("button", { name: /verificar identidade/i });
  const jaConfirmada = page.getByText("Sua identidade já está confirmada");
  await expect(botao.or(jaConfirmada).first()).toBeVisible({ timeout: 20_000 });
  if (await jaConfirmada.isVisible()) return "ja-confirmada";
  await botao.click();
  return "clicou";
}
