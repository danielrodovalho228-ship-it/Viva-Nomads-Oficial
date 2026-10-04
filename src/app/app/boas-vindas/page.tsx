import type { Metadata } from "next";
import Image from "next/image";
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
    <main className="flex min-h-[100dvh] flex-col bg-white">
      {/* Foto no topo, colada na borda e por trás da barra de status (sem
          padding-top). Em telas baixas (iPhone SE) encolhe para os botões
          caberem sem rolar. */}
      <div className="relative h-[50vh] min-h-[280px] w-full flex-none overflow-hidden [@media(max-height:700px)]:h-[42vh] [@media(max-height:700px)]:min-h-0">
        <Image
          src="/images/app/app-boas-vindas.webp"
          alt="Pessoa chegando com a mala a um imóvel mobiliado, abrindo a porta"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_40%]"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-white/0 to-white" />
      </div>

      <div
        className="-mt-8 flex flex-1 flex-col justify-between px-6"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="relative">
          <Logo href="/app/boas-vindas" />
          <h1 className="mt-3 font-title text-2xl font-bold leading-tight text-ink [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:text-2xl">
            Imóveis mobiliados de 30 a 180 dias, com contrato de verdade.
          </h1>
          <p className="mt-2 text-base text-muted [@media(max-height:700px)]:text-sm">
            Para quem vai morar um tempo fora e para quem quer alugar com segurança.
          </p>
        </div>

        <div className="mt-4 space-y-3 [@media(max-height:700px)]:space-y-2">
          <Link
            href="/auth?papel=tenant&cadastro=1"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-forest px-5 py-3.5 text-base font-semibold text-white [@media(max-height:700px)]:py-3"
          >
            <KeyRound className="h-5 w-5" /> Quero alugar
          </Link>
          <Link
            href="/auth?papel=owner&cadastro=1"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-forest px-5 py-3.5 text-base font-semibold text-forest [@media(max-height:700px)]:py-3"
          >
            <Home className="h-5 w-5" /> Quero anunciar
          </Link>
          <Link href="/auth" className="block py-2 text-center text-sm font-medium text-forest underline [@media(max-height:700px)]:py-1">
            Já tenho conta
          </Link>
          <p className="pt-1 text-center text-xs text-muted">Lançamento oficial em 2027.</p>
        </div>
      </div>
    </main>
  );
}
