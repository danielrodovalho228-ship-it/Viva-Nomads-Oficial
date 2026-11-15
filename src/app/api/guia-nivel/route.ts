import { ARQUIVO_GUIA_NIVEL, gerarGuiaNivelPdf } from "@/lib/niveis/guia-comprovacao";

/** E143: o PDF guia da comprovação de nível (conteúdo público, sem dados de ninguém), baixado no Passo 5. */
export async function GET() {
  const bytes = await gerarGuiaNivelPdf();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${ARQUIVO_GUIA_NIVEL}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
