import { Skeleton, SkeletonGradeCartoes } from "@/components/ui/skeleton";

/**
 * Carregando a busca: esqueleto no formato exato dos cartões (Prompt 40). Ocupa ao menos uma tela: mais
 * curto, o rodapé aparecia e era empurrado para baixo quando a busca chegava (CLS 0,128 a 1280 px no t184).
 */
export default function Loading() {
  return (
    <div className="container-page min-h-screen py-6" data-testid="buscar-carregando">
      <Skeleton className="h-12 w-full rounded-full sm:w-96" />
      <Skeleton className="mt-6 h-7 w-64" />
      <SkeletonGradeCartoes itens={6} className="mt-6" />
    </div>
  );
}
