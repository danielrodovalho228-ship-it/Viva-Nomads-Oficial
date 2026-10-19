import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { imoveisAtivosDoDono } from "@/lib/data/menu-actions";
import { isSupabaseConfigured } from "@/lib/env";
import { MIN_IMOVEIS_ANALISE_CARTEIRA } from "@/lib/cobranca/regra";
import { getCarteiraDoDono } from "@/lib/data/carteira";
import { CarteiraClient } from "./carteira-client";

export const metadata: Metadata = {
  title: "Análise da carteira — Viva Nomads",
};

/**
 * Análise da carteira (prompt 16): abre a partir de 3 imóveis ATIVOS, pela mesma regra das faixas de taxa
 * (src/lib/cobranca/regra.ts) — sem plano pago nem "faça upgrade". Os itens vêm do BANCO (getCarteiraDoDono, no
 * servidor); o client só troca a fonte no modo demonstração do admin.
 */
export default async function PortfolioPage() {
  const ativos = isSupabaseConfigured() ? await imoveisAtivosDoDono() : MIN_IMOVEIS_ANALISE_CARTEIRA;
  if (ativos < MIN_IMOVEIS_ANALISE_CARTEIRA) {
    const faltam = MIN_IMOVEIS_ANALISE_CARTEIRA - ativos;
    return (
      <>
        <PageTitle capa="carteira" title="Análise da carteira" />
        <div data-testid="carteira-fechada">
          <EmptyState
            icon={Building2}
            title={`Abre com ${MIN_IMOVEIS_ANALISE_CARTEIRA} imóveis ativos`}
            text={`Você tem ${ativos} ${ativos === 1 ? "imóvel ativo" : "imóveis ativos"}. Com mais ${faltam}, a análise da carteira — ocupação, receita e vencimentos de todos juntos — aparece aqui. Sem custo extra.`}
            action={
              <Link href="/dashboard/imoveis/novo" className="font-medium text-forest underline">
                Anunciar outro imóvel
              </Link>
            }
          />
        </div>
      </>
    );
  }
  const itens = isSupabaseConfigured() ? await getCarteiraDoDono() : [];
  return <CarteiraClient itens={itens} />;
}
