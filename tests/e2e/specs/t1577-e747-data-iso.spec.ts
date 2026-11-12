import { test, expect } from "@playwright/test";
import { mascararDataDigitada } from "../../../src/lib/data-digitada";

/*
  T1577 — E747 (#3550): data digitada tecla a tecla em ISO ("2026-11-15") não embaralha ("20/26/1115"): o texto segue em ISO enquanto se digita e,
  com os 8 dígitos, vira dd/mm/aaaa; a máscara dd/mm/aaaa de sempre fica intacta. Só lógica, roda no lab-crítico.
*/
test("E747: ISO digitado tecla a tecla chega a 15/11/2026 sem embaralhar", () => {
  let texto = "";
  const passos: string[] = [];
  for (const t of "2026-11-15") {
    texto = mascararDataDigitada(texto + t);
    passos.push(texto);
  }
  expect(passos.at(-1)).toBe("15/11/2026");
  // antes do "-" ainda vale a máscara de sempre ("20/26"); do "-" em diante o texto segue em ISO, sem barras, até os 8 dígitos
  for (const p of passos.slice(4, -1)) expect(p, "passo intermediário embaralhado").not.toContain("/");
});

test("E747: a máscara dd/mm/aaaa de sempre continua igual", () => {
  expect(mascararDataDigitada("15112026")).toBe("15/11/2026");
  expect(mascararDataDigitada("1511")).toBe("15/11");
});
