# E653 — casca logada instável no meio da sessão (família E497/E456)

**Relato (lote 5, 06/11, proprietario2):** a home /dashboard perdeu "Interessados / Meus imóveis / Meus ganhos" a partir das 15:48 e
não voltou (recarregar, voltar ao Modo proprietário, sessão nova); o topo alternava "Áreas do proprietário" × "Áreas do parceiro" entre
páginas do dono (o "Início" mudava de destino); o menu Conta passou a oferecer "Modo proprietário" sem clique; o selo do sino sumiu.

## Evidência (leitura somente-leitura da produção + código)
- **Banco:** a conta de teste proprietario2 está **saudável e coerente**: `papel_ativo = proprietario`, `preferred_mode = owner`,
  3 imóveis (`active`, `draft`), parceria `publicado`, conta não pausada. O sumiço **não** é dado nem papel gravado → é a casca.
- **A home do dono depende de `mode === "owner"`** (visao-geral-client.tsx): em qualquer outro modo ela mostra só o Início do morador
  ("Continue seu anúncio / Peça na Viva / Ferramentas / Ajuda e termos" — exatamente o que restou). Em /dashboard (página comum)
  o `mode` vem do `activeMode` do navegador, não da URL.

## Causas no código
- **F1 — a área do parceiro gravava o papel.** `usarPapel(…, "area")` poupava morador/proprietário (E548) mas, para "parceiro",
  caía na gravação de `papel_ativo = "parceiro"`; e o `SincronizarPapel` ainda chamava `setPapel("parceiro")` no navegador. O papel
  guardado mudava sem clique: nas páginas comuns o papel era parceiro, nas páginas do dono (`AREA_PROPRIETARIO`) o papel vinha da URL
  como proprietário → o topo **alternava**, o "Início" mudava de destino (`painelDoPapel`) e o menu Conta passava a oferecer
  "Modo proprietário" sem troca da pessoa (o ativo era parceiro). **Regra única nova:** `gravacaoPorArea` — abrir uma página de área
  NUNCA grava o papel (só o 1º acesso grava o modo, E283). A troca segue explícita (selo ou Conta).
- **F2 — "modo do servidor indisponível" era igual a "conta nova".** A casca só espera `LIMITE_CASCA_MS` (3 s) pelo modo
  (`comLimite(resolveInitialMode())`, E503) e convertia atraso/erro em `null` — o mesmo valor de "conta nova sem papel" — e
  `resolveInitialMode` ainda ignorava o erro do perfil. O `ModeInitializer` não corrigia nada: sob lentidão (lote de QA) o papel
  salvo era abandonado em silêncio e valia o padrão do navegador (papel dos metadados, "tenant" na falta) → Início do morador, e
  novas sessões repetiam o mesmo caminho enquanto o servidor estivesse lento. **Correção:** `resolveInitialMode` LANÇA no erro; a casca
  marca `indisponivel`; o `ModeInitializer` relê o modo com esperas crescentes (1,5 / 4 / 9 / 20 s) e só aplica se a pessoa não trocou
  nem tem troca pendente no meio (`aplicarReleitura`).
- **F3 — contadores do menu/sino sem nova tentativa.** Com o contexto inicial `null` e o GET `/api/painel/contadores` falhando,
  a casca ficava em `CONTADORES_VAZIOS` (selo do sino em 0, menu de conta nova) até o próximo minuto/foco, e o erro era engolido.
  **Correção:** tentativas em 2 / 5 / 12 s (`esperaRetentativaContadores`), canceladas na limpeza do efeito; o abort da própria
  limpeza não conta como falha.

## Varredura da família (passo 3) — pontos conferidos
| Ponto | Resultado |
|---|---|
| Troca explícita (`useTrocaPapel`) | correta: grava no servidor e só então aplica no store |
| Menu Conta (`use-papel-em-uso`) | lê a mesma fonte da casca; estável depois do F1 |
| `AuthProvider.hydrate` (modo/papel gravados) | respeita troca no meio (`semTrocaNoMeio`) e tem 2 novas tentativas (E518); sem mudança |
| `contratos/page.tsx` (usa `resolveInitialMode`) | já tinha `.catch(() => null)`; segue válido com a função lançando |
| Selo do sino / menu | F3 |

## Testes
`src/lib/papel/e653-papel-estavel.test.ts` (7): regra `gravacaoPorArea`; simulação "dono com parceria visita a área do parceiro e volta"
(papel guardado e Início seguem os do dono em todas as páginas comuns e de dono); `indisponivel` ≠ `null`; releitura só aplica sem troca
no meio; o servidor lança; a casca marca `indisponivel` e o `ModeInitializer` relê; retentativa dos contadores. Guardas antigos atualizados
(E548, E283, PROP-0/contadores) porque fixavam o texto das regras que mudaram. Escopo: `papel`, `data`, `components/papel`,
`components/layout`, `painel`, `*modo*` — 494/494; `tsc` limpo.

**Não provado ao vivo** (regra do lote): as três causas explicam o conjunto de sintomas e o estado do banco, mas a reprodução com
carga real é do QA do chat principal. Sem migração, sem chave.

## Varredura de regressão da casca logada (papelAtivo / papelDaRota e persistência do modo)

**Checks do #3038 (head `50862578a` do E653, antes deste relatório):** verify, e2e, lab-critico e Vercel verdes.

**1. Listas de áreas.** As cópias do guarda de rota (`OWNER_ONLY`/`TENANT_ONLY` em `dashboard-shell.tsx`) e `AREA_PROPRIETARIO`/`AREA_MORADOR`
(`config/areas-por-papel.ts`) são idênticas (diferença vazia nos dois sentidos). `papelDaRota` e `modoDaRota` usam as áreas; o teste
`papel-ativo.test.ts` já fixa a paridade.

**2. Inventário de TODOS os escritores de `papel_ativo` / `preferred_mode`** (servidor):
| Escritor | Quando grava | Situação |
|---|---|---|
| `usarPapel` (papel-actions) | troca explícita (selo/Conta); com `origem "area"` só o modo no 1º acesso | corrigido no F1 (`gravacaoPorArea`) |
| `setPreferredMode` (mode-actions, via `salvarModo`) | clique em "Modo proprietário/morador", `aoNavegar` de conta sem o papel, regravação de troca pendente | só cliques explícitos ou a anotação da própria troca (10 min) |
| `gravarIntencao` (intencao-servidor) | só no 1º acesso (intenção e papel ativo vazios); leitura falha não vira 1º acesso | correto, nada a mudar |
Escritores do navegador (`setActiveMode`/`setState({activeMode})`): `AuthProvider` (lê o perfil; respeita troca no meio), `ModeInitializer`
(servidor ou troca pendente; relê no F2), troca explícita, `aoNavegar` (conta sem o papel). Nenhum grava sem clique ou sem origem no servidor.

**3. Achado fora do escopo da correção — guarda de rota por papel da casca é código morto desde o E497.** O efeito de
`dashboard-shell.tsx` (`useEffect … [pathname, mode, isOwner, isTenant, router, setActiveMode]`) calcula `exclusive` como as rotas do **outro**
modo e dispara se a URL está nelas. Mas, desde o E497, `useViewMode().mode` já vem da URL nas páginas de área (`modoDaRota`), então a URL nunca
está na lista do outro modo: o efeito **nunca dispara**. Consequências: (a) não é escritor de modo ativo (bom, coerente com o E548); (b) a
parte "conta que NÃO tem o papel volta ao convite (`destinoForaDoPapel`)" também deixou de acontecer em acesso por URL/deep-link (o teste
`jornada-teste.test.ts` só confere o texto do código, não o efeito). Não corrigi porque restaurar o redirecionamento muda produto (o fluxo
"Anunciar meu imóvel" de quem ainda não é dono usa a mesma rota de dono via `aoNavegar`) e a decisão é do chat principal. Proposta, se
quiserem: manter o guarda só para o redirecionamento (sem `setActiveMode`/`salvarModo`), decidindo "tem o papel?" pela mesma regra do menu.

**4. Persistência entre sessões.** `signOut` limpa `activeMode`/`parceiroAtivo`/anotação pendente (`vivanomads-*`). A troca pendente expira
em 10 min e só vence o servidor se o modo pendente difere do servidor.

**Conclusão:** sem outro defeito do tipo "o papel muda sozinho". A reprodução com carga real (servidor lento) segue para o QA do chat principal.


## Atualização: o guarda de rota era um 2º escritor do modo (corrigido)

Achado anterior ("código morto") reavaliado: o guarda `useEffect [pathname, mode, isOwner, isTenant, router]` da casca
chamava `setActiveMode` + `salvarModo` sozinho quando a rota era exclusiva do outro modo. Em página de área o modo vem da
URL (E497), mas qualquer descompasso (modo lido tarde, página sem papel de rota) fazia a casca gravar o modo no perfil sem
clique, persistindo a troca. Agora o guarda **não escreve**: quem tem o papel não é mexido; quem não tem é desviado
(`destinoForaDoPapel`). Teste: `src/lib/papel/e653-guarda-sem-escrita.test.ts` (visto vermelho antes). Não provado ao vivo.
