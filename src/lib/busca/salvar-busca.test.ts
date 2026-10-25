/*
  Adendo ao E82-A ("Avisar-me" na busca): a frase ao salvar diz se o aviso por e-mail está ligado.
  Roda: node --test src/lib/busca/salvar-busca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AVISO_COM_EMAIL,
  AVISO_CONVIDADO,
  AVISO_EMAIL_DESLIGADO,
  AVISO_SEM_AVISO,
  HREF_NOTIFICACOES,
  avisoAoSalvar,
  textoDoAviso,
} from "./aviso-salvar-busca.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const comp = ler("components/busca/salvar-busca.tsx");
const acoes = ler("lib/data/buscas-salvas-actions.ts");
const ID = "11111111-1111-4111-8111-111111111111";

test("1. logado com avisos por e-mail ligados: 'Vamos te avisar…' + 'Não me avisar' (desliga só esta busca)", () => {
  const a = avisoAoSalvar({ id: ID, avisoEmail: true });
  assert.deepEqual(a, { tipo: "com_email", id: ID });
  assert.equal(textoDoAviso(a), "Busca salva. Vamos te avisar por e-mail quando surgir um imóvel assim.");
  assert.match(comp, /aviso\.tipo === "com_email" && \(\s*<button[\s\S]*?onClick=\{\(\) => void naoAvisar\(aviso\.id\)\}[\s\S]*?min-h-11[\s\S]*?focus-visible:ring-2[\s\S]*?\{ROTULO_NAO_AVISAR\}/);
  assert.match(comp, /definirAlertaBusca\(id, false\)/);
  // Depois do "Não me avisar", a frase muda.
  assert.match(comp, /setAviso\(r\.ok \? \{ tipo: "sem_aviso" \}/);
  assert.equal(textoDoAviso({ tipo: "sem_aviso" }), "Busca salva, sem aviso por e-mail. Você pode ligar em Buscas salvas.");
});

test("2. logado com os avisos por e-mail desligados: a frase diz isso + 'Ligar em Notificações'", () => {
  assert.deepEqual(avisoAoSalvar({ id: ID, avisoEmail: false }), { tipo: "email_desligado" });
  assert.equal(AVISO_EMAIL_DESLIGADO, "Busca salva. Seus avisos por e-mail estão desligados.");
  assert.equal(HREF_NOTIFICACOES, "/dashboard/conta/notificacoes");
  assert.match(comp, /aviso\.tipo === "email_desligado" && \(\s*<Link\s+href=\{HREF_NOTIFICACOES\}[\s\S]*?min-h-11[\s\S]*?\{ROTULO_LIGAR_NOTIFICACOES\}/);
  // A preferência é a mesma que o envio do alerta respeita (profiles.notif_email) — nenhuma chave nova.
  assert.match(acoes, /select\("notif_email"\)[\s\S]*?avisoEmail: notificacaoLigada\(/);
  assert.match(ler("lib/data/alerta-busca-servidor.ts"), /notificacaoLigada\(perfil\.notif_email\)/);
});

test("3. visitante: a busca fica no aparelho e o convite para entrar continua", () => {
  assert.equal(AVISO_CONVIDADO, "Busca guardada neste aparelho. Entre com seu e-mail para receber alertas.");
  assert.match(comp, /setAviso\(\{ tipo: agora \? "convidado" : "removida" \}\)/);
});

test("um componente e um texto só: a mensagem em role=status; o botão segue 'Salvar busca'; 0 resultados usa o mesmo", () => {
  assert.match(comp, /<span role="status"[^>]*data-testid="salvar-busca-aviso"[^>]*>\s*\{textoDoAviso\(aviso\)\}/);
  assert.match(comp, /rotulo = "Salvar busca"/);
  assert.doesNotMatch(comp, /Busca salva em Favoritos/);
  const busca = ler("app/(public)/buscar/search-client.tsx");
  assert.match(busca, /<SalvarBusca versao=\{versaoBusca\} rotulo="Criar alerta desta busca" rotuloSalva="Alerta criado" \/>/);
  // Nenhum dos textos repetido fora do módulo.
  for (const t of [AVISO_COM_EMAIL, AVISO_SEM_AVISO, AVISO_EMAIL_DESLIGADO, AVISO_CONVIDADO]) {
    assert.ok(!comp.includes(t) && !busca.includes(t), t);
  }
});

test("vocabulário: sem 'aluguel', 'temporada', 'hóspede' ou 'reserva' nas frases", () => {
  for (const t of [AVISO_COM_EMAIL, AVISO_SEM_AVISO, AVISO_EMAIL_DESLIGADO, AVISO_CONVIDADO]) {
    assert.doesNotMatch(t, /aluguel|temporada|h[oó]spede|reserva/i, t);
  }
});
