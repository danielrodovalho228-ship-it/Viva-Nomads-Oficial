import { adm } from "./laboratorio";
import { lerMetadados, problemaDeMetadado } from "./exif";

const EH_IMAGEM = /\.(jpe?g|png|webp|heic|heif|gif)$/i;

/**
 * Baixa do depósito (Storage do laboratório, service role) toda imagem em `prefixo` criada desde `desde` e devolve as
 * que guardaram EXIF ou GPS. `conferidas` diz quantas imagens foram abertas: zero quer dizer que o envio não chegou
 * ao depósito, e o teste avisa em vez de passar no vazio.
 */
export async function metadadoNoDeposito(bucket: string, prefixo: string, desde: Date): Promise<{ conferidas: number; problemas: string[] }> {
  const st = adm().storage.from(bucket);
  const caminhos: string[] = [];
  const pastas = [prefixo.replace(/\/$/, "")];
  while (pastas.length) {
    const pasta = pastas.shift()!;
    const { data, error } = await st.list(pasta, { limit: 1000 });
    if (error) throw new Error(`listar ${bucket}/${pasta}: ${error.message}`);
    for (const item of data ?? []) {
      const caminho = pasta ? `${pasta}/${item.name}` : item.name;
      if (!item.id) pastas.push(caminho); // pasta
      else if (EH_IMAGEM.test(item.name) && new Date(item.created_at ?? 0) >= desde) caminhos.push(caminho);
    }
  }
  const problemas: string[] = [];
  for (const caminho of caminhos) {
    const { data, error } = await st.download(caminho);
    if (error || !data) throw new Error(`baixar ${bucket}/${caminho}: ${error?.message ?? "vazio"}`);
    const m = lerMetadados(Buffer.from(await data.arrayBuffer()));
    const p = problemaDeMetadado(m);
    if (p) problemas.push(`${bucket}/${caminho} (${m.formato}): ${p}`);
  }
  return { conferidas: caminhos.length, problemas };
}
