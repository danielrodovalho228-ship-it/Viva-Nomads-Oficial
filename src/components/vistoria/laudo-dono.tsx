import type { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { brl } from "@/lib/fiscal/documento";
import { dataBRT } from "@/lib/datas-brasilia";
import { ROTULO_NIVEL } from "@/config/niveis";
import { itemChecklist } from "@/config/checklist-avaliacao";
import { ROTULO_RESULTADO, podeContestar, type Resultado } from "@/lib/vistoria/laudo";
import { proximoPasso } from "@/lib/vistoria/laudo-documento";
import { degrauDoProprietario } from "@/lib/vistoria/strikes";
import { strikesDoDono } from "@/lib/vistoria/laudo-servidor";
import { confirmarDevolucao, contestarLaudo, enviarFotoCorrecao } from "@/lib/vistoria/laudo-actions";
import { ROTULO_ACAO, acoesDoResultado, avisoStrike, linhaAvaliadoEm, linhaResumoGrupo } from "@/lib/vistoria/telas-laudo";

const BUCKET_FOTOS = "avaliacao-imovel";
const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";
const ROTULO_BLOQUEIO: Record<string, string> = {
  seguranca_grave: "Fora da busca: item de segurança não conforme. Volta com a correção comprovada.",
  strike_2: "Republicar este anúncio só com uma nova avaliação aprovada.",
  strike_3: "Todos os seus anúncios estão fora da busca até uma nova avaliação aprovada.",
};

type Laudo = {
  id: string;
  pedido_id: string;
  avaliador_id: string | null;
  resumo: { grupo: string; rotulo: string; conformes: number; naoConformes: string[] }[] | null;
  numero: string;
  versao: number;
  resultado: Resultado;
  nivel_sustentado: keyof typeof ROTULO_NIVEL | "em_adequacao";
  ressalvas: { chave: string; reverificacao: "foto" | "visita" }[];
  graves: string[];
  emitido_em: string;
  prazo_ressalva_ate: string | null;
  corrigido_em: string | null;
  ressalva_vencida_em: string | null;
  vistoriado_em: string | null;
  contestado_em: string | null;
  documento_id: string | null;
};

/**
 * O laudo no painel do dono (Prompt 62-B2, ESQUELETO; o desenho é do 62-A): resultado, nível sustentado, o que corrigir
 * com o prazo, foto da correção, contestação (7 dias), devolução a confirmar, o passo da escada e os bloqueios.
 */
export async function LaudoDono({ admin, propertyId, ownerId }: { admin: SupabaseClient; propertyId: string; ownerId: string }) {
  const agora = new Date();
  const [{ data: ls }, { data: bloqueios }, { data: devolucoes }, strikes, { data: imoveis }] = await Promise.all([
    admin.from("vistoria_laudos").select("id, pedido_id, avaliador_id, resumo, numero, versao, resultado, nivel_sustentado, ressalvas, graves, emitido_em, prazo_ressalva_ate, corrigido_em, ressalva_vencida_em, vistoriado_em, contestado_em, documento_id").eq("property_id", propertyId).order("emitido_em", { ascending: false }).order("versao", { ascending: false }).limit(1),
    admin.from("vistoria_bloqueios").select("motivo").eq("property_id", propertyId).is("resolvido_em", null),
    admin.from("vistoria_devolucoes").select("id, valor, prazo_ate").eq("owner_id", ownerId).is("recebido_confirmado_em", null),
    strikesDoDono(admin, ownerId),
    admin.from("properties").select("id").eq("owner_id", ownerId).in("status", ["active", "paused"]),
  ]);
  const l = ((ls ?? [])[0] ?? null) as Laudo | null;
  const degrau = degrauDoProprietario({ strikes, carteira: (imoveis ?? []).length, imoveisReprovados12m: 0, agora });
  const [{ data: doc }, { data: cred }, { data: fotos }] = await Promise.all([
    l?.documento_id ? admin.from("documentos_registro").select("codigo_verificacao").eq("id", l.documento_id).maybeSingle() : Promise.resolve({ data: null }),
    l?.avaliador_id ? admin.from("avaliadores_credenciamento").select("numero_credenciado").eq("id", l.avaliador_id).maybeSingle() : Promise.resolve({ data: null }),
    l ? admin.from("vistoria_checklist_fotos").select("item_chave, path").eq("pedido_id", l.pedido_id).not("item_chave", "is", null) : Promise.resolve({ data: null }),
  ]);
  // A foto de cada item não conforme, por URL assinada de 10 minutos (o caminho no bucket não vai para a tela).
  const listaFotos = (fotos ?? []) as { item_chave: string; path: string }[];
  const assinadas = listaFotos.length ? ((await admin.storage.from(BUCKET_FOTOS).createSignedUrls(listaFotos.map((f) => f.path), 600)).data ?? []) : [];
  const fotoDoItem = new Map(listaFotos.map((f, i) => [f.item_chave, assinadas[i]?.signedUrl ?? null]));
  if (!l && !(bloqueios ?? []).length && !(devolucoes ?? []).length && degrau === 0) return null;
  const aberta = !!l && !l.corrigido_em && !l.ressalva_vencida_em && !l.contestado_em;
  const itensCorrigir = l ? [...new Set([...l.ressalvas.map((r) => r.chave), ...l.graves])] : [];
  const contestar = l ? podeContestar(l.emitido_em, agora, !!l.contestado_em) : null;
  const acoes = l
    ? acoesDoResultado({ resultado: l.resultado, emitidoEm: l.emitido_em, prazoRessalvaAte: l.prazo_ressalva_ate, corrigidoEm: l.corrigido_em, ressalvaVencidaEm: l.ressalva_vencida_em, contestadoEm: l.contestado_em }, agora)
    : [];
  const aviso = avisoStrike(degrau);

  return (
    <div className="mb-4 grid gap-3 text-sm" data-testid="laudo-dono">
      {l && (
        <div data-testid="laudo-dono-resultado" data-resultado={l.resultado} data-vistoriado={l.vistoriado_em ? "sim" : "nao"}>
          <p className="font-semibold text-ink">
            Laudo {l.numero}{l.versao > 1 ? ` v${l.versao}` : ""} · {ROTULO_RESULTADO[l.resultado]} · nível sustentado: {l.nivel_sustentado === "em_adequacao" ? "em adequação" : ROTULO_NIVEL[l.nivel_sustentado]}
          </p>
          {l.vistoriado_em && cred?.numero_credenciado && (
            <p className="text-muted" data-testid="laudo-avaliado-em">{linhaAvaliadoEm(l.vistoriado_em, String(cred.numero_credenciado))}</p>
          )}
          <p className="mt-1 text-ink">{proximoPasso(l.resultado, l.prazo_ressalva_ate)}</p>
          {acoes.length > 0 && (
            <p className="mt-1" data-testid="laudo-acoes" data-acoes={acoes.join(" ")}>
              {acoes.map((a, i) => (
                <span key={a}>
                  {i > 0 ? " · " : ""}
                  <a href={a === "nova_avaliacao" ? "#rota-avaliacao" : a === "contestar" ? "#contestar" : "#o-que-corrigir"} className="font-semibold text-forest underline underline-offset-2">{ROTULO_ACAO[a]}</a>
                </span>
              ))}
            </p>
          )}
          {l.resumo && l.resumo.length > 0 && (
            <ul className="mt-2 grid gap-x-4 sm:grid-cols-2" data-testid="laudo-resumo">
              {l.resumo.map((g) => (
                <li key={g.grupo} className="flex justify-between gap-2 border-b border-line py-1" data-testid="laudo-resumo-grupo" data-grupo={g.grupo}>
                  <span className="text-ink">{g.rotulo}</span>
                  <span className={g.naoConformes.length ? "text-amber-700" : "text-muted"}>{linhaResumoGrupo(g)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1">
            <a href={`/api/vistoria/laudo/${l.id}`} className="underline">Baixar o laudo</a>
            {doc?.codigo_verificacao ? (
              <>
                {" · "}
                <a href={`/conferir?codigo=${encodeURIComponent(String(doc.codigo_verificacao))}`} className="underline" data-testid="laudo-conferir">Conferir o laudo</a>
              </>
            ) : null}
          </p>
        </div>
      )}
      {l && aberta && itensCorrigir.length > 0 && (
        <div id="o-que-corrigir" data-testid="laudo-ressalvas">
          <p className="font-semibold text-ink">O que corrigir{l.prazo_ressalva_ate ? ` até ${dataBRT(l.prazo_ressalva_ate)}` : ""}</p>
          <ul className="mt-1 grid gap-2">
            {itensCorrigir.map((chave) => {
              const r = l.ressalvas.find((x) => x.chave === chave);
              return (
                <li key={chave} data-testid="laudo-ressalva" data-chave={chave}>
                  <span className="flex items-start gap-3">
                    {fotoDoItem.get(chave) && (
                      // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do bucket privado
                      <img src={fotoDoItem.get(chave)!} alt={`Foto do avaliador: ${itemChecklist(chave)?.rotulo ?? chave}`} className="h-16 w-16 shrink-0 rounded-lg object-cover" data-testid="laudo-ressalva-foto" />
                    )}
                    <span>
                      {itemChecklist(chave)?.rotulo ?? chave}
                      {l.graves.includes(chave) ? " (segurança)" : ""} · reverificação por {r?.reverificacao === "visita" ? "nova visita" : "foto"}
                    </span>
                  </span>
                  {r?.reverificacao !== "visita" && (
                    <FormAcao acao={enviarFotoCorrecao} className="mt-1 flex flex-wrap items-end gap-2" testid={`correcao-foto-${chave}`}>
                      <input type="hidden" name="laudoId" value={l.id} />
                      <input type="hidden" name="item" value={chave} />
                      <input type="file" name="foto" accept="image/jpeg,image/png,image/webp" required aria-label={`Foto da correção: ${itemChecklist(chave)?.rotulo ?? chave}`} className={campo} />
                      <Button type="submit" size="sm" variant="secondary">Enviar a foto da correção</Button>
                    </FormAcao>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {l && contestar?.ok && (
        <div id="contestar">
        <FormAcao acao={contestarLaudo} className="grid gap-2" testid="contestar-laudo">
          <input type="hidden" name="laudoId" value={l.id} />
          <label>
            Contestar o laudo (até 7 dias da emissão): outro avaliador credenciado faz a 2ª avaliação. Você paga a 2ª direto ao 2º avaliador; se ela der razão a você, o 1º avaliador devolve o valor.
            <textarea name="motivo" rows={2} required minLength={10} maxLength={500} className={campo} />
          </label>
          <Button type="submit" size="sm" variant="secondary">Contestar</Button>
        </FormAcao>
        </div>
      )}
      {(bloqueios ?? []).map((b) => (
        <p key={b.motivo as string} className="text-amber-700" data-testid="laudo-bloqueio" data-motivo={b.motivo as string}>{ROTULO_BLOQUEIO[b.motivo as string]}</p>
      ))}
      {aviso && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="laudo-degrau" data-degrau={degrau}>
          <p className="font-semibold text-ink">{aviso.titulo}</p>
          <p className="mt-1 text-ink">{aviso.texto}</p>
          {l && (
            <p className="mt-1 text-muted">
              Laudo {l.numero}: <a href={`/api/vistoria/laudo/${l.id}`} className="underline">o que corrigir</a>
              {l.prazo_ressalva_ate ? `, até ${dataBRT(l.prazo_ressalva_ate)}` : ""}.{" "}
              <a href="#rota-avaliacao" className="font-semibold text-forest underline underline-offset-2">Pedir nova avaliação</a>
            </p>
          )}
        </div>
      )}
      {((devolucoes ?? []) as { id: string; valor: number; prazo_ate: string }[]).map((d) => (
        <FormAcao key={d.id} acao={confirmarDevolucao} className="flex flex-wrap items-center gap-2" testid="devolucao-dono">
          <input type="hidden" name="devolucaoId" value={d.id} />
          <span>O 1º avaliador deve devolver {brl(Number(d.valor))} a você até {dataBRT(d.prazo_ate)}.</span>
          <Button type="submit" size="sm" variant="secondary">Confirmar que recebi</Button>
        </FormAcao>
      ))}
    </div>
  );
}
