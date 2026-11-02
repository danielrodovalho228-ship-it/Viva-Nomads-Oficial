/*
  E323 — foto do anúncio (VN-A02690) em branco numa recarga. Os 8 arquivos existem no Storage (conferido em produção);
  o BrandImage não tratava erro: uma falha passageira do otimizador de imagens (/_next/image — p.ex. tempo esgotado ao
  gerar AVIF de foto grande) deixava o quadro vazio até outra recarga. Agora: 1ª falha → uma nova tentativa DIRETO do
  Storage (sem otimizar); 2ª falha → o espaço reservado "Foto indisponível", nunca o branco. PURO.
  Roda: node --test src/lib/fotos/tentativa-imagem.test.ts
*/
export type TentativaImagem = "otimizada" | "direta" | "falhou";

export const ROTULO_FOTO_INDISPONIVEL = "Foto indisponível";

export function proximaTentativa(atual: TentativaImagem): TentativaImagem {
  return atual === "otimizada" ? "direta" : "falhou";
}
