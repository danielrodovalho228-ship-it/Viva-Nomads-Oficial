import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { KeyRound, Home } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { buttonClasses } from "@/components/ui/button";

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
          padding-top), inteira e sem véu: nada de faixa branca nem gradiente por
          cima. Em telas baixas (iPhone SE) encolhe para os botões caberem sem rolar. */}
      <div className="relative h-[44vh] min-h-[280px] w-full flex-none overflow-hidden [@media(max-height:700px)]:h-[30vh] [@media(max-height:700px)]:min-h-0" data-testid="boas-vindas-foto">
        <Image
          src="/images/app/app-boas-vindas.webp"
          alt="Pessoa chegando com a mala a um imóvel mobiliado, abrindo a porta"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_40%] sm:object-[50%_20%]"
        />
      </div>

      <div
        className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-between px-6 pt-6 [@media(max-height:700px)]:pt-4"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))" }}
      >
        {/* A logo fica na área branca, acima do título, alinhada à margem do texto (24 px), fora da foto. */}
        <div data-testid="boas-vindas-texto">
          <Logo href="/app/boas-vindas" />
          <h1 className="mt-3 font-title text-2xl font-semibold leading-tight text-ink [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:text-2xl">
            Imóveis mobiliados de 30 a 180 dias, com contrato de verdade.
          </h1>
          <p className="mt-2 text-base text-muted [@media(max-height:700px)]:text-sm">
            Para quem vai morar um tempo fora e para quem quer alugar com segurança.
          </p>
        </div>

        <div className="mt-4 space-y-3 [@media(max-height:700px)]:space-y-2">
          <Link
            href="/auth?papel=tenant&cadastro=1"
            className={buttonClasses({ size: "lg", className: "w-full" })}
          >
            <KeyRound className="h-5 w-5" /> Quero alugar
          </Link>
          <Link
            href="/auth?papel=owner&cadastro=1"
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-forest px-5 py-4 text-base font-semibold text-forest [@media(max-height:700px)]:py-3"
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
