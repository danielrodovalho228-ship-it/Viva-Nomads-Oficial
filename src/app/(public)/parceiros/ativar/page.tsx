import type { Metadata } from "next";
import { estadoAtivacao } from "@/lib/parceiros/ativacao-actions";
import { AtivarParceria } from "./ativar-parceria";

export const metadata: Metadata = {
  title: "Ativar a página de parceiro",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Prompt 31a, item 4: o link do e-mail de aprovação. Abrir não ativa nada; a ativação é o botão (conta certa). */
export default async function AtivarPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const token = String(t ?? "").slice(0, 100);
  const estado = await estadoAtivacao(token);
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-title text-2xl font-bold text-ink sm:text-3xl">Ativar a sua página de parceiro</h1>
      <div className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
        <AtivarParceria token={token} estado={estado} />
      </div>
    </div>
  );
}
