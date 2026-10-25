// E170: gera src/lib/previas-fotos.ts — a prévia minúscula (16 px, borrada) de cada foto das molduras da Conta e das
// Ferramentas, usada como placeholder do next/image. Sem ela, a moldura fica um quadrado cinza liso até a foto chegar.
// Rodar de novo quando uma dessas fotos mudar: node scripts/gerar-previas-fotos.mjs
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const FOTOS = [
  "/images/home/home-proprietarios-chaves.webp",
  "/images/imoveis/placeholder-imovel-sala.webp",
  "/images/unicas/parceiros-servicos.webp",
  "/images/unicas/cf-conversa-registrada.webp",
  "/images/painel/ferramentas-analise.webp",
  "/images/painel/ferramentas-fechamento.webp",
  "/images/painel/ferramentas-protecao.webp",
];

const linhas = [];
for (const f of FOTOS) {
  const buf = await sharp(`public${f}`).resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
  linhas.push(`  "${f}": "data:image/webp;base64,${buf.toString("base64")}",`);
}

writeFileSync(
  "src/lib/previas-fotos.ts",
  `/*
  E170 — GERADO por scripts/gerar-previas-fotos.mjs (não editar à mão). A prévia borrada de cada foto das molduras
  (Conta e Ferramentas): a moldura mostra a própria foto desfocada na hora, nunca um quadrado cinza vazio.
*/
export const PREVIAS_FOTOS: Record<string, string> = {
${linhas.join("\n")}
};
`,
);
console.log(`${FOTOS.length} prévias geradas`);
