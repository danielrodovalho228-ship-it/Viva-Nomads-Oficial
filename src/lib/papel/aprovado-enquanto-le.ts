/**
 * E464: "a parceria está aprovada?" enquanto a leitura do servidor não volta. Antes valia `false` até a resposta — e o
 * cabeçalho de quem escolheu o papel parceiro nascia como proprietário/morador e trocava depois. Agora, sem resposta,
 * vale o papel guardado (só é gravado como parceiro com a parceria aprovada); com resposta, vale a resposta. PURO.
 */
export function parceiroAprovadoAgora(lido: boolean | null, preferenciaParceiro: boolean): boolean {
  return lido ?? preferenciaParceiro;
}
