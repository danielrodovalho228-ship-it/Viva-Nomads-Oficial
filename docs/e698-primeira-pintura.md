# E698 — a primeira carga lenta não pode parecer quebra (/buscar e painel)

**Relato:** na 1ª pintura, o mapa aparecia cinza sem ruas (só os pinos), os cartões com retângulos cinza no lugar das fotos e o avatar do cabeçalho alternava foto/inicial por segundos. Diferente do E503 (dados do Início): aqui é prioridade de rede e placeholder honesto.

**Causas (no código):**
- Mapa: os tiles da CARTO só começam a ser pedidos depois do JS do mapa; até lá o quadro é `bg-surface-2` com os pinos por cima, sem aviso.
- Fotos dos cartões: a 1ª fileira já carregava com prioridade, mas o quadro ficava um cinza parado enquanto baixava.
- Avatar: `myPhoto` nascia `null` a cada carga (iniciais) e só mudava quando a server action `getMyAvatarUrl()` voltava; a `<img>` entrava sem fade (vazia enquanto baixava).

**Correções (sem migração):**
1. `/buscar`: `preconnect` ao servidor de tiles já na resposta da página; Leaflet pede os tiles durante o arrasto (`updateWhenIdle: false`, `keepBuffer: 3`); aviso "Carregando o mapa…" sobre o quadro até o 1º tile (some sozinho; limite de 10 s); o carregamento do módulo do mapa (`dynamic`) mostra o mesmo aviso em vez de um retângulo cinza vazio.
2. `BrandImage`: o quadro da foto "respira" (`motion-safe:animate-pulse`) até a foto carregar; `data-foto-estado` = carregando | pronta | falhou.
3. Avatar: as iniciais/silhueta são sempre a base; a foto entra por cima com fade só depois de carregada (`FotoDoAvatar`); se falhar, ficam as iniciais. A última foto conhecida da conta fica em `sessionStorage` (`foto-avatar-cache.ts`, por conta, falhas do storage ignoradas) e aparece já na 1ª pintura; a leitura do servidor confirma ou limpa.

**Testes:** `src/lib/e698-primeira-pintura.test.ts` (visto vermelho antes); guardas de estilo, mapa e componentes verdes; `tsc` limpo.

**Não medido:** sem prova ao vivo e sem medição de tempo (LCP/FCP) — o ganho é de percepção (aviso honesto, prioridade de rede, sem alternância). Se a QA ainda ler "quebrado", o próximo passo é medir com rede lenta (3G) no lab.

**Dúvida:** o mapa-base depende da chave da CARTO (`NEXT_PUBLIC_CARTO_API_KEY`); sem ela o quadro mostra o aviso do E419 (não alterado).
