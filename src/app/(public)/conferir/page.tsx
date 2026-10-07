import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { CODIGO_RE } from "@/lib/fiscal/documento";

export const metadata: Metadata = {
  title: "Conferir documento",
  description: "Confira se um recibo ou documento emitido pela Viva Nomads é verdadeiro, pelo código impresso nele.",
  robots: { index: false, follow: true },
};

/**
 * Porta de entrada da conferência pública (/conferir). O recibo traz o link
 * direto (/conferir/<código>); aqui a pessoa também pode digitar o código.
 */
export default async function ConferirInicio({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const sp = await searchParams;
  const digitado = (sp.codigo ?? "").trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  if (digitado && CODIGO_RE.test(digitado)) redirect(`/conferir/${digitado}`);
  const invalido = !!sp.codigo && !CODIGO_RE.test(digitado);

  return (
    <main className="container-page section-y">
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-6">
        <h1 className="flex items-center gap-2 font-title text-2xl font-bold text-ink">
          <ShieldCheck className="h-6 w-6 text-forest" /> Conferir documento
        </h1>
        <p className="mt-2 text-sm text-muted">
          Todo recibo e documento gerado pela Viva Nomads tem um código de conferência. Digite o código para ver se o documento é verdadeiro.
        </p>
        <form method="get" action="/conferir" className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-ink" htmlFor="codigo">
            Código de conferência
          </label>
          <input
            id="codigo"
            name="codigo"
            required
            defaultValue={sp.codigo ?? ""}
            autoComplete="off"
            spellCheck={false}
            placeholder="Ex.: 0123456789abcdef0123456789abcdef"
            className="w-full rounded-xl border border-line px-3.5 py-2.5 font-mono text-sm outline-none focus:border-sage"
          />
          {invalido && (
            <p className="text-sm text-red-700" data-testid="conferir-codigo-invalido">
              Código inválido. Confira os 32 caracteres impressos no documento.
            </p>
          )}
          <button type="submit" className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest/90">
            Conferir
          </button>
        </form>
      </div>
    </main>
  );
}
