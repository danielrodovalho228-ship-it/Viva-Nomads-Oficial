# E701 — Página de um papel nunca renderiza dentro do menu do outro

**Relato (QA Allinne, 07/11):** depois de "Anunciar" a navegação vira "Áreas do proprietário"; em páginas de conta volta a "Áreas do morador"; e "Meus pedidos" (moradora) abre DENTRO da área do proprietário.

**Como a casca escolhe a área hoje (E497/E548/E653):** a URL decide (`papelDaRota`/`AREA_*`); a página que não é de área nenhuma ("comum") usa o papel/modo guardado.

**Causa do "Meus pedidos dentro do proprietário" (corrigida aqui):** `/dashboard/pedidos` e `/dashboard/candidaturas` são páginas SÓ do morador (o menu do dono nem as lista: `ROTAS_SO_MORADOR` em `config/nav-dono.ts`), mas não estavam em `AREA_MORADOR`. Eram tratadas como "comuns" e desenhadas pelo modo guardado; com o modo em proprietário, abriam no menu do proprietário.

**Correção (sem migração, 3 linhas):** `AREA_MORADOR` e a cópia `TENANT_ONLY` da casca ganham `/dashboard/pedidos` e `/dashboard/candidaturas`. `/dashboard/pedidos-cidade` (do dono) não é capturada pelo prefixo.

**Teste:** `src/lib/papel/e701-pagina-do-morador-no-menu-do-morador.test.ts` (visto vermelho antes; também exige que TODA rota do painel escondida do menu do dono por ser do morador esteja em `AREA_MORADOR`). `src/lib/papel`, `src/config`, `src/components/layout|papel`: 196 ok; `tsc` limpo.

**Efeito a conferir no e2e:** as varreduras que abrem `/dashboard/pedidos` com conta de dono (t416, t1404, t1425) agora veem o cabeçalho do morador nessa página (era o do dono). Elas só varrem a página; não foram alteradas.

## Dúvida (decisão de produto, não alterada aqui)
"Depois de Anunciar a navegação vira proprietário e nas páginas de conta volta a morador" é o desenho do E653: abrir uma página de área NÃO troca o papel guardado; as páginas comuns (conta, ajuda) seguem o papel guardado. Para a troca ser "explícita e estável", a decisão é: o toque em **"Anunciar meu imóvel"** deve passar a trocar o papel guardado para proprietário (menu de todas as páginas, inclusive as de conta, acompanha), com aviso visível? Se sim, é uma mudança pequena no destino desse botão, mas vai contra o "o papel nunca muda sozinho" do E653 e precisa do aval do Daniel.
