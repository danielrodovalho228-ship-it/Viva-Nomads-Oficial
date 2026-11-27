/*
  E662 — lembretes do dono antes da entrada. São LEMBRETES, não obrigações: não entram no checklist "Antes da entrada" (que
  mede o que falta para a estadia começar), não bloqueiam nada e não têm "feito". As falhas físicas (bateria da fechadura,
  imóvel liberado) aparecem aqui porque a fechadura e a recepção costumam ser do CONDOMÍNIO — a Viva só conecta. PURO.
*/
export interface LembreteEntrega {
  chave: "saida" | "fechadura" | "liberado";
  rotulo: string;
  texto: string;
}

export function lembretesDeEntrega(e: { instrucaoSaidaPreenchida: boolean }): LembreteEntrega[] {
  const itens: LembreteEntrega[] = [];
  if (!e.instrucaoSaidaPreenchida) {
    itens.push({ chave: "saida", rotulo: "Instrução de saída", texto: "Escreva em Instruções como o morador deve sair (horário, o que deixar, chaves e a regra de devolução do condomínio): é um texto só, igual para vocês dois." });
  }
  itens.push(
    { chave: "fechadura", rotulo: "Bateria da fechadura", texto: "Se a fechadura é eletrônica, confira a bateria antes da entrada. Se ela é do condomínio, avise a recepção." },
    { chave: "liberado", rotulo: "Imóvel liberado", texto: "Confirme que o imóvel está liberado e pronto para a entrada; se depende da recepção, combine com ela antes." },
  );
  return itens;
}
