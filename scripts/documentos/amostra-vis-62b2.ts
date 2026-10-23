/*
  Amostra do laudo VIS (Prompt 62-B2) com um caso FICTÍCIO "com ressalvas". Usa o código de verdade (checklist,
  resultadoAvaliacao, conteudoLaudo, gerarPdf); na plataforma o mesmo conteúdo passa por registrarDocumento.
  Uso: node --experimental-strip-types scripts/documentos/amostra-vis-62b2.ts  →  docs/modelos/amostras-62b2/VIS-modelo.pdf
*/
import { writeFileSync } from "node:fs";
import { ITENS_CHECKLIST, type ItemChecklist, type ValorItem } from "../../src/config/checklist-avaliacao.ts";
import { gerarPdf } from "../../src/lib/fiscal/pdf.ts";
import { emitidoEmBrasilia, linhaConferir } from "../../src/lib/fiscal/prefixos.ts";
import { resultadoAvaliacao, resumoPorGrupo, prazoRessalva } from "../../src/lib/vistoria/laudo.ts";
import { conteudoLaudo } from "../../src/lib/vistoria/laudo-documento.ts";

const emitido = "2026-10-20T18:40:00Z";
const respostas: Record<string, ValorItem> = Object.fromEntries((ITENS_CHECKLIST as readonly ItemChecklist[]).map((i) => [i.chave, i.tipo === "limpeza" ? "pronto" : "conforme"]));
respostas.iluminacao = "nao_conforme";
respostas.tomadas_risco = "nao_conforme";
const bytes = await gerarPdf(
  conteudoLaudo(
    {
      imovel: "Studio mobiliado no Centro (fictício)",
      cidade: "Uberlândia",
      visitaEm: "2026-10-20T13:00:00Z",
      avaliador: { nomeCurto: "Ana", numero: "UDI-001" },
      resultado: resultadoAvaliacao(respostas),
      nivel: "conforto",
      resumo: resumoPorGrupo(respostas),
      naoConformes: [
        { chave: "iluminacao", valor: "nao_conforme", observacao: "Lâmpada da sala queimada.", temFoto: true },
        { chave: "tomadas_risco", valor: "nao_conforme", observacao: "Tomada solta na cozinha.", temFoto: true },
      ],
      ruido: "baixo",
      internet: [
        { ponto: "quarto_principal", downloadMbps: 328, uploadMbps: 42, latenciaMs: 12 },
        { ponto: "trabalho", downloadMbps: 310, uploadMbps: 40, latenciaMs: 14 },
      ],
      prazoRessalvaAte: prazoRessalva(emitido).toISOString(),
      motivoVersao: null,
    },
    { numero: "VIS-2026-000001", emitidoEm: emitidoEmBrasilia(emitido), conferir: linhaConferir("https://vivanomads.com.br", "3f9a0c1e2b4d5a6978e0f1a2b3c4d5e6") },
  ),
);
writeFileSync("docs/modelos/amostras-62b2/VIS-modelo.pdf", bytes);
console.log("docs/modelos/amostras-62b2/VIS-modelo.pdf", bytes.length, "bytes");
