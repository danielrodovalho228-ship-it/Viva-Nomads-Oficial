/*
  Harness de teste (Pista 3, lote 2): uma PropostaView montada com as regras REAIS (calcularTotais) e a tela real
  (proposta-detalhe.tsx) renderizada em HTML estático. Só os testes a importam.
*/
import { register } from "node:module";

register("./loader.mjs", import.meta.url);

const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");
const { calcularTotais } = await import("../regras.ts");
const { PropostaDetalhe } = await import("../../../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx");

type Termos = Parameters<typeof calcularTotais>[0];

export const TERMOS_BASE: Termos = {
  valorBase: 3000, descontoPct: 0, descontoValor: 0, motivoDesconto: null, descontoEstadiaPct: 0, meses: 6, dias: 180,
  dataEntrada: "2026-12-20", condominio: 450, consumo: 200, limpezasMes: 0, valorLimpeza: 0, taxaPet: 0, limpezaUnica: 0,
} as Termos;

export function proposta(o: { papel: "owner" | "tenant"; status?: string; termos?: Partial<Termos>; preAceitacao?: unknown; taxa?: unknown }) {
  const termos = { ...TERMOS_BASE, ...(o.termos ?? {}) } as Termos;
  const v = { versao: 1, autor: "owner", termos, totais: calcularTotais(termos), pessoas: 1, mensagem: null, criadaEm: "2026-11-10T12:00:00Z", mudou: [] };
  return {
    preAceitacao: o.preAceitacao ?? null, id: "00000000-0000-4000-8000-000000000001", numero: "ORC-T2033", status: o.status ?? "aceita", papel: o.papel,
    leadId: "00000000-0000-4000-8000-000000000002", imovel: { id: "00000000-0000-4000-8000-000000000003", titulo: "Apto Centro" },
    outraParte: o.papel === "owner" ? "Morador Teste" : "Dono Teste", outraParteLinkedin: false, outraParteVinculo: null,
    partes: { proprietario: "Dono Teste", interessado: "Morador Teste" }, registro: null, versaoAtual: 1, validaAte: "2026-11-20T12:00:00Z",
    vistoEm: null, recusa: null, versoes: [v], atual: v, vez: "tenant", podeResponder: false, bloqueioContraproposta: null, itensLiberados: [],
    descontos: [], limites: { mesesMin: 1, mesesMax: 6 }, taxa: o.taxa ?? null, fechamentoUrl: null,
  };
}

export function renderizar(view: ReturnType<typeof proposta>): string {
  return renderToStaticMarkup(createElement(PropostaDetalhe, { p: view as never }));
}

/** Texto visível (sem tags), espaços normalizados. */
export function textoDe(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
