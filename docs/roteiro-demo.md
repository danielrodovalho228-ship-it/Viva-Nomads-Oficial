# Roteiro de demonstração — Viva Nomads

Guia para apresentar a plataforma a **proprietários** e **investidores**. É o
"caminho feliz": passos exatos, o que falar, e o que **não** abrir (funções que
aguardam token de mapa ou parecer jurídico).

**Duração alvo:** 12–15 min. **Tom:** mostrar o produto funcionando + o modelo
de negócio, sempre reforçando a **regra de ouro** (a plataforma nunca movimenta
dinheiro).

---

## 0. Antes de começar (2 min, sozinho)

| Passo | Ação |
|---|---|
| Login | Entre com a conta **admin** (`dtrodovalho40@gmail.com`) |
| Modo demonstração | No painel, ligue o toggle **"Modo demonstração"** (barra do topo) — carrega dados fictícios coerentes, sem tocar no banco |
| Aba limpa | Deixe abertas: `/home`, `/buscar`, `/dashboard` |
| Não abrir | **Mapa** na busca (aguarda token) e qualquer menção a **exigência de apólice** no checklist (aguarda jurídico) |

> Se algo não carregar ao vivo, recarregue a página — o modo demonstração é
> estável e não depende de rede.

---

## 1. Abertura — o problema e o posicionamento (1 min)

**Tela:** `/home`

**Fale:**
- "Aluguel mobiliado de **30 a 180 dias** para quem está em transição —
  profissional realocado, tratamento de saúde, intercâmbio, obra em casa."
- "Não é Airbnb (que é diária) nem imobiliária tradicional (12 meses). É o meio
  que ninguém atende bem: **contrato de verdade + inquilino verificado**."

**Mostre:** a busca do hero — destino, datas e o **seletor de pessoas**
(adultos + crianças).

---

## 2. Jornada do inquilino (3 min)

**2.1 Busca** — `/buscar`
- Aplique um filtro (período/garantias). Aponte os **chips de filtro ativo** e o
  botão "Limpar filtros".
- **Fale:** "Preço **tudo incluído** — aluguel + condomínio + consumo — sem
  surpresa no fim do mês."

**2.2 Imóvel** — clique num card
- Mostre o card de preço, o selo **Pronto para Morar** e o botão de contato.
- **Fale:** "Toda conversa acontece **dentro da plataforma** — é o que fica
  registrado. Ninguém troca telefone por fora."

**2.3 Pedido de Moradia (o diferencial reverso)** — `/pedidos/novo`
- Preencha cidade, prazo, orçamento, ocupantes, motivo.
- **Truque de efeito:** tente escrever um telefone na apresentação → o sistema
  **bloqueia** o contato.
- **Fale:** "O inquilino publica o que precisa e os **proprietários** respondem
  com os imóveis deles. E a identidade do inquilino **só** aparece depois que
  ele aceita — privacidade por padrão."

---

## 3. Jornada do proprietário (4 min)

**3.1 Onboarding** — `/dashboard` (conta sem imóvel mostra o funil)
- **Fale:** "Três passos: **Qualificar → Publicar → Receber**."

**3.2 Editor de anúncio por seções** — `/dashboard/imoveis` → **Editar**
- Abra a seção **Fotos**: arraste uma foto para mudar a **capa**.
- Mostre a **barra de completude** no topo subindo conforme preenche.
- Abra **Regras da casa** (pets/fumar/crianças) e **Comodidades** (micro-texto
  por grupo).
- **Fale:** "Anúncio completo rende mais — a plataforma **guia** o proprietário
  até 100%, e aí libera **Publicar** e **Compartilhar**."

**3.3 Ferramentas** — `/dashboard/ferramentas`
- **Fale:** "Tudo num lugar: viabilidade, simulador, ROI, fechamento, contratos."
- Aponte o card **Seguro incêndio (obrigatório por lei)** — "em estruturação via
  parceiro; a plataforma conecta, não vende seguro."

---

## 4. O coração do modelo — fechamento fracionado (3 min)

**Tela:** `/dashboard/fechamento`

- Ajuste o **prazo total** (contrato-mãe) e mostre a prévia dos **blocos de 2
  meses** (cada bloco ≤ 90 dias, exigência da Lei 8.245).
- Aponte a tabela de **caução 50% por bloco** e o **desembolso do 1º bloco**.
- Na etapa de contrato, mostre a **comissão de fechamento**.

**Falas-chave (decore):**
- "A **comissão é uma só** — 1 mês de aluguel, **uma vez** por contrato. Renovar
  blocos **não** recobra. É por relação fechada, não por prazo."
- "A caução vai para **conta vinculada** ou **emissor do cartão** — **nunca** para
  a plataforma. A gente calcula, conecta e documenta. **Nunca** retém dinheiro."

---

## 5. Contratos & blocos — a vitrine da regra de ouro (2 min)

**Tela:** `/dashboard/contratos` (com modo demonstração ligado)

- Mostre a **timeline de blocos** (Em vigência / Renovado / Agendado), a caução
  por bloco (comprovada/pendente) e o **recebimento declarado**.
- Clique **Registrar recebimento** num bloco vigente → preencha e confirme.
- **Fale (aponte o banner):** *"O pagamento é feito direto ao proprietário. A
  plataforma **registra e documenta — não movimenta valores**."*
- "Isso vira o **histórico do contrato** — base do dossiê e da reputação."

---

## 6. Fechamento para investidor — números (2 min)

**Telas:** `/simulacao` e `/roi`

- No **/simulacao**, mostre receita, custos, **lucro**, margem e ROI da operação.
- Aponte a linha **"Comissão de garantias e seguros"** e a premissa de **seguro
  incêndio**.
- **Fale:** "Receita da plataforma vem de **assinatura** + **comissão única** de
  fechamento + serviços de parceiro. Escala sem virar imobiliária."

---

## 7. Encerramento (30s)

**Recapitule os 3 diferenciais:**
1. **Nicho real** (30–180 dias) que nem Airbnb nem imobiliária atendem.
2. **Confiança** — inquilino verificado, contrato de verdade, tudo registrado.
3. **Regra de ouro** — a plataforma nunca toca no dinheiro; conecta e documenta.

---

## O que EVITAR na demo

| Não faça | Por quê | Se perguntarem, diga |
|---|---|---|
| Abrir o **mapa** na busca | Aguarda `NEXT_PUBLIC_MAPBOX_TOKEN` | "Está pronto no código, ligamos com a chave do mapa." |
| Prometer **captura** de caução/aluguel na plataforma | Fere a regra de ouro (e o modelo) | "Por decisão de produto, dinheiro nunca passa pela plataforma." |
| Afirmar que **exige apólice** de seguro | Aguarda parecer jurídico | "Está em estruturação com parceiro." |
| Editar/registrar em conta **real** durante a demo | Grava no banco | Use sempre o **modo demonstração**. |

---

## Plano B (se travar ao vivo)

- **Página não carrega:** recarregue (F5) — o modo demonstração não depende de rede.
- **Login/sessão perdida:** re-entre com o admin e religue o modo demonstração.
- **Um fluxo com dado real vazio:** ligue o **modo demonstração** (admin) — ele
  popula imóveis, contratos e leads fictícios coerentes.

---

## Checklist rápido (imprima)

- [ ] Logado como admin + **modo demonstração ligado**
- [ ] `/home` → hero + seletor de pessoas
- [ ] `/buscar` → filtros + preço tudo-incluído
- [ ] `/pedidos/novo` → bloqueio de contato
- [ ] `/dashboard/imoveis` → **editor por seções** (capa, completude)
- [ ] `/dashboard/ferramentas` → seguro incêndio (em estruturação)
- [ ] `/dashboard/fechamento` → blocos + caução 50% + comissão única
- [ ] `/dashboard/contratos` → registrar recebimento (declaratório)
- [ ] `/simulacao` + `/roi` → números
- [ ] Encerrar com os 3 diferenciais
