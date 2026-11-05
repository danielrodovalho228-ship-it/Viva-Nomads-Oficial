/*
  E445 (item 3) — lista VERSIONADA de termos de ódio e xingamento GRAVE no chat. Não é filtro de palavrão leve
  ("droga", "merda", "porra" seguem livres): só ofensa dirigida, discriminação e ameaça. A pessoa é avisada antes de
  enviar; se enviar mesmo assim, o registro vai para a fila de moderação do admin (quem, conversa, termo).
  Mudança na lista = nova versão (o número abaixo) e os testes de falso positivo continuam passando.
  Os termos ficam sem acento e em minúsculas (a comparação normaliza o texto do mesmo jeito).
*/
export const VERSAO_LISTA_OFENSAS = 2;

/*
  E480 (v2): xingamento comum DIRIGIDO a alguém. O adjetivo sozinho não entra ("que ideia idiota", "trânsito burro"
  seguem livres); só a forma com alvo: "seu/sua X", "você é um/uma X", "vc é X". "lixo" fica fora ("seu lixo" também
  é o lixo da pessoa).
*/
const XINGAMENTOS_COMUNS: readonly (readonly [masculino: string, feminino: string])[] = [
  ["idiota", "idiota"],
  ["imbecil", "imbecil"],
  ["otario", "otaria"],
  ["babaca", "babaca"],
  ["burro", "burra"],
  ["cretino", "cretina"],
  ["palhaco", "palhaca"],
  ["escroto", "escrota"],
  ["safado", "safada"],
  ["canalha", "canalha"],
];

const DIRIGIDOS: readonly string[] = [
  ...new Set(
    XINGAMENTOS_COMUNS.flatMap(([m, f]) => [
      `seu ${m}`,
      `sua ${f}`,
      `voce e um ${m}`,
      `voce e uma ${f}`,
      `vc e um ${m}`,
      `vc e uma ${f}`,
      `voce e ${m}`,
      `voce e ${f}`,
      `vc e ${m}`,
      `vc e ${f}`,
    ]),
  ),
];

export const TERMOS_OFENSIVOS: readonly string[] = [
  // Xingamento grave dirigido
  "filho da puta",
  "filha da puta",
  "fdp",
  "arrombado",
  "arrombada",
  "vagabunda",
  "vadia",
  "desgracado",
  "desgracada",
  "corno",
  // Discriminação (deficiência, orientação, raça)
  "retardado",
  "retardada",
  "mongoloide",
  "viado",
  "traveco",
  "macaco imundo",
  "crioulo",
  "negro imundo",
  "preto imundo",
  // Ameaça
  "vou te matar",
  "vou acabar com voce",
  "vou te pegar",
  // E480 (v2): xingamento comum dirigido ("seu idiota", "você é um imbecil").
  ...DIRIGIDOS,
];
