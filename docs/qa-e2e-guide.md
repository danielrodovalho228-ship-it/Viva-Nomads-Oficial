# Viva Nomads — Guia de teste End-to-End (QA)

Guia para o time de QA validar a plataforma de ponta a ponta. Cada cenário tem
**pré-condições**, **passos** e **resultado esperado**. Marque ✅ / ❌ e anote o
que divergir.

> **Regra de ouro (critério de aceite transversal):** a plataforma **nunca
> movimenta dinheiro**. Aluguel e caução vão direto ao proprietário / conta
> vinculada / emissor do cartão. Em qualquer tela onde apareça valor, deve ficar
> claro que a plataforma **registra e documenta — não captura**. Se alguma tela
> sugerir o contrário, é **bug bloqueante**.

---

## 0. Preparação do ambiente

| Item | Como |
|---|---|
| Ambiente | URL de staging/produção fornecida pelo time |
| Navegadores | Chrome + Safari (desktop) e 1 mobile (iOS ou Android) |
| Contas | 1 proprietário, 1 inquilino, 1 admin (`dtrodovalho40@gmail.com`) |
| Migrações Supabase | Confirmar que **0022 → 0029** foram aplicadas (a 0029 é a `pagamentos_bloco`, desta entrega) |
| Modo demonstração | Só o **admin** vê o toggle "Modo demonstração" na barra do painel. Dados fictícios — **nunca** grava no banco |

**Como alternar papel:** no painel, a pílula no topo à direita alterna
**Proprietário ⇄ Inquilino** sem precisar sair da conta.

---

## 1. Cadastro, login e termos

1. Abra `/auth` → aba **Cadastrar**.
2. **Esperado:** há um checkbox obrigatório de **aceite dos termos**; sem marcar,
   o botão de cadastro **não** conclui.
3. Cadastre-se, confirme e faça login.
4. Acesse `/termos` e `/privacidade`.
   - **Esperado:** a cláusula 5 dos termos **não** tem título de capitalização;
     a `/privacidade` menciona o Asaas como "cobrança da assinatura e da comissão
     de fechamento (split único sobre o 1º mês)".

---

## 2. Busca (inquilino)

1. Na home, use a **busca do hero**: destino, datas, e o seletor de **quantidade
   de pessoas** (adultos + crianças).
   - **Esperado:** o popover de pessoas abre **inteiro** (a janela de crianças
     não fica cortada) e fecha ao clicar fora.
2. Rode a busca → cai em `/buscar`.
   - **Esperado:** banner com a imagem da villa (não o banner antigo); H1
     dinâmico com a cidade buscada.
3. Aplique filtros (período, garantias, orçamento) e abra o painel "Mais
   filtros".
   - **Esperado:** chips de filtros ativos + "Limpar filtros"; a contagem de
     resultados atualiza.
4. Force uma busca **sem resultados** (cidade obscura + orçamento baixo).
   - **Esperado:** CTA de "ampliar a busca" **e** o atalho para criar um
     **Pedido de Moradia**.
5. Abra um imóvel: confira o card de preço.
   - **Esperado:** "Tudo incluído" = aluguel + condomínio + consumo fixo, **igual**
     ao valor do card na listagem (não pode divergir).

---

## 3. Pedido de Moradia (fluxo reverso)

**Como inquilino:**
1. `/pedidos/novo` → preencha cidade, datas, prazo, orçamento, nº de ocupantes,
   motivo e apresentação.
2. Na apresentação, tente escrever um **telefone ou e-mail**.
   - **Esperado:** bloqueia com aviso anti-contato (não deixa publicar dados de
     contato).
3. Publique. Tente publicar um **3º** pedido ativo.
   - **Esperado:** limite de **2 pedidos ativos** — bloqueia e orienta a pausar/
     marcar atendido.
4. Em `/dashboard/pedidos`: pause, reative e marque como atendido.

**Como proprietário:**
5. `/pedidos` → veja abas **Compatíveis** / **Demais na cidade** e a ordenação
   (recentes / potencial / prazo).
   - **Esperado:** **nunca** aparece o nome/telefone/e-mail do inquilino antes do
     aceite. Só dados seguros (cidade, prazo, orçamento, ocupantes, motivo).
6. Responda um pedido com um imóvel seu (publicado, capacidade ≥ ocupantes).
   - **Esperado:** responder com imóvel de capacidade menor é **bloqueado**;
     responder 2× com o mesmo imóvel é **bloqueado**.

**De volta como inquilino:**
7. Aceite a resposta.
   - **Esperado:** abre a **conversa interna** com o proprietário; só **agora** o
     nome do inquilino é revelado ao dono.

---

## 4. Dashboard do Proprietário

1. Conta **nova** (sem imóveis): abra `/dashboard`.
   - **Esperado:** funil de 3 passos (Qualificar → Publicar → Receber), não a
     visão de dados vazia.
2. `/qualificar` → conclua a qualificação de um imóvel.
3. `/dashboard/imoveis` → veja o card do imóvel com a **barra de completude**.
   - **Esperado:** o % sobe conforme você preenche; enquanto tiver **menos de 5
     fotos**, aparece "mín. 5 fotos para publicar" e não deixa publicar.
4. Edite o imóvel (botão **Editar** → wizard com `?id=`).
   - **Esperado:** os campos vêm **preenchidos** com os dados salvos; salvar
     atualiza (não cria um duplicado).

---

## 5. Fechamento — contrato fracionado em blocos

1. `/dashboard/fechamento` → percorra o wizard (verificação → garantia →
   serviços → patrimonial → contrato → resumo).
2. Etapa de verificação: informe **nº de ocupantes maior que a capacidade**.
   - **Esperado:** trava o avanço e sugere outro imóvel.
3. Ajuste o **prazo total** (contrato-mãe).
   - **Esperado:** a prévia mostra os **blocos de 2 meses** (cada bloco ≤ 90
     dias), a **caução = 50%** por bloco e o **desembolso do 1º bloco**.
4. Garantia = caução → escolha **à vista** e depois **parcelado**.
   - **Esperado:** o texto deixa claro que o valor vai à **conta vinculada** (à
     vista) ou ao **emissor do cartão** (parcelado) — **nunca** à plataforma.
5. Etapa contrato: confira a **comissão de fechamento**.
   - **Esperado:** cobrada **uma única vez** sobre 1 mês; o texto diz que renovar/
     estender blocos **não** gera nova comissão.
6. Gere o contrato → chega ao resumo final.

---

## 6. Contratos & blocos + registro de pagamento *(entrega desta rodada)*

**Como proprietário:**
1. Menu lateral → **Contratos & blocos** (`/dashboard/contratos`).
   - **Esperado:** banner no topo: *"O pagamento é feito direto ao proprietário.
     A plataforma registra e documenta — não movimenta valores."*
2. Para cada contrato, confira a **timeline de blocos**:
   - Bloco vigente destacado; status **Agendado / Em vigência / Renovado /
     Encerrado**.
   - Por bloco: **Aluguel do bloco**, **Caução (50%)** com selo *comprovada/
     pendente*, e **Recebido (declarado)**.
   - Nota de **comissão do contrato-mãe** (uma única vez).
3. Num bloco em vigência, clique **Registrar recebimento**.
   - Preencha valor, forma (Pix/boleto/transferência/dinheiro/outro), data e
     observação → **Confirmar recebimento**.
   - **Esperado:** o formulário mostra o texto declaratório; ao confirmar, vira
     "Recebimento registrado" — **sem** qualquer cobrança/redirecionamento de
     pagamento.
4. Num bloco **Agendado** (futuro):
   - **Esperado:** o registro **não** abre ("o registro abre quando o bloco entra
     em vigência").

**Como inquilino:**
5. No mesmo contrato, o inquilino vê o pagamento declarado e pode **confirmar**.
   - **Esperado:** só as **duas partes** do contrato veem esses dados (RLS). Um
     terceiro usuário **não** enxerga o contrato de outra pessoa.

**Guarda de rota:**
6. No modo **Inquilino**, acesse `/dashboard/contratos` pela URL.
   - **Esperado:** redireciona para a **Visão geral** (tela é exclusiva do
     proprietário).

**Modo demonstração (admin):**
7. Admin → ligue "Modo demonstração" e abra `/dashboard/contratos`.
   - **Esperado:** 3 contratos fictícios com blocos coerentes e um recebimento já
     confirmado no 1º bloco. Registrar recebimento aqui **não grava nada** (mostra
     "Registro de exemplo").

---

## 7. Mensagens & proteção de contato

1. Inquilino ↔ proprietário trocam mensagens em `/dashboard/mensagens`.
2. Tente enviar **telefone/e-mail/@ de rede social** no corpo da mensagem.
   - **Esperado:** o conteúdo de contato é **mascarado/bloqueado**.
3. **Esperado:** ao receber mensagem nova, o destinatário recebe **notificação por
   e-mail** (se opt-in ligado).

---

## 8. Simulação / ROI (materiais internos)

1. `/simulacao` → confira a linha **"Comissão de garantias e seguros"** (renome de
   "Comissão de garantia") e a premissa de **seguro incêndio** (padrão R$ 40).
2. **Esperado:** os totais batem com os números de referência (garantia 900,
   total 8840, lucro 3640, margem 41%, ROI 70%).

---

## 9. Papéis e permissões (matriz rápida)

| Rota | Visitante | Inquilino | Proprietário | Admin |
|---|---|---|---|---|
| `/dashboard/*` | → `/auth` | ✅ (rotas de inquilino) | ✅ (rotas de dono) | ✅ + Admin |
| `/dashboard/contratos` | → `/auth` | → Visão geral | ✅ | ✅ |
| `/dashboard/imoveis` | → `/auth` | → Visão geral | ✅ | ✅ |
| `/admin/*` | → `/auth` | ❌ | ❌ | ✅ |
| Toggle "Modo demonstração" | — | ❌ | ❌ | ✅ |

---

## 10. Regressão rápida (mobile)

Repita em um celular: **hero/busca**, **abrir um imóvel**, **/pedidos**,
**/dashboard/contratos**.
- **Esperado:** nada estoura a largura da tela (sem scroll horizontal); menus e
  popovers abrem e fecham corretamente.

---

## Como reportar um bug

Para cada falha, registre:
- **Cenário/passo** (ex.: "6.3 — registrar recebimento")
- **Papel e conta** usados
- **O que esperava** × **o que aconteceu**
- **Print/vídeo** + URL + navegador/dispositivo
- **Severidade:** bloqueante (regra de ouro, vazamento de dados, não conclui
  fluxo) / alta / média / baixa.
