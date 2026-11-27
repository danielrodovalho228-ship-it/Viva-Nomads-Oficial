import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import nextConfig from "../../../next.config.ts";

/* E851: /sobre dava 404 e /contato levava à Central de Ajuda genérica. /sobre passa a ser a página institucional (só
   fatos já públicos, pelas fontes oficiais); /contato vai à página de contato vigente (Fale com a Viva), permanente; o
   rodapé liga para as duas. */
const redirects = () => (nextConfig.redirects as () => Promise<{ source: string; destination: string; permanent: boolean; has?: unknown }[]>)();

test("/contato → /ajuda/fale-com-a-viva (permanente)", async () => {
  const r = (await redirects()).find((x) => x.source === "/contato" && !x.has);
  assert.deepEqual(r && { destination: r.destination, permanent: r.permanent }, { destination: "/ajuda/fale-com-a-viva", permanent: true });
});

test("/sobre existe e usa só fatos já públicos (fontes oficiais, nada escrito à mão sobre a empresa)", () => {
  const p = "src/app/(public)/sobre/page.tsx";
  assert.ok(existsSync(p), "a página /sobre existe");
  const s = readFileSync(p, "utf8");
  for (const fonte of ["PROMESSA_ESTADIA", "SITUACAO_VIVA", "CONTATO_NUNCA_TROCADO", "HREF_FALE_COM_A_VIVA"]) assert.match(s, new RegExp(fonte), fonte);
  assert.match(s, /alternates: \{ canonical: "\/sobre" \}/);
});

test("o rodapé liga para /sobre e para o contato vigente", () => {
  const f = readFileSync("src/components/layout/footer.tsx", "utf8");
  assert.match(f, /href="\/sobre"/);
  assert.match(f, /HREF_FALE_COM_A_VIVA/);
});
