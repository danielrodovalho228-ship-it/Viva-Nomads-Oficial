import { SkeletonLista } from "@/components/ui/skeleton";

/** Carregando a busca: esqueleto dos cartões. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <SkeletonLista itens={5} />
    </div>
  );
}
