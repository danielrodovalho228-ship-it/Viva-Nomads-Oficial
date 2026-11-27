/*
  LABORATÓRIO — massa da VARREDURA LOGADA E ADMIN (E950, t1649). Só Supabase LOCAL, só sobre as contas da varredura.
  Roda DEPOIS de scripts/lab/massa-varredura.mjs (lê tests/laboratorio/saida/varredura.json) e só no workflow
  varredura-logada.yml: a massa compartilhada da t249 e dos outros jobs fica como está.

  Cria um registro para cada rota com parâmetro que a semeadura comum não cobre (ORDEM-DUET-102: 100/108 → 108/108):
    /dashboard/leads/[id], /dashboard/propostas/[id], /dashboard/visitas/[id]   — dono-17 × inquilina e três × inquilina
    /dashboard/servicos/pedidos/[id], /admin/parceiros/pedidos/[id]               — inquilina → parceiro; dono-17 → três
    /dashboard/avaliacao-imovel/[id], /dashboard/parceiro/avaliacao/[pedido]     — vistoria com avaliador credenciado
    /admin/atendimento/[id]                                                         — um chamado da inquilina
  Tudo marcado como massa da varredura ("[E950] massa da varredura", códigos VN-SV-E950… (um novo por rodada: o registro de documentos é imutável), AVL-95x). Idempotente: apaga a
  massa marcada da rodada anterior antes de criar.
  Uso: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=… node scripts/lab/massa-varredura-e950.mjs
*/
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (!["127.0.0.1", "localhost"].includes(host)) {
  console.error(`✗ Recusando: a massa do E950 só semeia o Supabase LOCAL. URL recebida: ${host || "(vazia)"}`);
  process.exit(1);
}
if (!chave) {
  console.error("✗ Faltou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

export const MARCA = "[E950] massa da varredura";
const ok = (error, oQue) => {
  if (error) {
    console.error(`✗ ${oQue}: ${error.message}`);
    process.exit(1);
  }
};
const dias = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

async function limpar() {
  // Ordem: dependentes primeiro. Só o que leva a marca.
  await admin.from("vistoria_pedidos").delete().eq("cidade", "Uberlândia").like("verificacao_detalhe", `${MARCA}%`);
  await admin.from("avaliadores_credenciamento").delete().like("numero_credenciado", "AVL-95%");
  await admin.from("parceiro_pedidos").delete().like("codigo", "VN-SV-E950%");
  await admin.from("chamados").delete().eq("assunto", MARCA);
  // O lead não tem campo de texto: a marca fica na proposta (numero E950-…), e o lead sai junto com ela.
  const { data: props } = await admin.from("propostas").select("lead_id").like("numero", "E950-%");
  await admin.from("propostas").delete().like("numero", "E950-%");
  const leads = (props ?? []).map((x) => x.lead_id).filter(Boolean);
  if (leads.length) await admin.from("leads").delete().in("id", leads);
  await admin.from("visitas_video").delete().eq("motivo", "E950 massa");
}

async function inserir(tabela, linha, oQue) {
  const { data, error } = await admin.from(tabela).insert(linha).select("id").single();
  ok(error, oQue);
  return data.id;
}

async function main() {
  const m = JSON.parse(readFileSync("tests/laboratorio/saida/varredura.json", "utf8"));
  const { ids, imovel17, imovelTres, parceiro, parceiroTres } = m;
  if (!ids?.DONO17 || !ids?.INQUILINA || !ids?.TRES || !imovel17 || !imovelTres || !parceiro || !parceiroTres) {
    console.error("✗ varredura.json incompleto: rode scripts/lab/massa-varredura.mjs antes.");
    process.exit(1);
  }
  await limpar();

  // Negociação: dois pares dono × inquilina (o dono-17 e a conta dos três papéis como anunciante).
  const pares = [
    { n: 1, dono: ids.DONO17, inq: ids.INQUILINA, imovel: imovel17 },
    { n: 2, dono: ids.TRES, inq: ids.INQUILINA, imovel: imovelTres },
  ];
  for (const p of pares) {
    const lead = await inserir("leads", { owner_id: p.dono, tenant_id: p.inq, property_id: p.imovel, status: "new" }, `lead ${p.n}`);
    await inserir("propostas", { numero: `E950-PRP-${p.n}`, lead_id: lead, property_id: p.imovel, owner_id: p.dono, tenant_id: p.inq, validade_dias: 7, valida_ate: dias(7) }, `proposta ${p.n}`);
    await inserir("visitas_video", { property_id: p.imovel, owner_id: p.dono, tenant_id: p.inq, horarios: [dias(2)], modalidade: "video", motivo: "E950 massa" }, `visita ${p.n}`);
  }

  // Serviços: a inquilina contrata o parceiro; o dono-17 contrata a conta dos três papéis (como parceira).
  // O código vai para documentos_registro, que é imutável (não se apaga): cada rodada usa um código novo.
  const codigo = () => `VN-SV-E950${randomBytes(4).toString("hex").toUpperCase().slice(0, 4)}`;
  await inserir("parceiro_pedidos", { codigo: codigo(), parceiro_id: parceiro, cliente_id: ids.INQUILINA, categoria: "fotografia", descricao: MARCA }, "pedido de serviço 1");
  await inserir("parceiro_pedidos", { codigo: codigo(), parceiro_id: parceiroTres, cliente_id: ids.DONO17, categoria: "fotografia", descricao: MARCA }, "pedido de serviço 2");

  // Avaliação do imóvel: os dois parceiros credenciados como avaliadores; um pedido para cada anúncio.
  const avaliador = async (parceiroId, numero) =>
    inserir(
      "avaliadores_credenciamento",
      { parceiro_id: parceiroId, cidade: "Uberlândia", numero_credenciado: numero, status: "ativo", conduta_versao: "v1", experiencia_link: "https://lab.vivanomads.test/e950", ativado_em: new Date().toISOString() },
      `avaliador ${numero}`,
    );
  const av1 = await avaliador(parceiro, "AVL-950");
  const av2 = await avaliador(parceiroTres, "AVL-951");
  const vistoria = { cidade: "Uberlândia", porte: "q1_2", valor_tabela: 250, status: "designado", verificacao_detalhe: `${MARCA} (não é verificação)` };
  await inserir("vistoria_pedidos", { ...vistoria, property_id: imovel17, owner_id: ids.DONO17, morador_id: ids.INQUILINA, avaliador_id: av1 }, "avaliação 1");
  await inserir("vistoria_pedidos", { ...vistoria, property_id: imovelTres, owner_id: ids.TRES, morador_id: ids.INQUILINA, avaliador_id: av2 }, "avaliação 2");

  // Atendimento: um chamado da inquilina (o admin vê qualquer um).
  await inserir(
    "chamados",
    { usuario_id: ids.INQUILINA, tipo: "suporte", categoria: "outro", prioridade: "p3", canal: "site", status: "aberto", assunto: MARCA, prazo_primeira_resposta: dias(1), prazo_resolucao: dias(3) },
    "chamado",
  );
  console.log("✓ massa do E950: 2 leads, 2 propostas, 2 visitas, 2 pedidos de serviço, 2 avaliadores, 2 avaliações, 1 chamado");
}

await main();
