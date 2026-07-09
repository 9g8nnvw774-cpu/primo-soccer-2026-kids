PRIMO SOCCER KIDS 2026 - V32

Melhorias aplicadas:

1. Modo administrador
- O app agora inicia com edição bloqueada.
- Senha inicial: 2026.
- A senha pode ser alterada em Configurações.
- O link dos pais continua somente leitura visual e esconde abas de edição.

Importante: essa proteção é de tela/frontend. Para segurança real do banco, o ideal é usar login/autenticação do Supabase ou backend próprio.

2. Backup e restauração
- Configurações > Exportar backup.
- Configurações > Restaurar backup.
- O arquivo exportado guarda alunos, meses, agenda, pontuação, regras e horários extras.

3. Relatórios individuais
- Nova aba Relatórios.
- Gera resumo por aluno com categoria, pontos do mês, presenças, pontuação anual e texto pronto para enviar aos pais.

4. Presença/frequência
- Na tela Disputa foi adicionado o botão “Marcar presença”.
- Ele marca presença para todos os alunos do horário selecionado.
- A presença aparece no relatório individual.

5. Filtros de ranking
- A aba Ranking agora tem filtro por mês, categoria e semana.
- Permite ver ranking geral, categoria específica, semana 1 a 5 ou mês completo.

6. Impressão melhorada
- A tela Imprimir agora tem opção de Todos, Top 10 ou Top 5.
- Ranking anual usa o total anual corretamente.

7. Estabilidade
- Fotos continuam sendo compactadas antes de salvar.
- A versão foi atualizada para Kids v32.
- Foram mantidas as categorias, horários e banco/app_id existentes.

Observação sobre Supabase:
O arquivo SUPABASE_SQL_SETUP.sql original deixa leitura e escrita públicas para o app funcionar sem login. Isso é simples, mas não é segurança real. Para travar o banco de verdade, será necessário adaptar o app para autenticação Supabase ou criar uma API protegida.
