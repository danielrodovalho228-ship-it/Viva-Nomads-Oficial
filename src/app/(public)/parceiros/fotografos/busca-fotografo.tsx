"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { MSG_BUSCA_VAZIA } from "@/lib/fotografos/regras";

/**
 * Busca por CEP ou cidade (E52): com os dois campos vazios, "Buscar" não recarrega a página — avisa o que digitar e
 * leva o foco ao CEP. Sem JavaScript, o servidor mostra o mesmo aviso (buscaVazia).
 */
export function BuscaFotografo({ cepInicial, cidadeInicial, vazioNoServidor }: { cepInicial: string; cidadeInicial: string; vazioNoServidor: boolean }) {
  const [aviso, setAviso] = useState(vazioNoServidor);
  return (
    <form
      method="get"
      noValidate
      onSubmit={(e) => {
        const f = e.currentTarget;
        const cep = (f.elements.namedItem("cep") as HTMLInputElement).value.trim();
        const cidade = (f.elements.namedItem("cidade") as HTMLInputElement).value.trim();
        if (!cep && !cidade) {
          e.preventDefault();
          setAviso(true);
          (f.elements.namedItem("cep") as HTMLInputElement).focus();
        }
      }}
      className="mt-6 grid gap-3 rounded-xl border border-sage-200 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      data-testid="fotografos-busca"
    >
      <div>
        <label htmlFor="cep" className="block text-sm font-medium text-ink">CEP do imóvel</label>
        <input id="cep" name="cep" inputMode="numeric" autoComplete="postal-code" defaultValue={cepInicial} placeholder="00000-000" aria-invalid={aviso || undefined} aria-describedby={aviso ? "fotografos-busca-aviso" : undefined} onInput={() => setAviso(false)} className="mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
      </div>
      <div>
        <label htmlFor="cidade" className="block text-sm font-medium text-ink">ou cidade</label>
        <input id="cidade" name="cidade" autoComplete="address-level2" defaultValue={cidadeInicial} placeholder="Uberlândia" aria-invalid={aviso || undefined} aria-describedby={aviso ? "fotografos-busca-aviso" : undefined} onInput={() => setAviso(false)} className="mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
      </div>
      <button type="submit" className={buttonClasses({ size: "md" })}>Buscar</button>
      {aviso && (
        <p id="fotografos-busca-aviso" role="alert" className="text-sm text-red-700 sm:col-span-3" data-testid="fotografos-busca-vazia">
          {MSG_BUSCA_VAZIA}
        </p>
      )}
    </form>
  );
}
