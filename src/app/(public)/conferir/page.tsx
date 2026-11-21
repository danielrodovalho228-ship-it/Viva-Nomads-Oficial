import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { CODIGO_RE } from "@/lib/fiscal/documento";
import { CONFERENCIA_DEVOLVE, CONFERENCIA_PARTES, CONFERENCIA_VALIDADE } from "@/lib/fiscal/conferir";
import { buttonClasses } from "@/components/ui/button";

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
    <div className="container-page section-y">
      <div className="mx-auto max-w-lg rounded-xl border border-line bg-white p-6">
        <h1 className="flex items-center gap-2 font-title text-2xl font-semibold text-ink">
          <ShieldCheck className="h-6 w-6 text-forest" /> Conferir documento
        </h1>
        <p className="mt-2 text-sm text-muted">
          Todo documento gerado pela Viva Nomads tem um código de conferência no rodapé, depois de &ldquo;com o código&rdquo;. Digite o código
          para ver se o documento é verdadeiro. O número do documento sozinho não confere nada.
        </p>
        {/* E887: o que a conferência devolve e a validade do documento, ditos antes de conferir (fonte única em fiscal/conferir). */}
        <div className="mt-4 rounded-xl bg-surface-2 p-4 text-sm text-ink" data-testid="conferir-o-que-mostra">
          <p className="font-semibold">O que a conferência mostra</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {CONFERENCIA_DEVOLVE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted">{CONFERENCIA_PARTES}</p>
          <p className="mt-2 text-muted" data-testid="conferir-validade">
            {CONFERENCIA_VALIDADE}
          </p>
        </div>
        <form method="get" action="/conferir" className="mt-4 space-y-3">
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
            className="w-full rounded-xl border border-line px-4 py-3 font-mono text-sm outline-none focus:border-sage"
          />
          {invalido && (
            <p className="text-sm text-red-700" data-testid="conferir-codigo-invalido">
              Código inválido. Confira os 32 caracteres impressos no documento.
            </p>
          )}
          <button type="submit" className={buttonClasses({ size: "md" })}>
            Conferir
          </button>
        </form>
      </div>
    </div>
  );
}
