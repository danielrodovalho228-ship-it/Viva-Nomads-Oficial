/*
  E1044: a ordem fixa das listas de pagamentos de um contrato. O pagamentos_bloco embutido na leitura do contrato não
  tem ORDER BY (a ordem era a do armazenamento e mudava a cada UPDATE). Ordena como o admin (data_pagamento) e, no
  empate — a data é só o dia —, por created_at e id. PURO; devolve uma cópia.
*/
type LinhaPagamento = { id?: unknown; data_pagamento?: unknown; created_at?: unknown };

const txt = (v: unknown) => (v == null ? "" : String(v));

export function ordenarPagamentos<T extends LinhaPagamento>(linhas: readonly T[]): T[] {
  return [...linhas].sort(
    (a, b) =>
      txt(a.data_pagamento).localeCompare(txt(b.data_pagamento)) ||
      txt(a.created_at).localeCompare(txt(b.created_at)) ||
      txt(a.id).localeCompare(txt(b.id)),
  );
}
