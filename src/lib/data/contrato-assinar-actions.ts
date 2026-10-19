"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/notifications/email";
import { guardarSeContaDeTeste } from "@/lib/notifications/caixa-teste-servidor";
import {
  assuntoAvisoOutraParte,
  avisoAssinatura,
  linhasAssinatura,
  hashResumo,
  petsRegrasDoResumo,
  totalMesAplicavel,
  limpezaDoContrato,
  outrosCustosDoContrato,
  motivoNaoPodeAssinar,
  papelNoContrato,
  resumoContrato,
  linhasParaHash,
  type PapelContrato,
} from "@/lib/contrato-assinar";
import { qtdPetsCongelada } from "@/lib/anuncio/pets-regras";
import { normalizarLimpezaEstadia } from "@/lib/anuncio/limpeza-estadia";
import { motivoFaltamInstrucoes } from "@/lib/checkin";
import { instrucoesPreenchidas } from "@/lib/checkin-servidor";
import { nomeCurto } from "@/lib/perfil/perfil-publico";
import { estadoDoContratoUnico, type EstadoContrato } from "@/lib/contrato-estado";
import { escaparHtml } from "@/lib/escapar-html";
import { montarLinhaDoTempo, type EtapaEstadia } from "@/lib/estadia-linha-tempo";
import { periodoDosBlocos } from "@/lib/contrato-blocos";
import {
  MSG_CODIGO_BLOQUEADO,
  VALIDADE_CODIGO_ASSINATURA_MS,
  conferirCodigo,
  gerarCodigoAssinatura,
  hashCodigoAssinatura,
  incrementarFalhas,
  podeReenviar,
  type LinhaCodigo,
} from "@/lib/contrato-codigo";

/*
  Assinatura eletrônica na plataforma (ordem 0fd301f0, F40). A leitura passa pelo RLS (as duas partes);
  a gravação é SÓ do servidor: valida a sessão, o papel, o status e o aceite, e registra
  quem/quando/IP/hash do resumo que a pessoa viu em contrato_assinaturas.
*/

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ContratoParaAssinar {
  id: string;
  imovel: string;
  status: string;
  papel: PapelContrato;
  resumo: string[];
  assinadoProprietarioEm: string | null;
  assinadoInquilinoEm: string | null;
  aviso: string;
  euAssinei: boolean;
  /** F37: data de início da estadia (1º bloco), AAAA-MM-DD; entra no resumo; se a outra parte assinou antes disso, o hash segue o texto dela (linhasParaHash). */
  inicioEstadia: string | null;
  /** Entrada, conferência e saída com dia e horário (vazio se o contrato ainda não tem blocos). */
  linhaDoTempo: EtapaEstadia[];
  /** Estado pela fonte única (o mesmo selo das listas e da carteira). */
  estado: EstadoContrato;
}

interface LinhaContrato {
  id: string;
  tenant_id: string;
  status: string;
  aluguel_mensal: number | string;
  prazo_total_dias: number | string;
  qtd_ocupantes: number | string;
  created_at: string;
  assinado_proprietario_em: string | null;
  assinado_inquilino_em: string | null;
  properties: { title?: string; owner_id?: string; checkin_after?: string | null; checkout_before?: string | null; pets_regras?: unknown } | null;
  pets_regras_congeladas?: unknown;
  property_id?: string;
  /** Pacote de limpeza do anúncio agora (0144; só vale antes da 1ª assinatura). */
  limpeza_viva?: unknown;
  /** Condomínio + contas fixas do anúncio agora (só vale antes da 1ª assinatura). */
  outros_custos_vivos?: number;
  /** Pets do inquilino agora (só vale antes da 1ª assinatura; depois vale o congelado). */
  qtd_pets_vivos?: number;
  contrato_blocos?: { inicio: string; fim: string }[] | null;
  pagamentos_bloco?: { tipo?: string | null; confirmado_pelo_inquilino?: boolean | null }[] | null;
}

const COLUNAS =
  "id, tenant_id, status, aluguel_mensal, prazo_total_dias, qtd_ocupantes, created_at, assinado_proprietario_em, assinado_inquilino_em, pets_regras_congeladas, property_id, properties(title, owner_id, checkin_after, checkout_before, pets_regras), contrato_blocos(inicio, fim), pagamentos_bloco(tipo, confirmado_pelo_inquilino)";

function objetoOuVazio(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

async function contarPetsDoInquilino(tenantId: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;
  const { count } = await admin.from("pets_inquilino").select("id", { count: "exact", head: true }).eq("user_id", tenantId);
  return count ?? 0;
}

/** Depois da 1ª assinatura vale o número congelado; antes, o da ficha do inquilino agora. */
async function completarPets(c: LinhaContrato): Promise<void> {
  if (!c.assinado_proprietario_em && !c.assinado_inquilino_em) {
    c.qtd_pets_vivos = await contarPetsDoInquilino(c.tenant_id);
    c.limpeza_viva = await lerLimpezaViva(c.property_id);
    c.outros_custos_vivos = await lerOutrosCustosVivos(c.property_id);
  }
}

/** Condomínio + contas fixas do anúncio (R$ por mês); contas medidas não entram. Falha de leitura = 0. */
async function lerOutrosCustosVivos(propertyId: string | undefined): Promise<number> {
  const admin = createAdminClient();
  if (!admin || !propertyId) return 0;
  try {
    const { data } = await admin.from("properties").select("condo_fee, utilities_mode, utilities_estimate").eq("id", propertyId).maybeSingle();
    const p = data as { condo_fee?: number | null; utilities_mode?: string | null; utilities_estimate?: number | null } | null;
    if (!p) return 0;
    return outrosCustosDoContrato({
      algumaAssinatura: false,
      vivo: Number(p.condo_fee ?? 0) + (p.utilities_mode === "fixed" ? Number(p.utilities_estimate ?? 0) : 0),
      congeladas: null,
    });
  } catch {
    return 0;
  }
}

/** Pacote de limpeza do anúncio (0144). Leitura à parte: sem a migração, o contrato abre igual, sem a linha. */
async function lerLimpezaViva(propertyId: string | undefined): Promise<unknown> {
  const admin = createAdminClient();
  if (!admin || !propertyId) return null;
  try {
    const { data } = await admin.from("properties").select("limpeza_estadia").eq("id", propertyId).maybeSingle();
    return (data as { limpeza_estadia?: unknown } | null)?.limpeza_estadia ?? null;
  } catch {
    return null;
  }
}

function montar(c: LinhaContrato, userId: string, nomes?: { proprietario: string | null; inquilino: string | null }): ContratoParaAssinar | null {
  const ownerId = String(c.properties?.owner_id ?? "");
  const papel = papelNoContrato(userId, c.tenant_id, ownerId);
  if (!papel) return null;
  const imovel = c.properties?.title ?? "Imóvel";
  const { inicio, fim } = periodoDosBlocos(c.contrato_blocos ?? []);
  const resumo = resumoContrato({
    contratoId: c.id,
    imovel,
    aluguelMensal: Number(c.aluguel_mensal),
    prazoDias: Number(c.prazo_total_dias),
    ocupantes: Number(c.qtd_ocupantes),
    criadoEm: c.created_at.slice(0, 10),
    inicioEstadia: inicio,
    petsRegras: petsRegrasDoResumo({
      algumaAssinatura: !!(c.assinado_proprietario_em || c.assinado_inquilino_em),
      vivas: c.properties?.pets_regras,
      congeladas: c.pets_regras_congeladas,
    }),
    qtdPetsCandidatura:
      c.assinado_proprietario_em || c.assinado_inquilino_em ? qtdPetsCongelada(c.pets_regras_congeladas) : (c.qtd_pets_vivos ?? 0),
    limpezaEstadia: limpezaDoContrato({
      algumaAssinatura: !!(c.assinado_proprietario_em || c.assinado_inquilino_em),
      viva: c.limpeza_viva,
      congeladas: c.pets_regras_congeladas,
    }),
    outrosCustosMes: outrosCustosDoContrato({
      algumaAssinatura: !!(c.assinado_proprietario_em || c.assinado_inquilino_em),
      vivo: c.outros_custos_vivos,
      congeladas: c.pets_regras_congeladas,
    }),
    semTotalMes: !totalMesAplicavel({
      algumaAssinatura: !!(c.assinado_proprietario_em || c.assinado_inquilino_em),
      congeladas: c.pets_regras_congeladas,
    }),
  });
  const a = { proprietario: c.assinado_proprietario_em, inquilino: c.assinado_inquilino_em };
  return {
    id: c.id,
    imovel,
    status: c.status,
    papel,
    resumo,
    assinadoProprietarioEm: a.proprietario,
    assinadoInquilinoEm: a.inquilino,
    aviso: avisoAssinatura(papel, {
      proprietario: { nome: nomes?.proprietario ?? null, em: a.proprietario },
      inquilino: { nome: nomes?.inquilino ?? null, em: a.inquilino },
    }),
    euAssinei: !!(papel === "inquilino" ? a.inquilino : a.proprietario),
    estado: estadoDoContratoUnico(c, papel),
    inicioEstadia: inicio,
    linhaDoTempo: montarLinhaDoTempo({
      inicio,
      fim,
      checkinAfter: c.properties?.checkin_after ?? null,
      checkoutBefore: c.properties?.checkout_before ?? null,
    }),
  };
}

/** Detalhe do contrato para as duas partes. null = não existe ou a pessoa não é parte (o RLS esconde). */
export async function getContratoParaAssinar(contratoId: string): Promise<ContratoParaAssinar | null> {
  if (!UUID_RE.test(contratoId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("contratos").select(COLUNAS).eq("id", contratoId).maybeSingle();
  if (!data) return null;
  // O RLS acima já provou que a pessoa é parte; o dono não lê a ficha do inquilino, então a contagem vem do servidor.
  const linha = data as unknown as LinhaContrato;
  await completarPets(linha);
  return montar(linha, user.id, await nomesDasPartes(String(linha.properties?.owner_id ?? ""), linha.tenant_id));
}

/** Nome curto das duas partes (só o nome: nunca contato nem documento) — para "Ana S. (proprietário) assinou em…". */
async function nomesDasPartes(ownerId: string, tenantId: string): Promise<{ proprietario: string | null; inquilino: string | null }> {
  const admin = createAdminClient();
  if (!admin) return { proprietario: null, inquilino: null };
  const { data } = await admin.from("profiles").select("id, full_name").in("id", [ownerId, tenantId].filter(Boolean));
  const nome = (id: string) => nomeCurto((((data ?? []) as { id: string; full_name: string | null }[]).find((p) => p.id === id)?.full_name ?? "").replace(/\S+@\S+/g, "").trim());
  return { proprietario: nome(ownerId), inquilino: nome(tenantId) };
}

/** Envia ao e-mail da conta um código de 6 dígitos, de uso único, que vale 15 minutos (conferido no servidor). */
export async function pedirCodigoAssinatura(contratoId: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(String(contratoId))) return { ok: false, error: "Contrato inválido." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Entre para assinar." };
  const { data } = await admin.from("contratos").select(COLUNAS).eq("id", contratoId).maybeSingle();
  const c = data as unknown as LinhaContrato | null;
  if (c) await completarPets(c);
  const visao = c ? montar(c, user.id) : null;
  if (!c || !visao) return { ok: false, error: "Contrato não encontrado." };
  if (c.status !== "ativo") return { ok: false, error: "Este contrato não está mais aguardando assinatura." };
  if (visao.euAssinei) return { ok: false, error: "Você já assinou este contrato." };
  const faltam = motivoFaltamInstrucoes({ papel: visao.papel, preenchidas: await instrucoesPreenchidas(admin, c.id) });
  if (faltam) return { ok: false, error: faltam };

  const agora = Date.now();
  const { data: atual } = await admin
    .from("contrato_assinatura_codigos")
    .select("enviado_em")
    .eq("contrato_id", c.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!podeReenviar(atual as { enviado_em: string } | null, agora)) {
    return { ok: false, error: "Espere 1 minuto para pedir outro código." };
  }
  const codigo = gerarCodigoAssinatura();
  const { error: errGrava } = await admin.from("contrato_assinatura_codigos").upsert(
    {
      contrato_id: c.id,
      user_id: user.id,
      codigo_hash: hashCodigoAssinatura(user.id, c.id, codigo),
      expira_em: new Date(agora + VALIDADE_CODIGO_ASSINATURA_MS).toISOString(),
      falhas: 0,
      usado_em: null,
      enviado_em: new Date(agora).toISOString(),
    },
    { onConflict: "contrato_id,user_id" },
  );
  if (errGrava) return { ok: false, error: "Não foi possível gerar o código. Tente de novo." };
  const r = await sendEmail({
    to: user.email,
    subject: "Seu código para assinar o contrato",
    text: `Seu código para assinar o contrato de "${visao.imovel}": ${codigo}\nVale por 15 minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail e troque a senha.`,
    html: `<p>Seu código para assinar o contrato de <strong>${visao.imovel.replace(/[<>&]/g, "")}</strong>: <strong style="font-size:20px;letter-spacing:4px">${codigo}</strong></p><p>Vale por 15 minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail e troque a senha.</p>`,
  });
  if (r.error) return { ok: false, error: "Não foi possível enviar o e-mail agora. Tente de novo." };
  // Conta de teste (is_teste): o QA lê o código na caixa da própria conta, sem caixa de e-mail real. Conta real: nada é guardado.
  await guardarSeContaDeTeste({
    evento: "contract_signature_code",
    assunto: "Seu código para assinar o contrato",
    texto: `Seu código para assinar o contrato de "${visao.imovel}": ${codigo}`,
    para: user.email,
    usuarioId: user.id,
  });
  return { ok: true };
}

export async function assinarContrato(input: {
  contratoId: string;
  aceite: boolean;
  /** 6 dígitos recebidos por e-mail (pedirCodigoAssinatura). */
  codigo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(String(input.contratoId))) return { ok: false, error: "Contrato inválido." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para assinar." };

  let { data } = await admin.from("contratos").select(COLUNAS).eq("id", input.contratoId).maybeSingle();
  let c = data as unknown as LinhaContrato | null;
  // Primeira assinatura: congela as regras de pets do anúncio no contrato (uma vez só), para a outra parte
  // assinar o mesmo resumo/hash mesmo que o dono mude o anúncio depois.
  if (c && !c.assinado_proprietario_em && !c.assinado_inquilino_em && c.pets_regras_congeladas == null) {
    await admin
      .from("contratos")
      .update({
        pets_regras_congeladas: {
          ...(objetoOuVazio(c.properties?.pets_regras)),
          qtdPetsCandidatura: await contarPetsDoInquilino(c.tenant_id),
          limpezaEstadia: normalizarLimpezaEstadia(await lerLimpezaViva(c.property_id)),
          outrosCustosMes: await lerOutrosCustosVivos(c.property_id),
        },
      })
      .eq("id", c.id)
      .is("pets_regras_congeladas", null);
    ({ data } = await admin.from("contratos").select(COLUNAS).eq("id", input.contratoId).maybeSingle());
    c = data as unknown as LinhaContrato | null;
  }
  // Pacote de limpeza (0144): congelado junto, também em contrato ainda não assinado que já tinha as regras de pets congeladas
  // antes desta regra; a chave limpezaEstadia presente (mesmo null) marca "já congelado".
  if (c && !c.assinado_proprietario_em && !c.assinado_inquilino_em && c.pets_regras_congeladas != null && !("limpezaEstadia" in objetoOuVazio(c.pets_regras_congeladas))) {
    const pacote = normalizarLimpezaEstadia(await lerLimpezaViva(c.property_id));
    await admin
      .from("contratos")
      .update({ pets_regras_congeladas: { ...objetoOuVazio(c.pets_regras_congeladas), limpezaEstadia: pacote, outrosCustosMes: await lerOutrosCustosVivos(c.property_id) } })
      .eq("id", c.id)
      .is("assinado_proprietario_em", null)
      .is("assinado_inquilino_em", null);
    ({ data } = await admin.from("contratos").select(COLUNAS).eq("id", input.contratoId).maybeSingle());
    c = data as unknown as LinhaContrato | null;
  }
  if (c) await completarPets(c);
  const visao = c ? montar(c, user.id) : null;
  if (!c || !visao) return { ok: false, error: "Contrato não encontrado." };

  const jaAssinou = visao.papel === "inquilino" ? c.assinado_inquilino_em : c.assinado_proprietario_em;
  const motivo = motivoNaoPodeAssinar({
    status: c.status,
    papel: visao.papel,
    assinadoEm: jaAssinou,
    aceite: input.aceite === true,
  });
  if (motivo) return { ok: false, error: motivo };
  // Check-in garantido: o proprietário só assina com as instruções de entrada preenchidas (conferido aqui, no servidor).
  const faltam = motivoFaltamInstrucoes({ papel: visao.papel, preenchidas: await instrucoesPreenchidas(admin, c.id) });
  if (faltam) return { ok: false, error: faltam };

  // Confirmação de identidade NO SERVIDOR: código de e-mail de uso único, com validade e limite de falhas.
  const { data: linhaCodigo } = await admin
    .from("contrato_assinatura_codigos")
    .select("codigo_hash, expira_em, falhas, usado_em, enviado_em")
    .eq("contrato_id", c.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const lc = (linhaCodigo as LinhaCodigo | null) ?? null;
  const conf = conferirCodigo(lc, input.codigo, user.id, c.id, Date.now());
  if (!conf.ok) {
    if (conf.contarFalha && lc) {
      // Incremento atômico (comparação e troca): dois palpites ao mesmo tempo contam os dois.
      const chave = { contrato_id: c.id, user_id: user.id };
      await incrementarFalhas(
        async () => {
          const { data: atual } = await admin
            .from("contrato_assinatura_codigos")
            .select("falhas")
            .match(chave)
            .is("usado_em", null)
            .maybeSingle();
          return atual ? Number((atual as { falhas: number }).falhas) : null;
        },
        async (de) => {
          const { data: trocou } = await admin
            .from("contrato_assinatura_codigos")
            .update({ falhas: de + 1 })
            .match(chave)
            .eq("falhas", de)
            .is("usado_em", null)
            .select("contrato_id");
          return (trocou?.length ?? 0) > 0;
        },
      );
    }
    return { ok: false, error: conf.erro };
  }
  // Consome o código antes de gravar: só uma assinatura por código, mesmo com dois cliques ao mesmo tempo.
  const { data: consumido } = await admin
    .from("contrato_assinatura_codigos")
    .update({ usado_em: new Date().toISOString() })
    .eq("contrato_id", c.id)
    .eq("user_id", user.id)
    .eq("codigo_hash", lc!.codigo_hash)
    .is("usado_em", null)
    .select("contrato_id");
  if (!consumido?.length) return { ok: false, error: MSG_CODIGO_BLOQUEADO };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim().slice(0, 64) || null;
  const agora = new Date().toISOString();

  const { data: assOutra } = await admin
    .from("contrato_assinaturas")
    .select("hash_documento")
    .eq("contrato_id", c.id)
    .neq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const hashDaOutraParte = (assOutra as { hash_documento?: string | null } | null)?.hash_documento ?? null;

  const { error: errReg } = await admin.from("contrato_assinaturas").insert({
    contrato_id: c.id,
    user_id: user.id,
    papel: visao.papel,
    assinado_em: agora,
    ip,
    hash_documento: hashResumo(linhasParaHash(visao.resumo, hashDaOutraParte)),
  });
  if (errReg) return { ok: false, error: "Não foi possível registrar a assinatura. Tente de novo." };

  const coluna = visao.papel === "inquilino" ? "assinado_inquilino_em" : "assinado_proprietario_em";
  const { error: errCol } = await admin.from("contratos").update({ [coluna]: agora }).eq("id", c.id).is(coluna, null);
  if (errCol) return { ok: false, error: "Não foi possível registrar a assinatura. Tente de novo." };
  // A tela do contrato (dos dois lados) e as listas voltam já com o aviso novo, na mesma resposta da ação.
  revalidatePath("/dashboard/locacoes/[id]", "page");
  revalidatePath("/dashboard/contratos/[id]", "page");
  revalidatePath("/dashboard/contratos");
  revalidatePath("/dashboard/locacoes");

  // Avisa a outra parte (notificação + e-mail), depois da resposta.
  const outraJaAssinou = !!(visao.papel === "inquilino" ? c.assinado_proprietario_em : c.assinado_inquilino_em);
  const outroId = visao.papel === "inquilino" ? String(c.properties?.owner_id ?? "") : c.tenant_id;
  after(async () => {
    try {
      // Jornada de assinatura (19/10): com as duas assinaturas, o e-mail traz as mesmas linhas da página do contrato.
      const nomes = outraJaAssinou ? await nomesDasPartes(String(c.properties?.owner_id ?? ""), c.tenant_id) : null;
      const linhas = nomes
        ? linhasAssinatura(visao.papel, {
            proprietario: { nome: nomes.proprietario, em: visao.papel === "proprietario" ? agora : c.assinado_proprietario_em },
            inquilino: { nome: nomes.inquilino, em: visao.papel === "inquilino" ? agora : c.assinado_inquilino_em },
          })
        : null;
      const detalhes = linhas ? `<p>${linhas.map(escaparHtml).join("<br>")}</p>` : undefined;
      const { data: pessoa } = await admin.auth.admin.getUserById(outroId);
      await notify({
        event: "contract_status",
        email: pessoa?.user?.email ?? undefined,
        userId: outroId,
        // Quem recebe é a outra parte: o dono abre em Contratos, o inquilino em Minhas locações.
        pushUrl: visao.papel === "inquilino" ? `/dashboard/contratos/${c.id}` : `/dashboard/locacoes/${c.id}`,
        subject: assuntoAvisoOutraParte(outraJaAssinou),
        detailsHtml: detalhes,
      });
      // Prompt 24: com as duas assinaturas, quem assinou por último também recebe o "contrato assinado" (os dois lados).
      if (outraJaAssinou) {
        await notify({
          event: "contract_status",
          email: user.email ?? undefined,
          userId: user.id,
          pushUrl: visao.papel === "inquilino" ? `/dashboard/locacoes/${c.id}` : `/dashboard/contratos/${c.id}`,
          subject: assuntoAvisoOutraParte(true),
          detailsHtml: detalhes,
        });
      }
    } catch {
      /* aviso é best-effort: a assinatura já está gravada */
    }
  });
  return { ok: true };
}
