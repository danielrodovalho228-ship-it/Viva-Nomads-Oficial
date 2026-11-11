"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { DESTINO_PADRAO_VOLTAR_AO_SITE, destinoVoltarAoSite, lerUltimaPublica } from "@/lib/navegacao/ultima-publica";

/** E784: "‹ Voltar ao site" do admin no celular — a última página pública da pessoa; entrada direta → home. */
export function VoltarAoSite() {
  const [href, setHref] = useState(DESTINO_PADRAO_VOLTAR_AO_SITE);
  useEffect(() => {
    setHref(destinoVoltarAoSite(lerUltimaPublica()));
  }, []);
  return (
    <Link href={href} className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-forest" data-testid="admin-voltar-site">
      <ChevronLeft className="h-5 w-5" aria-hidden /> Voltar ao site
    </Link>
  );
}
