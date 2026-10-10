import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { BUCKET_ANEXOS, TAMANHO_MAXIMO_ANEXO } from "@/lib/agentes/anexos";
import { abrirAnexo, enviarAnexo, type DepsAnexos } from "@/lib/agentes/anexos-servico";

/** Central v2 — anexos do chat. Só admin (403); arquivo no bucket privado, lido por URL assinada de 10 min. */
async function depsReais(): Promise<DepsAnexos> {
  const supabase = await createClient();
  const storage = createAdminClient()?.storage.from(BUCKET_ANEXOS);
  return {
    async adminId() {
      if (!supabase) return null;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user && (await ehAdmin(supabase, user.id)) ? user.id : null;
    },
    novoId: () => crypto.randomUUID(),
    async guardar(caminho, conteudo, mime) {
      if (!storage) return false;
      const { error } = await storage.upload(caminho, conteudo, { contentType: mime, upsert: false });
      return !error;
    },
    async assinar(caminho, segundos) {
      if (!storage) return null;
      const { data } = await storage.createSignedUrl(caminho, segundos);
      return data?.signedUrl ?? null;
    },
  };
}

export async function POST(request: Request) {
  const deps = await depsReais();
  if (!(await deps.adminId())) return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  const declarado = Number(request.headers.get("content-length") ?? 0);
  if (declarado > TAMANHO_MAXIMO_ANEXO + 64 * 1024) return NextResponse.json({ erro: "Arquivo acima de 20 MB." }, { status: 400 });
  const form = await request.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  if (!(arquivo instanceof File)) return NextResponse.json({ erro: "Envie um arquivo." }, { status: 400 });
  const r = await enviarAnexo(deps, {
    nome: arquivo.name,
    mime: arquivo.type,
    bytes: arquivo.size,
    conteudo: new Uint8Array(await arquivo.arrayBuffer()),
  });
  return NextResponse.json(r.body, { status: r.status });
}

export async function GET(request: Request) {
  const caminho = new URL(request.url).searchParams.get("caminho") ?? "";
  const r = await abrirAnexo(await depsReais(), caminho);
  return NextResponse.json(r.body, { status: r.status });
}
