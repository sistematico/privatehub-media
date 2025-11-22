# PrivateHub Media Server (MediaSoup)

Servidor WebRTC SFU (Selective Forwarding Unit) para streaming de vídeo em tempo real usando MediaSoup.

## 🚀 Configuração de Produção

### Endereços Configurados

- **Porta do servidor**: `5050`
- **Domínio público**: `sfu.privatehub.com.br`
- **Proxy reverso**: Nginx configurado para `sfu.privatehub.com.br` → `localhost:5050`

### Variáveis de Ambiente

O servidor está configurado no arquivo `.env`:

```env
# Server Configuration
MEDIA_SERVER_PORT=5050

# MediaSoup Configuration
MEDIASOUP_ANNOUNCED_IP=sfu.privatehub.com.br

# RTC Port Range (certifique-se de que essas portas estão abertas no firewall)
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=49999

# CORS Origins (separados por vírgula)
CORS_ORIGIN=https://privatehub.com.br,https://www.privatehub.com.br

# Node Environment
NODE_ENV=production
```

### Portas Necessárias no Firewall

Certifique-se de que as seguintes portas estão abertas:

- **5050/tcp**: Socket.IO (pode ser interna se usando proxy reverso)
- **40000-49999/udp**: Portas RTC para tráfego WebRTC (OBRIGATÓRIO)

## 🔧 Instalação

```bash
npm install
```

## 🏃 Execução

### Desenvolvimento

```bash
npm run dev
```

### Produção

```bash
npm start
```

## 🌐 Configuração do Nginx (Proxy Reverso)

Exemplo de configuração para `sfu.privatehub.com.br`:

```nginx
server {
    listen 80;
    server_name sfu.privatehub.com.br;
    
    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sfu.privatehub.com.br;
    
    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/sfu.privatehub.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sfu.privatehub.com.br/privkey.pem;
    
    # Configurações SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    
    location / {
        proxy_pass http://localhost:5050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts para Socket.IO
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

## 📡 Integração com PrivateHub

O cliente no PrivateHub (`src/components/live/BroadcastStreamMediaSoup.tsx`) já está configurado para usar:

```typescript
const MEDIA_SERVER_URL = process.env.NEXT_PUBLIC_MEDIA_SERVER_URL || "https://sfu.privatehub.com.br";
```

No arquivo `.env.production` do PrivateHub:

```env
NEXT_PUBLIC_MEDIA_SERVER_URL=https://sfu.privatehub.com.br
```

## 🔍 Logs e Monitoramento

O servidor exibe logs detalhados no console:

- Configuração ao iniciar (porta, IP anunciado, CORS)
- Conexões de clientes
- Criação de routers/transports/producers/consumers
- Erros e desconexões

## 🐛 Troubleshooting

### Erro: "Cannot consume" ou "Failed to connect"

- Verifique se as portas UDP **40000-49999** estão abertas no firewall
- Confirme que `MEDIASOUP_ANNOUNCED_IP` está configurado com o IP/domínio público correto

### Erro de CORS

- Verifique se o domínio do PrivateHub está em `CORS_ORIGIN`
- Certifique-se de que não há espaços extras na lista de domínios

### Socket.IO não conecta

- Verifique se o Nginx está corretamente configurado para proxy WebSocket
- Confirme que o certificado SSL está válido
- Teste a conexão: `curl https://sfu.privatehub.com.br`

## 📚 Documentação

- [MediaSoup Documentation](https://mediasoup.org/)
- [Socket.IO Documentation](https://socket.io/docs/v4/)

## 🔐 Segurança

- Sempre use HTTPS em produção
- Mantenha o firewall configurado corretamente
- Limite CORS apenas aos domínios necessários
- Monitore logs para atividades suspeitas
