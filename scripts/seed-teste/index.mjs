/*
  Seed idempotente da massa de teste (ordem 7436a29a, item 6). Uso: npm run seed:massa
  Requer NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e TESTES_<CONTA>_EMAIL/_SENHA/_NOME
  (as mesmas do seed:teste). Recusa rodar contra produção. Inventário: docs/massa-de-teste.md.
  Rodar de novo recria o que mudou e não duplica nada (ids fixos, upsert).
*/
import { createClient } from "@supabase/supabase-js";
import { CONTAS, IMOVEIS, CHAMADOS, CONTRATOS, hostProibido } from "./massa.mjs";

function falhar(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function lerConta({ chave, papel, obrigatoria }) {
  const email = process.env[`TESTES_${chave}_EMAIL`];
  const senha = process.env[`TESTES_${chave}_SENHA`];
  if (!email || !senha) {
    if (obrigatoria) falhar(`Faltou TESTES_${chave}_EMAIL/_SENHA.`);
    return null;
  }
  return { chave, papel, email, senha, nome: process.env[`TESTES_${chave}_NOME`] ?? `Teste ${chave}` };
}

async function acharUsuario(admin, email) {
  const alvo = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const achado = data.users.find((u) => (u.email ?? "").toLowerCase() === alvo);
    if (achado) return achado;
    if (data.users.length < 200) break;
  }
  return null;
}

async function garantirConta(admin, conta) {
  const existente = await acharUsuario(admin, conta.email);
  let id = existente?.id;
  if (existente) {
    await admin.auth.admin.updateUserById(id, { password: conta.senha, email_confirm: true, user_metadata: { full_name: conta.nome } });
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: conta.email, password: conta.senha, email_confirm: true, user_metadata: { full_name: conta.nome } });
    if (error) throw error;
    id = data.user.id;
  }
  // is_teste só o servidor liga (trigger 0135): é ele que faz o chamado nascer simulado.
  const { error } = await admin.from("profiles").upsert({ id, full_name: conta.nome, email: conta.email, role: conta.papel, is_teste: true }, { onConflict: "id" });
  if (error) throw error;
  return id;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) falhar("Faltou NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  if (hostProibido(url)) falhar("Recusando: a URL aponta para produção. Seed só em projeto de teste.");

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const ids = {};
  for (const conta of CONTAS.map(lerConta).filter(Boolean)) {
    ids[conta.chave] = await garantirConta(admin, conta);
    console.log(`✓ conta ${conta.chave} (${conta.papel})`);
  }

  for (const i of IMOVEIS) {
    const { error } = await admin.from("properties").upsert(
      {
        id: i.id, owner_id: ids[i.dono], title: i.titulo,
        description: "Imóvel de teste semeado (massa de teste). Mobiliado, média duração.",
        property_type: "Studio", address: "Centro", city: "Uberlândia", state: "MG",
        bedrooms: 1, bathrooms: 1, area_m2: 40, min_period_days: 30, monthly_price: i.preco,
        status: "active", ready_to_live_badge: true,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    console.log(`✓ imóvel ${i.id}`);
  }

  const agora = Date.now();
  for (const c of CHAMADOS) {
    const { error } = await admin.from("chamados").upsert(
      {
        id: c.id, usuario_id: ids[c.autor], tipo: "suporte", categoria: "teste", prioridade: c.prioridade,
        status: c.status, canal: "site", assunto: c.assunto, simulacao: true,
        prazo_primeira_resposta: new Date(agora + 24 * 3600e3).toISOString(),
        prazo_resolucao: new Date(agora + 72 * 3600e3).toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    console.log(`✓ chamado ${c.id}`);
  }
  const dia = (n) => new Date(agora + n * 86400e3).toISOString().slice(0, 10);
  for (const c of CONTRATOS) {
    const inicio = dia(c.dias);
    const fim = dia(c.dias + c.meses * 30);
    const aluguel = IMOVEIS.find((i) => i.id === c.imovel).preco;
    const { error } = await admin.from("contratos").upsert(
      {
        id: c.id, property_id: c.imovel, tenant_id: ids.INQUILINO, owner_plan: "free", faixa: "media_estadia",
        prazo_total_dias: c.meses * 30, aluguel_mensal: aluguel, tamanho_bloco_meses: 2, qtd_ocupantes: 1,
        comissao_percent: 0.12, comissao_valor: Math.round(aluguel * c.meses * 0.12 * 100) / 100,
        status: c.status, garantia: "caucao", periodo: `[${inicio},${fim})`,
        assinado_proprietario_em: c.assinado.includes("proprietario") ? new Date(agora - 86400e3).toISOString() : null,
        assinado_inquilino_em: c.assinado.includes("inquilino") ? new Date(agora - 86400e3).toISOString() : null,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    console.log(`✓ contrato ${c.id}`);
  }
  console.log("\n✅ Massa de teste pronta (idempotente).");
}

main().catch((e) => falhar(`Falha no seed: ${e?.message ?? e}`));
