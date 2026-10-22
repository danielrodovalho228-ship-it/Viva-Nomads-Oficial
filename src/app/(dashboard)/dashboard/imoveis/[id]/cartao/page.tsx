import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { meuCartaoDoAnuncio } from "@/lib/data/cartoes-actions";
import { CartaoCompartilhar } from "@/components/cartoes/cartao-compartilhar";

export const dynamic = "force-dynamic";

/** Cartão do anúncio (cartões compartilháveis, T2): prévia e compartilhar pelo WhatsApp. Só o dono, anúncio publicado. */
export default async function CartaoDoAnuncioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await meuCartaoDoAnuncio(id);
  return (
    <div>
      <Link href="/dashboard/imoveis" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Meus imóveis
      </Link>
      <h1 className="mt-3 font-title text-2xl font-semibold text-ink">Cartão do seu anúncio</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Uma imagem pronta para o WhatsApp e as redes, com um QR que leva direto ao seu anúncio na Viva Nomads.
      </p>
      <div className="mt-6">
        {r.ok ? (
          <CartaoCompartilhar inicial={r.valor} />
        ) : (
          <p className="rounded-xl border border-line bg-white p-4 text-sm text-ink" data-testid="cartao-indisponivel">
            {r.error}
          </p>
        )}
      </div>
    </div>
  );
}
