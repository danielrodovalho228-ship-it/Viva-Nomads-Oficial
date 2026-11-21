/*
  E981 — como o salvarItemNivel grava um item de Conforto/Premium quando NÃO chega foto nova (PURO).
  A 0242 exige origem em toda linha com foto (nivel_itens_foto_com_origem) e o Postgres valida a linha proposta do
  INSERT antes de resolver o ON CONFLICT. O upsert repetia o foto_path gravado sem a origem: desmarcar ou remarcar
  "O imóvel tem" num item que já tinha foto era sempre recusado (23514).
  Regra: sem foto nova, numa linha que já existe, grava-se SÓ a declaração, por UPDATE — a foto e a origem dela não
  entram. Com foto nova, ou sem linha ainda, segue o upsert de sempre.
*/
export interface CamposDaDeclaracao {
  declarado: boolean;
  declarado_por: string;
  declarado_em: string;
}

/** Só a declaração muda (update), ou a linha inteira vai por upsert? */
export function gravaSoADeclaracao(c: { existeLinha: boolean; novaFoto: boolean }): boolean {
  return c.existeLinha && !c.novaFoto;
}

/** Os únicos campos que o update da declaração escreve. */
export function camposDaDeclaracao(c: { declarado: boolean; uid: string; agora: string }): CamposDaDeclaracao {
  return { declarado: c.declarado, declarado_por: c.uid, declarado_em: c.agora };
}
