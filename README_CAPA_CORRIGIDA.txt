CAPA CORRIGIDA v9.1

Problema encontrado:
- O app usava uma capa antiga salva em state.settings.dashboardCover.
- Essa capa salva sobrescrevia o arquivo default-cover.jpeg.

Correção feita:
- A imagem enviada foi colocada em:
  default-cover.jpeg
  visual-kids-oficial.jpeg
  dashboard-cover.jpeg

- O código agora usa uma nova chave:
  dashboardCoverV9

- A capa antiga salva no banco/localStorage não sobrescreve mais a nova capa.

Depois de subir no GitHub/Vercel:
1. Aguarde o deploy.
2. Abra o app.
3. Atualize a página.
4. Se ainda aparecer antiga, limpe cache do Safari ou abra em aba anônima.
