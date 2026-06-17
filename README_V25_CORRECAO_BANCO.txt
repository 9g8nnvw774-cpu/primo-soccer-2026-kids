VERSÃO 25 - CORREÇÃO DE CONEXÃO COM BANCO

Baseada na versão enviada pelo João.
Mantém o mesmo Supabase URL, publishable key e App ID:
primo_soccer_2026_kids

Ajustes:
- Conexão com banco reforçada com REST direto + fallback supabase-js.
- Timeout aumentado para 30 segundos.
- Não troca App ID, não limpa cadastros e não zera pontuações.
- Mantém dados locais caso o banco demore, permitindo tentar Recarregar online/Sincronizar.
- Fotos/cadastro continuam com salvamento local e tentativa online.
