# E1042-EVIDENCIA-P3: o pacote de evidência do E1042 para a Fable (ORDEM-DUET-241/242)
**Ramo de evidência, descartável, sem histórico: NUNCA mergear.** Foi publicado pela Pista 3.

- `evidencia/E1042/41-e1042-superficie-cogumelo.md`: a superfície exata, o mecanismo e a correção.
- `evidencia/E1042/antes-depois-0{6,7,8}-…png`: a imagem-base da main (à esquerda) e a imagem com o #3880 (à direita).

## Como ler
```
git fetch origin claude/serene-cerf-i8n6qj-E1042-EVIDENCIA-P3
git show FETCH_HEAD:evidencia/E1042/41-e1042-superficie-cogumelo.md
```

**O resumo:**
- **Onde:** a rota `/dashboard/estadia/[contrato]`, a folha "Ações desta estadia" a 390 px, as imagens-base do t263 06/07/08, e `t263-visual-41.spec.ts:213–236` (as máscaras nas linhas 40–52).
- **O mecanismo:** `toHaveScreenshot` da folha com `mask: mascaras(page)`, que procura na página inteira. A pílula do #3880 desloca a página (+44 px morador, +66 px dono), e um elemento mascarado por trás da folha passa a tapar o título.
- **A correção (só teste):** as máscaras procuradas dentro da folha. Depois, as 3 imagens-base são refeitas na imagem do Playwright.
