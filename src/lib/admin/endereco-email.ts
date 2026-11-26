/**
 * E973: os pedaços de um endereço de e-mail onde a linha pode quebrar — depois do "@" e antes de cada ponto — para a
 * coluna estreita "Para" nunca cortar no meio da palavra. Juntos, os pedaços são o texto original. Puro.
 */
export function pedacosDoEndereco(endereco: string): string[] {
  return endereco.split(/(?<=@)|(?=\.)/).filter((p) => p.length > 0);
}
