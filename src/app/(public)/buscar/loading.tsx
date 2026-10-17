import { SkeletonLista } from "@/components/ui/skeleton";

/**
 * Carregando a busca: esqueleto dos cartões. Ocupa ao menos uma tela: mais curto, o rodapé aparecia e era
 * empurrado para baixo quando a busca chegava (CLS 0,128 a 1280 px no t184).
 */
export default function Loading() {
  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6" data-testid="buscar-carregando">
      <SkeletonLista itens={5} />
    </div>
  );
}
