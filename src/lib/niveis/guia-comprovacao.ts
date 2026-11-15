/*
  E143 (Família 7) — o PDF guia da comprovação de nível, baixado no Passo 5. PURO no conteúdo (secoesGuiaNivel) e no
  desenho (gerarGuiaNivelPdf, pdf-lib; roda no node --test). Fonte única: os textos e os itens vêm dos mesmos lugares
  que a tela usa — TEXTO_ESSENCIAL_DECLARADO/TEXTO_SUBIR_NIVEL (Passo 5), AVISO_PROVA_NA_HORA (câmera) e a MATRIZ de
  config/niveis. Nada escrito à mão sobre itens ou regras; o guia não cria regra nova.
*/
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AREAS, MATRIZ, ROTULO_AREA, ROTULO_NIVEL, itemNivel, type ChaveNivel } from "../../config/niveis.ts";
import { TEXTO_ESSENCIAL_DECLARADO, TEXTO_SUBIR_NIVEL } from "./cadastro-passo5.ts";
import { AVISO_PROVA_NA_HORA } from "./prova-camera.ts";
import { quebrar } from "../fiscal/pdf.ts";

import { TITULO_GUIA_NIVEL } from "./guia-nivel-link.ts";
export { ARQUIVO_GUIA_NIVEL, HREF_GUIA_NIVEL, TITULO_GUIA_NIVEL } from "./guia-nivel-link.ts";

export interface SecaoGuia {
  titulo: string;
  linhas: string[];
}

const COMO_SE_PROVA: Record<"foto" | "medida" | "ruido", string> = {
  foto: "foto feita na hora",
  medida: "medição da internet no ponto",
  ruido: "perguntas de ruído",
};

function linhaItem(chave: ChaveNivel): string {
  const i = itemNivel(chave);
  return `${i.rotulo} (${COMO_SE_PROVA[i.prova]}): ${i.criterio}`;
}

/** O conteúdo do guia, na ordem: o Essencial, como se prova, e o que cada nível pede a mais, área por área. */
export function secoesGuiaNivel(): SecaoGuia[] {
  const porNivel = (n: "conforto" | "premium"): SecaoGuia => ({
    titulo: `${ROTULO_NIVEL[n]}: o que pede a mais`,
    linhas: AREAS.filter((a) => MATRIZ[a][n].length > 0).flatMap((a) => [`${ROTULO_AREA[a]}:`, ...MATRIZ[a][n].map((c) => `• ${linhaItem(c)}`)]),
  });
  return [
    { titulo: `${ROTULO_NIVEL.essencial}: declarado, sem foto`, linhas: [TEXTO_ESSENCIAL_DECLARADO] },
    {
      titulo: "Como comprovar Conforto e Premium",
      linhas: [
        TEXTO_SUBIR_NIVEL,
        AVISO_PROVA_NA_HORA,
        "No celular, a câmera abre no próprio Passo 5. No computador, use o QR para fotografar pelo celular.",
        "Uma foto por item, sem pessoas. O nível do anúncio é o da área mais fraca.",
      ],
    },
    porNivel("conforto"),
    porNivel("premium"),
  ];
}

/** O PDF do guia (A4, Helvetica). */
export async function gerarGuiaNivelPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(TITULO_GUIA_NIVEL);
  pdf.setProducer("Viva Nomads");
  pdf.setCreator("Viva Nomads");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const A4: [number, number] = [595.28, 841.89];
  const margem = 56;
  const largura = A4[0] - margem * 2;
  let page = pdf.addPage(A4);
  let y = A4[1] - margem;
  const verde = rgb(0x0f / 255, 0x3d / 255, 0x2e / 255);
  const tinta = rgb(0.12, 0.16, 0.2);
  const escrever = (texto: string, size: number, bold = false, cor = tinta) => {
    const fonte = bold ? negrito : regular;
    for (const l of quebrar(fonte, size, texto, largura)) {
      if (y < margem + size) {
        page = pdf.addPage(A4);
        y = A4[1] - margem;
      }
      page.drawText(l, { x: margem, y, size, font: fonte, color: cor });
      y -= size * 1.45;
    }
  };
  escrever("Viva Nomads", 10, true, verde);
  escrever(TITULO_GUIA_NIVEL, 18, true, verde);
  y -= 6;
  for (const s of secoesGuiaNivel()) {
    y -= 8;
    escrever(s.titulo, 12.5, true, verde);
    for (const l of s.linhas) escrever(l, 10);
  }
  return pdf.save();
}
