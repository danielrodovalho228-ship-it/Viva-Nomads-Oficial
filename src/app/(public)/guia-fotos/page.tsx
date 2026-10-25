import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { trilha } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";
import { GuiaFotos } from "@/components/fotos/guia-fotos";

export const metadata: Metadata = {
  alternates: { canonical: "/guia-fotos" },
  title: "Como tirar boas fotos do seu imóvel mobiliado",
  description: "Exemplos do que evitar e do que fazer, e dicas rápidas para fotografar o seu imóvel mobiliado com o celular.",
};

export default function GuiaFotosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <JsonLd dados={trilha(SITE_URL, [{ nome: "Guia de fotos", caminho: "/guia-fotos" }])} />
      <h1 className="font-display text-2xl font-semibold text-ink sm:text-[28px]">Como tirar boas fotos</h1>
      <p className="mt-2 mb-6 text-ink/70">Um anúncio bem fotografado se destaca. Veja o que evitar e o que fazer.</p>
      <h2 className="mb-4 font-display text-xl font-semibold text-ink">O que evitar e o que fazer, ambiente por ambiente</h2>
      <GuiaFotos />
    </div>
  );
}
