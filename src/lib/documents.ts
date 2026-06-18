/**
 * Documentos do fluxo Orçamento → Fechamento → Contrato (Atualizações 13–17).
 *
 * Um documento nasce como ORÇAMENTO (editável), é enviado, pode ser recusado
 * (gera nova versão) ou ACEITO — virando um fechamento — e termina como
 * CONTRATO assinado. Cada documento tem número único rastreável e versão.
 *
 * A plataforma apenas gera, registra e documenta — não é locadora nem fiadora.
 */

export type DocType = "orcamento" | "contrato";

export type DocStatus =
  | "rascunho"
  | "enviado"
  | "visto"
  | "recusado"
  | "aceito"
  | "assinado"
  | "expirado";

export type LineItemPayer = "owner" | "tenant";

export interface LineItem {
  key: string;
  label: string;
  amount: number;
  payer: LineItemPayer;
  editable: boolean;
  recurring: boolean; // true = mensal; false = cobrança única
  suggested?: boolean; // valor de referência pré-preenchido
  hint?: string;
}

export interface DocumentRecord {
  id: string;
  docNumber: string; // ORC-AAAA-NNNN | CTR-AAAA-NNNN
  docType: DocType;
  version: number;
  propertyId: string;
  propertyTitle: string;
  ownerId: string;
  tenantName: string;
  tenantContact?: string; // e-mail/telefone quando não há cadastro
  status: DocStatus;
  totalValue: number;
  validUntil?: string; // ISO date (orçamento)
  parentDocumentId?: string; // liga orçamento → contrato
  lineItems: LineItem[];
  createdAt: string;
  sentAt?: string;
  signedAt?: string;
}

/** Rótulo + cor de cada status (badges). */
export const DOC_STATUS_META: Record<
  DocStatus,
  { label: string; tone: string }
> = {
  rascunho: { label: "Rascunho", tone: "bg-surface-2 text-muted" },
  enviado: { label: "Enviado", tone: "bg-blue-50 text-blue-700" },
  visto: { label: "Visto", tone: "bg-indigo-50 text-indigo-700" },
  recusado: { label: "Recusado", tone: "bg-red-50 text-red-700" },
  aceito: { label: "Aceito", tone: "bg-sage-100 text-forest" },
  assinado: { label: "Assinado", tone: "bg-emerald-100 text-emerald-800" },
  expirado: { label: "Expirado", tone: "bg-amber-50 text-amber-700" },
};

/** Documento é editável até ser assinado. */
export function isEditable(status: DocStatus): boolean {
  return status !== "assinado";
}

/** Formata o número do documento: ORC-2026-0042. */
export function formatDocNumber(type: DocType, year: number, seq: number): string {
  const prefix = type === "orcamento" ? "ORC" : "CTR";
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

// ── Sugestões de valores (Atualização 14) — ponto de partida editável ──

/** Consumo estimado por nº de quartos (água/luz/gás). */
export function suggestConsumo(bedrooms: number): number {
  if (bedrooms <= 1) return 150;
  if (bedrooms === 2) return 250;
  return 350;
}

/** Taxa de preparação/limpeza por metragem (~R$10/m², com piso e teto). */
export function suggestPrepFee(areaM2: number): number {
  const raw = areaM2 * 10;
  const clamped = Math.min(1500, Math.max(300, raw));
  return Math.round(clamped / 50) * 50; // arredonda para R$50
}

/** Monta os itens padrão de um orçamento a partir do imóvel. */
export function buildDefaultLineItems(p: {
  monthlyPrice: number;
  bedrooms: number;
  areaM2: number;
  prepFee?: number;
}): LineItem[] {
  const consumo = suggestConsumo(p.bedrooms);
  const prep = p.prepFee && p.prepFee > 0 ? p.prepFee : suggestPrepFee(p.areaM2);
  return [
    {
      key: "aluguel",
      label: "Aluguel mensal",
      amount: p.monthlyPrice,
      payer: "tenant",
      editable: true,
      recurring: true,
      hint: "Valor mensal do aluguel por temporada",
    },
    {
      key: "consumo",
      label: "Consumo estimado (água/luz/gás)",
      amount: consumo,
      payer: "tenant",
      editable: true,
      recurring: true,
      suggested: true,
      hint: `Sugerido para imóvel de ${p.bedrooms} quarto(s)`,
    },
    {
      key: "preparacao",
      label: "Preparação / limpeza (única)",
      amount: prep,
      payer: "tenant",
      editable: true,
      recurring: false,
      suggested: true,
      hint: `Sugerido para ${p.areaM2} m² (~R$10/m²)`,
    },
  ];
}

/** Soma dos itens (opcionalmente filtrando por pagador e/ou recorrência). */
export function sumItems(
  items: LineItem[],
  opts?: { payer?: LineItemPayer; recurring?: boolean }
): number {
  return items
    .filter((i) => (opts?.payer ? i.payer === opts.payer : true))
    .filter((i) => (opts?.recurring === undefined ? true : i.recurring === opts.recurring))
    .reduce((sum, i) => sum + i.amount, 0);
}

/** Total que o inquilino vê no 1º pagamento (mensal + cobranças únicas). */
export function firstPaymentTotal(items: LineItem[]): number {
  return sumItems(items, { payer: "tenant" });
}

/** Total do documento = o que o inquilino paga no 1º pagamento. */
export function documentTotal(items: LineItem[]): number {
  return firstPaymentTotal(items);
}

// ── Dados de exemplo (até o Supabase alimentar) ──

export const SAMPLE_DOCUMENTS: DocumentRecord[] = [
  {
    id: "doc-1",
    docNumber: "ORC-2026-0042",
    docType: "orcamento",
    version: 1,
    propertyId: "ube-001",
    propertyTitle: "Apartamento mobiliado com home office no Santa Mônica",
    ownerId: "demo-owner",
    tenantName: "Ana Carvalho",
    tenantContact: "ana.carvalho@email.com",
    status: "enviado",
    totalValue: 3600,
    validUntil: "2026-06-25",
    lineItems: [
      { key: "aluguel", label: "Aluguel mensal", amount: 3200, payer: "tenant", editable: true, recurring: true },
      { key: "consumo", label: "Consumo estimado (água/luz/gás)", amount: 250, payer: "tenant", editable: true, recurring: true, suggested: true },
      { key: "preparacao", label: "Preparação / limpeza (única)", amount: 150, payer: "tenant", editable: true, recurring: false, suggested: true },
    ],
    createdAt: "2026-06-18",
    sentAt: "2026-06-18",
  },
  {
    id: "doc-2",
    docNumber: "ORC-2026-0039",
    docType: "orcamento",
    version: 2,
    propertyId: "ube-002",
    propertyTitle: "Studio premium no Centro, ideal para estadia profissional",
    ownerId: "demo-owner",
    tenantName: "Dr. Bruno Tavares",
    tenantContact: "(34) 99999-1234",
    status: "aceito",
    totalValue: 2750,
    validUntil: "2026-06-22",
    lineItems: [
      { key: "aluguel", label: "Aluguel mensal", amount: 2400, payer: "tenant", editable: true, recurring: true },
      { key: "consumo", label: "Consumo estimado (água/luz/gás)", amount: 150, payer: "tenant", editable: true, recurring: true, suggested: true },
      { key: "preparacao", label: "Preparação / limpeza (única)", amount: 200, payer: "tenant", editable: true, recurring: false, suggested: true },
    ],
    createdAt: "2026-06-12",
    sentAt: "2026-06-13",
  },
  {
    id: "doc-3",
    docNumber: "CTR-2026-0031",
    docType: "contrato",
    version: 1,
    propertyId: "ube-003",
    propertyTitle: "Casa 3 quartos para famílias em transição",
    ownerId: "demo-owner",
    tenantName: "Família Moreira",
    status: "assinado",
    totalValue: 4450,
    parentDocumentId: "doc-old",
    lineItems: [
      { key: "aluguel", label: "Aluguel mensal", amount: 4100, payer: "tenant", editable: false, recurring: true },
      { key: "consumo", label: "Consumo estimado (água/luz/gás)", amount: 350, payer: "tenant", editable: false, recurring: true },
    ],
    createdAt: "2026-05-20",
    sentAt: "2026-05-21",
    signedAt: "2026-05-23",
  },
];

/** Próximo número sequencial de orçamento (demo: deriva da amostra). */
export function nextOrcamentoNumber(year = 2026): string {
  const seqs = SAMPLE_DOCUMENTS.filter((d) => d.docType === "orcamento").map((d) => {
    const n = Number(d.docNumber.split("-")[2]);
    return Number.isFinite(n) ? n : 0;
  });
  const next = (seqs.length ? Math.max(...seqs) : 0) + 1;
  return formatDocNumber("orcamento", year, next);
}
