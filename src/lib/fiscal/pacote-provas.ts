import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { conteudoPacoteProvas, type DadosProvas } from "@/lib/contrato-provas";
import { numeroPublicoContrato } from "@/lib/contrato-ref";
import { nomeCompleto } from "@/lib/perfil/perfil-publico";
import { gerarPdf } from "@/lib/fiscal/pdf";
import { emitidoEmBrasilia, linhaConferir, numeroExibido, rotuloRegistro } from "@/lib/fiscal/prefixos";
import { registrarDocumento, registroDe } from "@/lib/fiscal/registro";
import { SITE_URL } from "@/lib/site";

/**
 * Pacote de provas registrado (Prompt 56): cada geração ganha um número PRV próprio, o código de conferência e o hash
 * do PDF no registro único. Serve às partes e à equipe (as rotas conferem quem pede antes de chamar).
 */
export async function gerarPacoteProvasRegistrado(d: DadosProvas, emitidoPor: string): Promise<Uint8Array | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: c } = await admin.from("contratos").select("tenant_id, properties(owner_id)").eq("id", d.contratoId).maybeSingle();
  if (!c) return null;
  const ownerId = (c.properties as unknown as { owner_id: string } | null)?.owner_id ?? null;
  // E1069: as assinaturas trazem o nome de quem assinou (só o nome: nunca contato nem documento). As duas rotas
  // (partes e equipe) passam por aqui. Leitura que falha não vira pacote sem nome (achado 77): lança → 503.
  const idsPartes = [ownerId, c.tenant_id as string].filter((x): x is string => !!x);
  const { data: perfis, error: ePerfis } = await admin.from("profiles").select("id, full_name").in("id", idsPartes);
  if (ePerfis) throw new Error("Não foi possível ler os nomes das partes para o pacote de provas.");
  const nomeDe = (id: string | null) => nomeCompleto(((perfis ?? []) as { id: string; full_name: string | null }[]).find((p) => p.id === id)?.full_name ?? null);
  const dados: DadosProvas = { ...d, nomes: { proprietario: nomeDe(ownerId), inquilino: nomeDe(c.tenant_id as string) } };
  const ct = await registroDe(admin, { tabela: "contratos", id: d.contratoId });
  const contrato = [numeroPublicoContrato(d.contratoId), ct ? rotuloRegistro(ct.registroSeq) : null].filter(Boolean).join(" · ");
  const emitidoEm = new Date().toISOString();
  const reg = await registrarDocumento(admin, {
    prefixo: "PRV",
    tipo: "pacote_provas",
    ref: { tabela: "contratos", id: d.contratoId },
    partes: [ownerId, c.tenant_id as string],
    emitidoPor,
    conteudo: ({ numero, versao, codigo }) =>
      gerarPdf(
        conteudoPacoteProvas(dados, {
          cabecalho: { numero: numeroExibido(numero, versao), emitidoEm: emitidoEmBrasilia(emitidoEm), conferir: linhaConferir(SITE_URL, codigo) },
          contrato,
        }),
      ),
  });
  return reg.bytes as Uint8Array;
}
