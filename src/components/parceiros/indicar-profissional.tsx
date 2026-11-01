"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { caminhoIndicacao } from "@/lib/parceiros/indicacao";

/**
 * E304 (QA 31/10): "Indique um profissional" oferece INDICAR — manda (ou copia) o link do pedido de parceria já na
 * categoria; quem recebe faz o pedido com a própria conta. Antes, o botão só abria /parceiros.
 */
export function IndicarProfissional({ categoria }: { categoria: string }) {
  const [copiado, setCopiado] = useState(false);
  async function indicar() {
    const url = `${window.location.origin}${caminhoIndicacao(categoria)}`;
    const texto = "Conheço um lugar para você oferecer seus serviços: peça a parceria na Viva Nomads.";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Seja parceiro da Viva Nomads", text: texto, url });
      } catch {
        /* a pessoa cancelou */
      }
      return;
    }
    try {
      await navigator.clipboard?.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sem área de transferência */
    }
  }
  return (
    <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => void indicar()} data-testid="indicar-profissional" data-href={caminhoIndicacao(categoria)}>
      {copiado ? <Check className="h-4 w-4" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
      {copiado ? "Link copiado" : "Enviar o link para indicar"}
    </Button>
  );
}
