import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

/*
  E499: o chat "Fale com a Viva" mora no layout raiz e não desmonta ao trocar de tela. O estado "aberto" ficava preso —
  a pessoa navegava, voltava ao painel e o chat continuava aberto. Agora a troca de rota fecha o chat (as mensagens
  continuam guardadas na sessão; só o painel aberto é que zera).
*/
test("E499: a troca de rota fecha o chat flutuante (estado não fica preso)", () => {
  const src = ler("components/ajuda/viva-chat.tsx");
  const corpo = src.slice(src.indexOf("export function VivaChatFlutuante"), src.indexOf("if (escondido) return null"));
  // guarda a rota em que o chat foi aberto e fecha quando ela muda — antes do retorno das telas sem o botão,
  // para não reabrir sozinho ao voltar de uma delas
  assert.match(corpo, /const \[rotaDoChat, setRotaDoChat\] = useState\(pathname\)/);
  assert.match(corpo, /if \(rotaDoChat !== pathname\) \{\s*setRotaDoChat\(pathname\);\s*setAberto\(false\);\s*\}/);
});

test("E499: fechar o painel não apaga a conversa guardada na sessão", () => {
  const src = ler("components/ajuda/viva-chat.tsx");
  assert.match(src, /sessionStorage/);
  const corpo = src.slice(src.indexOf("export function VivaChatFlutuante"), src.indexOf("function PainelChat"));
  assert.doesNotMatch(corpo, /sessionStorage\.removeItem/);
});
