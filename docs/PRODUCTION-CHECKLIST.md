# ✅ Checklist de Produção - MediaSoup Server

Use este checklist antes de colocar o servidor em produção.

## 📋 Configuração Inicial

- [ ] **Arquivo `.env` criado e configurado**
  ```bash
  cp .env.example .env
  # Editar .env com valores de produção
  ```

- [ ] **Variáveis de ambiente configuradas corretamente**
  - [ ] `MEDIA_SERVER_PORT=5050`
  - [ ] `MEDIASOUP_ANNOUNCED_IP=sfu.privatehub.com.br`
  - [ ] `MEDIASOUP_RTC_MIN_PORT=40000`
  - [ ] `MEDIASOUP_RTC_MAX_PORT=49999`
  - [ ] `CORS_ORIGIN` inclui todos os domínios do PrivateHub
  - [ ] `NODE_ENV=production`

## 🔥 Firewall e Rede

- [ ] **Portas abertas no firewall**
  ```bash
  # TCP (Socket.IO) - pode ser interna se usando proxy
  sudo ufw allow 5050/tcp
  
  # UDP (WebRTC) - OBRIGATÓRIO estar público
  sudo ufw allow 40000:49999/udp
  ```

- [ ] **Testado conectividade UDP**
  ```bash
  # Teste de porta UDP
  nc -u -l 40000  # No servidor
  nc -u SERVER_IP 40000  # De outro local
  ```

## 🌐 Nginx (Proxy Reverso)

- [ ] **Configuração do Nginx criada**
  - Arquivo: `/etc/nginx/sites-available/sfu.privatehub.com.br`
  - Symlink: `/etc/nginx/sites-enabled/sfu.privatehub.com.br`

- [ ] **SSL/TLS configurado**
  ```bash
  # Certbot para Let's Encrypt
  sudo certbot --nginx -d sfu.privatehub.com.br
  ```

- [ ] **WebSocket habilitado no Nginx**
  - Headers `Upgrade` e `Connection` configurados
  - Timeouts adequados para conexões longas

- [ ] **Nginx reiniciado e testado**
  ```bash
  sudo nginx -t
  sudo systemctl restart nginx
  ```

## �� DNS

- [ ] **Registro DNS criado**
  - Tipo: `A` ou `CNAME`
  - Nome: `sfu.privatehub.com.br`
  - Valor: IP do servidor ou hostname

- [ ] **DNS propagado**
  ```bash
  nslookup sfu.privatehub.com.br
  dig sfu.privatehub.com.br
  ```

## 📦 Dependências

- [ ] **Node.js instalado** (v20+ recomendado)
  ```bash
  node --version
  ```

- [ ] **Dependências NPM instaladas**
  ```bash
  cd /home/lucas/code/privatehub-media
  npm install
  ```

- [ ] **Build compilado** (se usando TypeScript)
  ```bash
  npm run build  # Opcional, tsx compila on-the-fly
  ```

## 🚀 Execução

- [ ] **Servidor inicia sem erros**
  ```bash
  cd /home/lucas/code/privatehub-media
  npm start
  ```

- [ ] **Logs mostram configuração correta**
  ```
  [Config] Media Server Port: 5050
  [Config] Announced IP: sfu.privatehub.com.br
  [Config] RTC Port Range: 40000-49999
  [Config] CORS Origins: [ 'https://privatehub.com.br', ... ]
  [Config] Environment: production
  ```

## 🔄 Process Manager (PM2)

- [ ] **PM2 instalado globalmente**
  ```bash
  npm install -g pm2
  ```

- [ ] **Aplicação adicionada ao PM2**
  ```bash
  cd /home/lucas/code/privatehub-media
  pm2 start npm --name "mediasoup-server" -- start
  pm2 save
  pm2 startup  # Seguir instruções
  ```

- [ ] **Logs do PM2 funcionando**
  ```bash
  pm2 logs mediasoup-server
  pm2 monit
  ```

## 🧪 Testes

- [ ] **Script de teste executado**
  ```bash
  cd /home/lucas/code/privatehub-media
  ./test-connection.sh
  ```

- [ ] **Teste de conexão local (porta 5050)**
  ```bash
  curl http://localhost:5050/
  ```

- [ ] **Teste de conexão via domínio público**
  ```bash
  curl https://sfu.privatehub.com.br/
  ```

- [ ] **WebSocket funciona**
  - Abrir console do browser
  - Testar conexão Socket.IO ao domínio

- [ ] **Teste end-to-end**
  1. Iniciar uma live no PrivateHub
  2. Verificar logs do MediaSoup
  3. Confirmar que vídeo está sendo transmitido
  4. Abrir como viewer e verificar recepção

## 🔍 Monitoramento

- [ ] **Logs persistentes configurados**
  ```bash
  # Com PM2
  pm2 logs mediasoup-server --lines 100
  
  # Ou redirect manual
  npm start >> /var/log/mediasoup.log 2>&1
  ```

- [ ] **Alertas configurados** (opcional)
  - Uptime monitoring (e.g., UptimeRobot)
  - Error tracking (e.g., Sentry)

## 🛡️ Segurança

- [ ] **CORS configurado apenas para domínios permitidos**
- [ ] **SSL/TLS obrigatório em produção**
- [ ] **Firewall limitado apenas às portas necessárias**
- [ ] **Servidor rodando com usuário não-root** (recomendado)
- [ ] **Rate limiting no Nginx** (opcional)

## 📚 Documentação

- [ ] **README.md revisado e atualizado**
- [ ] **ARCHITECTURE.md compreendido**
- [ ] **Equipe treinada para troubleshooting**

## 🔄 Integração com PrivateHub

- [ ] **`.env.production` do PrivateHub configurado**
  ```env
  NEXT_PUBLIC_MEDIA_SERVER_URL=https://sfu.privatehub.com.br
  ```

- [ ] **PrivateHub testado em produção**
  - Iniciar live funciona
  - Chat funciona
  - Vídeo transmite/recebe corretamente

---

## ✅ Checklist Rápido (Resumo)

```bash
# 1. Configuração
✓ .env criado com valores de produção

# 2. Firewall
✓ sudo ufw allow 5050/tcp
✓ sudo ufw allow 40000:49999/udp

# 3. Nginx
✓ Proxy configurado
✓ SSL ativado

# 4. DNS
✓ sfu.privatehub.com.br apontando para o servidor

# 5. Servidor
✓ npm install
✓ pm2 start npm --name "mediasoup-server" -- start

# 6. Teste
✓ ./test-connection.sh passa todos os testes
✓ Live funciona end-to-end
```

## 🆘 Troubleshooting Comum

### Erro: "Cannot connect to media server"
→ Verifique firewall, DNS e se o servidor está rodando

### Erro: "ICE connection failed"
→ Portas UDP 40000-49999 precisam estar abertas e públicas

### Erro: "CORS error"
→ Adicionar domínio do PrivateHub em `CORS_ORIGIN`

### Viewer não recebe vídeo
→ Verificar logs do MediaSoup, pode ser problema de NAT/firewall

---

**Data do último check:** _____/_____/_________

**Responsável:** _________________________________

**Status:** 🟢 Pronto | 🟡 Em progresso | 🔴 Bloqueado
