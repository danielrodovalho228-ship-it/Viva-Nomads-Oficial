// Lista (uma por linha) dos specs do "lab-critico": login, publicar anúncio, candidatura→contrato→assinatura,
// abrir chamado e upload de foto. Fonte única: tests/laboratorio/fluxos-criticos.json (ordem d86d0678).
import { readFileSync } from "node:fs";

const caminho = new URL("../../tests/laboratorio/fluxos-criticos.json", import.meta.url);
const { fluxos } = JSON.parse(readFileSync(caminho, "utf8"));
console.log(Object.values(fluxos).flat().map((s) => `${s}.spec.ts`).join("\n"));
