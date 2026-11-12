"use client";

import { useDashDemo, useDisplayUser } from "@/lib/demo/demo-mode";
import { primeiroNomeExibicao, useViewMode } from "@/lib/roles";
import { InicioDonoFixo } from "@/components/painel/inicio-dono";
import { textoDoTopo } from "@/lib/painel/inicio-secoes";

/**
 * E797 (opção b do chat principal) — o Início em SEÇÕES. Tudo aqui pinta no 1º quadro, sem esperar leitura nenhuma:
 * o nome e o modo vêm dos hooks do quadro (no piloto, da sessão conferida no servidor).
 */

/** O topo do Início: a saudação com o primeiro nome (sem nome, neutra). */
export function InicioTopo() {
  const nome = primeiroNomeExibicao(useDisplayUser());
  return (
    <div className="mb-4" data-testid="inicio-topo">
      <p className="font-title text-lg font-semibold text-ink">{textoDoTopo(nome)}</p>
    </div>
  );
}

/** O marcador do bloco de dados enquanto ele chega (não é o esqueleto de página inteira). */
export function MarcadorSecaoInicio() {
  return (
    <section role="status" aria-label="Carregando o seu painel" aria-busy="true" className="space-y-3" data-testid="inicio-secao-carregando">
      <div className="h-6 w-56 animate-pulse rounded-lg bg-divisor" />
      <div className="h-32 animate-pulse rounded-lg bg-divisor" />
    </section>
  );
}

/** As partes fixas do Início: no modo dono, Peça na Viva e Ferramentas (as do morador ficam no bloco dele). */
export function InicioFixo() {
  const { mode } = useViewMode();
  const demo = useDashDemo();
  if (mode !== "owner" || demo) return null;
  return <InicioDonoFixo />;
}
