#!/bin/bash

# Script de teste de conexão do servidor MediaSoup

echo "🔍 Testando servidor MediaSoup..."
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar se o servidor está rodando na porta 5050
echo "1. Verificando se a porta 5050 está aberta..."
if nc -z localhost 5050 2>/dev/null; then
    echo -e "${GREEN}✓ Servidor está rodando na porta 5050${NC}"
else
    echo -e "${RED}✗ Servidor NÃO está rodando na porta 5050${NC}"
    echo "Execute: cd /home/lucas/code/privatehub-media && npm start"
    exit 1
fi

# 2. Testar conexão HTTP
echo ""
echo "2. Testando conexão HTTP..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5050/)
if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 404 ]; then
    echo -e "${GREEN}✓ Servidor HTTP respondendo (código: $HTTP_CODE)${NC}"
else
    echo -e "${YELLOW}⚠ Servidor retornou código: $HTTP_CODE${NC}"
fi

# 3. Verificar domínio público (se configurado)
echo ""
echo "3. Testando domínio público (sfu.privatehub.com.br)..."
if curl -s -o /dev/null -w "%{http_code}" https://sfu.privatehub.com.br/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Domínio público acessível via HTTPS${NC}"
else
    echo -e "${YELLOW}⚠ Domínio público não acessível (pode ser normal em dev)${NC}"
fi

# 4. Verificar portas RTC
echo ""
echo "4. Verificando portas RTC (40000-49999)..."
echo -e "${YELLOW}ℹ Para produção, certifique-se de que as portas UDP 40000-49999 estão abertas no firewall${NC}"

# 5. Mostrar processos
echo ""
echo "5. Processos relacionados ao MediaSoup:"
ps aux | grep -E "node.*server.ts|tsx.*server.ts" | grep -v grep || echo "Nenhum processo encontrado"

echo ""
echo -e "${GREEN}✓ Teste concluído!${NC}"
