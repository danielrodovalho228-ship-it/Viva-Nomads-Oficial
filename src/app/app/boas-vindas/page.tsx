import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Home } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Boas-vindas",
  robots: { index: false, follow: false },
};

/**
 * Primeira tela do APP sem login (mapa 0.3): escolher o caminho e ir ao
 * cadastro com o papel já marcado. No site normal ninguém chega aqui (o proxy
 * só manda para cá dentro do app).
 */
export default function BoasVindasPage() {
  return (
    <main
      className="flex min-h-screen flex-col justify-between bg-white px-6 pb-8 pt-16"
      style={{ paddingTop: "max(4rem, env(safe-area-inset-top, 0px))" }}
    >
      <div>
        <Logo href="/app/boas-vindas" />
        <h1 className="mt-10 font-title text-3xl font-bold leading-tight text-ink">
          Imóveis mobiliados de 30 a 180 dias, com contrato de verdade.
        </h1>
        <p className="mt-3 text-base text-muted">
          Para quem vai morar um tempo fora e para quem quer alugar com segurança.
        </p>
      </div>

      <div className="space-y-3">
        <Link
          href="/auth?papel=tenant&cadastro=1"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-forest px-5 py-4 text-base font-semibold text-white"
        >
          <KeyRound className="h-5 w-5" /> Quero alugar
        </Link>
        <Link
          href="/auth?papel=owner&cadastro=1"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-forest px-5 py-4 text-base font-semibold text-forest"
        >
          <Home className="h-5 w-5" /> Quero anunciar
        </Link>
        <Link href="/auth" className="block py-2 text-center text-sm font-medium text-forest underline">
          Já tenho conta
        </Link>
        <p className="pt-2 text-center text-xs text-muted">Lançamento oficial em 2027.</p>
      </div>
    </main>
  );
}
