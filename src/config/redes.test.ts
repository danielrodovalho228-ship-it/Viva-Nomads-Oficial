/*
  Prompt 35A, item 4 — Instagram oficial: constante ÚNICA (src/config/redes.ts) usada no rodapé do site, na Central
  de Ajuda (/ajuda, bloco "Fale com a Viva") e no rodapé dos e-mails.
  Roda: node --test src/config/redes.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { REDES_OFICIAIS } from "./redes.ts";
import { RODAPE_OPCIONAL, rodapeOpcionalHtml } from "../lib/notifications/modelo-email.ts";

const RAIZ = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

test("a constante tem só a conta oficial do Instagram", () => {
  assert.deepEqual(REDES_OFICIAIS, [{ nome: "Instagram", url: "https://www.instagram.com/vivanomads/" }]);
});

test("rodapé do site e /ajuda usam o componente que lê REDES_OFICIAIS", () => {
  const comp = ler("src/components/layout/redes-oficiais.tsx");
  assert.match(comp, /import \{ REDES_OFICIAIS \} from "@\/config\/redes"/);
  assert.match(comp, /REDES_OFICIAIS\.map\(/);
  assert.match(comp, /rel="noopener"/);
  assert.match(comp, /aria-label=\{`\$\{r\.nome\}/);

  const rodape = ler("src/components/layout/footer.tsx");
  assert.match(rodape, /import \{ RedesOficiais \} from "@\/components\/layout\/redes-oficiais"/);
  assert.match(rodape, /<RedesOficiais\b/);

  const ajuda = ler("src/app/(public)/ajuda/page.tsx");
  assert.match(ajuda, /import \{ RedesOficiais \} from "@\/components\/layout\/redes-oficiais"/);
  const bloco = ajuda.slice(ajuda.indexOf("Fale com a Viva</h2>"), ajuda.indexOf("<CentralAjuda"));
  assert.match(bloco, /<RedesOficiais\b/, "o link fica no bloco \"Fale com a Viva\"");
});

test("rodapé dos e-mails liga RODAPE_OPCIONAL.redes com a mesma constante", () => {
  assert.equal(RODAPE_OPCIONAL.redes.ativo, true);
  assert.deepEqual(RODAPE_OPCIONAL.redes.links, [...REDES_OFICIAIS]);
  assert.match(rodapeOpcionalHtml(), /href="https:\/\/www\.instagram\.com\/vivanomads\/" rel="noopener"/);
});

test("a URL do Instagram oficial não aparece escrita à mão fora da constante", () => {
  const achados: string[] = [];
  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) varrer(p);
      else if (/\.(tsx?)$/.test(nome) && !/\.test\.ts$/.test(nome) && /instagram\.com\/vivanomads/i.test(readFileSync(p, "utf8"))) achados.push(p.slice(RAIZ.length));
    }
  };
  varrer(join(RAIZ, "src"));
  assert.deepEqual(achados, ["src/config/redes.ts"]);
});
