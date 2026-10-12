// Lista (NÃO apaga) objetos do bucket property-photos cujo conteúdo não é
// JPEG/PNG/WebP de verdade, para o Daniel decidir (ordem 99c4d365).
// Somente leitura. Uso (segredo só no ambiente, nunca no repositório):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/listar-fotos-invalidas.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = "property-photos";

function tipo(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

async function listar(prefixo = "") {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefixo, { limit: 100, offset });
    if (error) throw error;
    if (!data?.length) break;
    for (const o of data) {
      const caminho = prefixo ? `${prefixo}/${o.name}` : o.name;
      if (o.id === null) out.push(...(await listar(caminho))); // pasta
      else out.push(caminho);
    }
    if (data.length < 100) break;
  }
  return out;
}

const objetos = await listar();
let invalidos = 0;
for (const caminho of objetos) {
  const { data, error } = await sb.storage.from(BUCKET).download(caminho);
  if (error || !data) { console.log(`ERRO\t${caminho}\t${error?.message ?? "sem dados"}`); continue; }
  const bytes = Buffer.from(await data.slice(0, 16).arrayBuffer());
  if (!tipo(bytes)) { invalidos++; console.log(`INVALIDO\t${caminho}`); }
}
console.log(`\n${objetos.length} objetos conferidos, ${invalidos} inválidos (nada foi apagado).`);
