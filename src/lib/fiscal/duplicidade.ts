/*
  E546 — guarda contra recibo em DUPLICIDADE (puro, node --test). O idempotente de emitir() já impede 2 documentos do
  MESMO pagamento; o caso de 19/10 foi outro: dois pagamentos do 1º bloco da mesma estadia em dois contratos (o encerrado
  e o que o refez) geraram REC-2026-000004 e REC-2026-000005 iguais — mesmo dono, morador, imóvel, valor e período
  sobreposto — e os dois somavam no resumo do mês. Um documento novo igual a um VÁLIDO já emitido não sai.
*/
export interface ReciboComparavel {
  ownerId: string;
  tenantId: string;
  imovelEndereco: string;
  /** Frente 3 (t227): o imóvel do contrato. Com os dois lados conhecidos, compara por ele; o texto do endereço só vale para
   *  documento antigo sem imóvel (dois imóveis diferentes podem ter o mesmo endereço em texto). */
  propertyId?: string | null;
  valor: number;
  periodoInicio: string | null;
  periodoFim: string | null;
}

const sobrepoe = (a: ReciboComparavel, b: ReciboComparavel): boolean => {
  if (!a.periodoInicio || !a.periodoFim || !b.periodoInicio || !b.periodoFim) return !a.periodoInicio && !b.periodoInicio;
  return a.periodoInicio <= b.periodoFim && b.periodoInicio <= a.periodoFim;
};

/** O documento novo repete um válido (mesmo dono, morador, imóvel e valor, com período sobreposto)? Devolve o repetido. */
export function duplicidadeDeRecibo<T extends ReciboComparavel>(novo: ReciboComparavel, validos: readonly T[]): T | null {
  const endereco = novo.imovelEndereco.trim().toLowerCase();
  return (
    validos.find(
      (v) =>
        v.ownerId === novo.ownerId &&
        v.tenantId === novo.tenantId &&
        (novo.propertyId && v.propertyId ? v.propertyId === novo.propertyId : v.imovelEndereco.trim().toLowerCase() === endereco) &&
        Math.abs(Number(v.valor) - Number(novo.valor)) < 0.005 &&
        sobrepoe(v, novo),
    ) ?? null
  );
}

export const MOTIVO_DUPLICIDADE = "registro em duplicidade";
