import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { confortoDoImovel } from "@/lib/data/conforto-actions";
import { FormConforto } from "./form-conforto";

export const dynamic = "force-dynamic";

/** Prompt 59 — padrão mínimo de conforto do imóvel: o dono confirma item a item (e o anúncio pausado volta para a busca). */
export default async function ConfortoDoImovelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const estado = await confortoDoImovel(id);
  return (
    <div>
      <Link href="/dashboard/imoveis" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Meus imóveis
      </Link>
      <h1 className="mt-3 font-title text-2xl font-semibold text-ink">Padrão mínimo de conforto</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        O que todo morador encontra ao chegar. Confirme o que o imóvel tem; o morador confere na entrada.
      </p>
      <div className="mt-6 max-w-2xl">
        {estado ? (
          <>
            {estado.aviso && (
              <p className="mb-4 rounded-xl border border-line bg-white p-4 text-sm text-ink" role="status" data-testid="conforto-aviso">
                {estado.aviso}
              </p>
            )}
            <FormConforto propertyId={id} inicial={estado.itens.filter((i) => i.confirmado).map((i) => i.chave)} />
          </>
        ) : (
          <p className="rounded-xl border border-line bg-white p-4 text-sm text-ink" data-testid="conforto-indisponivel">
            Imóvel não encontrado.
          </p>
        )}
      </div>
    </div>
  );
}
