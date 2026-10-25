import Link from "next/link";
import { ERRO_LINK_CELULAR, ERRO_LINK_OUTRA_CONTA } from "@/lib/niveis/prova-camera";

export const metadata = { title: "Fotografar pelo celular · Viva Nomads", robots: { index: false } };

/** FOTO-NA-HORA-B — o link do celular não abriu: vencido, já usado ou de outra conta. */
export default async function AvisoLinkCelular({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const outra = m === "outra-conta";
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-xl font-semibold text-ink">Fotografar pelo celular</h1>
      <p className="mt-3 text-sm text-ink" role="alert" data-testid="prova-celular-aviso" data-motivo={outra ? "outra-conta" : "invalido"}>
        {outra ? ERRO_LINK_OUTRA_CONTA : ERRO_LINK_CELULAR}
      </p>
      <Link href="/dashboard/imoveis" className="mt-6 inline-block text-sm font-semibold text-forest underline underline-offset-2">
        Ir para Meus imóveis
      </Link>
    </main>
  );
}
