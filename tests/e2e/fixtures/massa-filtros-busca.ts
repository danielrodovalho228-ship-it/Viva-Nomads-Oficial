/*
  Frente 3 (busca) — massa dos atalhos e filtros da /buscar no laboratório.
  Desde o E131 (60a7fba69, 25/10: "a regra dos exemplos decidida uma vez"), com anúncio REAL no banco os anúncios de
  exemplo saem da lista E das contagens. A massa do laboratório (seed-lab) só tem studios de 1 quarto a R$ 3.200, sem
  pet, garagem, máquina de lavar nem home office; então os atalhos da home somem (todos com 0) e os chips da folha de
  filtros ficam desligados — t66, t71 e t78 esperavam até estourar o tempo. Este anúncio real cobre cada atalho e cada
  chip que esses specs tocam. Fora do laboratório não faz nada (o modo demonstração usa os exemplos).
*/
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "./laboratorio";

export interface MassaFiltros {
  donoId: string;
  imovelId: string;
}

/**
 * A home é ISR (revalidate = 60): gerada antes deste anúncio existir, ela só mostra os atalhos depois de uma nova geração.
 * Quem publica pela tela dispara a revalidação (E33); aqui, o anúncio entra direto no banco, então espera a home refletir.
 */
async function esperarAtalhosNaHome(): Promise<void> {
  const base = (process.env.TESTES_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const fim = Date.now() + 150_000;
  while (Date.now() < fim) {
    const html = await fetch(`${base}/`, { headers: { "x-vn-origem": "e2e" } }).then((r) => r.text()).catch(() => "");
    // Os 6 atalhos (preço, pet, home office, 3+ quartos, Umuarama, garagem) — não só a seção.
    if (html.includes('data-testid="atalhos-categoria"') && html.includes("Aceita pets") && html.includes("3+ quartos") && html.includes("Com garagem")) return;
    await new Promise((r) => setTimeout(r, 5_000));
  }
  throw new Error("a home não mostrou os atalhos em 150 s depois de criar a massa dos filtros");
}

/** Cria o dono e o anúncio publicado que atende a todos os atalhos e chips (só no laboratório). */
export async function criarMassaFiltrosBusca(opts: { esperarHome?: boolean } = {}): Promise<MassaFiltros | null> {
  if (!NO_LABORATORIO) return null;
  const sufixo = novoSufixo();
  const donoId = await criarConta({ email: `dono.filtros.${sufixo}@lab.vivanomads.test`, nome: "Dono Filtros Busca", role: "owner" }, novaSenha());
  // Até R$ 2.500 (total do mês, sem condomínio nem contas), 3 quartos, pet, home office, Umuarama.
  const imovelId = await criarImovelPronto(donoId, `Casa dos filtros ${sufixo} — laboratório`, { preco: 2200 });
  const { error } = await adm()
    .from("properties")
    .update({ bedrooms: 3, max_guests: 5, pets_allowed: true, tag_home_office: true, address: "Umuarama" })
    .eq("id", imovelId);
  if (error) throw error;
  const { error: eCom } = await adm()
    .from("property_amenities")
    .insert([
      { property_id: imovelId, category: "Lavanderia", label: "Máquina de lavar", sort_order: 0 },
      { property_id: imovelId, category: "Estacionamento", label: "Vaga de garagem", sort_order: 1 },
    ]);
  if (eCom) throw eCom;
  // Publica por ÚLTIMO: ativo antes de pet/quartos/comodidades, uma home gerada no meio guardaria (60 s) só o atalho de preço.
  const { error: eAtivo } = await adm().from("properties").update({ status: "active" }).eq("id", imovelId);
  if (eAtivo) throw eAtivo;
  if (opts.esperarHome) await esperarAtalhosNaHome();
  return { donoId, imovelId };
}

export async function apagarMassaFiltrosBusca(m: MassaFiltros | null): Promise<void> {
  if (m) await apagarContas([m.donoId]);
}
