/*
  E374: o placeholder cinza de uma foto que não carregou/não existe mostra um texto de apoio (a descrição da foto). Quando o "texto" é um
  NOME DE ARQUIVO ou um marcador de teste ("Foto QA Premium 1 - Sala", "[TESTE QA] …", "sala.webp"), ele nunca deve chegar ao usuário.
  PURO (node --test): devolve o rótulo seguro ou undefined.
*/
const MARCADOR_DE_TESTE = /\bQA\b|\[\s*teste|\bteste\s*qa\b|\bfoto\s+qa\b/i;
const NOME_DE_ARQUIVO = /\.(jpe?g|png|webp|gif|avif|heic|svg)\s*$|^[\w-]+[_-]\d+\.\w{3,4}$/i;

export function rotuloSeguroDaFoto(label: string | null | undefined): string | undefined {
  const t = (label ?? "").replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  if (MARCADOR_DE_TESTE.test(t) || NOME_DE_ARQUIVO.test(t)) return undefined;
  if (/^(https?:)?\/\//i.test(t) || t.startsWith("/")) return undefined; // endereço de arquivo
  return t;
}
