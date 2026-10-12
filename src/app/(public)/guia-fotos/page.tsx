import type { Metadata } from "next";
import { GuiaFotos } from "@/components/fotos/guia-fotos";
import { RODAPE_GUIA } from "@/lib/fotos/guia";

export const metadata: Metadata = {
  alternates: { canonical: "/guia-fotos" },
  title: "Como tirar boas fotos do seu imóvel mobiliado",
  description: "Exemplos do que evitar e do que fazer, e dicas rápidas para fotografar o seu imóvel mobiliado com o celular.",
};

export default function GuiaFotosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Como tirar boas fotos</h1>
      <p className="mt-2 mb-6 text-ink/70">Um anúncio bem fotografado se destaca. Veja o que evitar e o que fazer.</p>
      <h2 className="mb-4 font-display text-xl font-bold text-ink">O que evitar e o que fazer, ambiente por ambiente</h2>
      <GuiaFotos />
      <p className="mt-10 text-xs text-muted">{RODAPE_GUIA}</p>
    </div>
  );
}
