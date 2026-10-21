// Lista (uma por linha) dos specs do "lab-critico": login, publicar anúncio, candidatura→contrato→assinatura,
// abrir chamado e upload de foto. Fonte única: tests/laboratorio/fluxos-criticos.json (ordem d86d0678).
//
// Portão de PR (decisão do Muse, 21/10): em PR o lab-critico roda a lista crítica + os specs que o próprio PR
// cria ou altera, e qualquer falha deixa o job vermelho. A suíte completa roda só na main e no noturno.
//   node scripts/lab/fluxos-criticos.mjs                      → só a lista crítica
//   node scripts/lab/fluxos-criticos.mjs --alterados-desde SHA → lista crítica + specs alterados desde SHA
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PASTA_SPECS = "tests/e2e/specs/";

/** Lista crítica primeiro, na ordem do arquivo; depois os specs alterados que ainda existem, sem repetir. */
export function specsDoPortao(criticos, alterados, existe = existsSync) {
  const saida = criticos.map((s) => `${s}.spec.ts`);
  for (const caminho of alterados) {
    if (!caminho.startsWith(PASTA_SPECS) || !caminho.endsWith(".spec.ts")) continue;
    const nome = caminho.slice(PASTA_SPECS.length);
    if (nome.includes("/") || !existe(caminho) || saida.includes(nome)) continue;
    saida.push(nome);
  }
  return saida;
}

function listaCritica() {
  const caminho = new URL("../../tests/laboratorio/fluxos-criticos.json", import.meta.url);
  const { fluxos } = JSON.parse(readFileSync(caminho, "utf8"));
  return Object.values(fluxos).flat();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--alterados-desde");
  const base = i > 0 ? process.argv[i + 1] : "";
  // Apagados não entram (--diff-filter=AMR); renomeados entram com o nome novo.
  const alterados = base
    ? execFileSync("git", ["diff", "--name-only", "--diff-filter=AMR", `${base}...HEAD`, "--", PASTA_SPECS], { encoding: "utf8" })
        .split("\n")
        .filter(Boolean)
    : [];
  console.log(specsDoPortao(listaCritica(), alterados).join("\n"));
}
