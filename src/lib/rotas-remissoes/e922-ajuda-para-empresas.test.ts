import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../../../next.config.ts";

/* E922: /ajuda/para-empresas dava 404. A Ajuda tem quatro temas (morador, proprietários, contratos, segurança) e o
   conteúdo de empresas vive em /empresas (com o "Fale com a gente"): o endereço vai para lá, permanente. */
test("/ajuda/para-empresas → /empresas (permanente)", async () => {
  const lista = await (nextConfig.redirects as () => Promise<{ source: string; destination: string; permanent: boolean }[]>)();
  const r = lista.find((x) => x.source === "/ajuda/para-empresas");
  assert.deepEqual(r && { destination: r.destination, permanent: r.permanent }, { destination: "/empresas", permanent: true });
});
