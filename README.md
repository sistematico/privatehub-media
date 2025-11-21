# PrivateHub Media Server

Servidor MediaSoup standalone para streaming WebRTC do PrivateHub.

## 🎯 Sobre

Este é um servidor **separado** do aplicativo principal PrivateHub, dedicado exclusivamente ao processamento de streaming de vídeo em tempo real usando MediaSoup (SFU - Selective Forwarding Unit).

## 🏗️ Arquitetura

```
PrivateHub (Main App)          PrivateHub Media Server
Port: 3000                     Port: 3001
┌──────────────┐              ┌──────────────┐
│  Next.js     │              │  MediaSoup   │
│  Socket.IO   │◄────────────►│  Socket.IO   │
│  Database    │              │  WebRTC SFU  │
└──────────────┘              └──────────────┘
      ▲                              ▲
      │                              │
      └──────────────────────────────┘
              Browsers/Clients
```

## 📦 Instalação

```bash
# Clone ou navegue para o diretório
cd privatehub-media

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações
```

## ⚙️ Configuração

### Variáveis de Ambiente

```env
# Porta do servidor
MEDIA_SERVER_PORT=3001

# IP público do servidor (importante para produção)
MEDIASOUP_ANNOUNCED_IP=seu-ip-ou-dominio.com

# Range de portas RTC (certifique-se de abrir no firewall)
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=49999

# Origens CORS permitidas
CORS_ORIGIN=https://privatehub.com.br,https://www.privatehub.com.br

# Ambiente
NODE_ENV=production
```

### Firewall

**IMPORTANTE**: Abra as portas necessárias no firewall:

```bash
# Porta do servidor Socket.IO
sudo ufw allow 3001/tcp

# Range de portas RTC para MediaSoup
sudo ufw allow 40000:49999/udp
sudo ufw allow 40000:49999/tcp
```

## 🚀 Uso

### Desenvolvimento

```bash
npm run dev
```

### Produção

```bash
npm start
```

### Com systemd (Recomendado para Produção)

Crie `/etc/systemd/system/privatehub-media.service`:

```ini
[Unit]
Description=PrivateHub Media Server (MediaSoup)
After=network.target

[Service]
Type=simple
User=nginx
WorkingDirectory=/var/www/privatehub-media
ExecStart=/usr/bin/node --import tsx src/server.ts
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=privatehub-media

[Install]
WantedBy=multi-user.target
```

Habilite e inicie:

```bash
sudo systemctl daemon-reload
sudo systemctl enable privatehub-media
sudo systemctl start privatehub-media
sudo systemctl status privatehub-media
```

## 🔗 Integração com PrivateHub Principal

O servidor principal do PrivateHub deve configurar o cliente Socket.IO para conectar ao servidor de mídia:

```typescript
// No frontend (PrivateHub)
import { io } from "socket.io-client";

const mediaSocket = io("http://localhost:3001", {
  transports: ["websocket"],
});

// Eventos disponíveis:
// - mediasoup:getRtpCapabilities
// - mediasoup:createProducerTransport
// - mediasoup:createConsumerTransport
// - mediasoup:produce
// - mediasoup:consume
// etc.
```

## 📡 Eventos Socket.IO

### Cliente → Servidor

- `mediasoup:getRtpCapabilities` - Obter capacidades RTP do router
- `mediasoup:createProducerTransport` - Criar transport para broadcaster
- `mediasoup:createConsumerTransport` - Criar transport para viewer
- `mediasoup:connectProducerTransport` - Conectar transport de broadcaster
- `mediasoup:connectConsumerTransport` - Conectar transport de viewer
- `mediasoup:produce` - Iniciar produção de mídia (broadcaster)
- `mediasoup:consume` - Consumir mídia (viewer)
- `mediasoup:getProducers` - Obter lista de producers disponíveis
- `mediasoup:joinLive` - Entrar em uma sala de live
- `mediasoup:leaveLive` - Sair de uma sala de live

### Servidor → Cliente

- `mediasoup:newProducer` - Notifica sobre novo producer disponível
- `mediasoup:broadcasterLeft` - Broadcaster encerrou transmissão

## 🛠️ Requisitos do Sistema

### Mínimo

- **Node.js**: >= 18.x
- **Python**: 3.x (para compilação do MediaSoup)
- **Compilador C++**: GCC/Clang
- **Make**: Build tools

### Instalação de Dependências (Arch Linux)

```bash
sudo pacman -S base-devel python3 nodejs npm
```

### Instalação de Dependências (Ubuntu/Debian)

```bash
sudo apt-get install build-essential python3 nodejs npm
```

## 📊 Monitoramento

### Logs

```bash
# Systemd
sudo journalctl -u privatehub-media -f

# Direto
npm start
```

### Métricas

O servidor loga automaticamente:
- Criação/encerramento de workers
- Routers criados/fechados por live
- Transports criados
- Producers/Consumers ativos
- Conexões/desconexões de clientes

## 🔧 Troubleshooting

### Erro: "mediasoup-worker ENOENT"

O binário do MediaSoup não foi compilado:

```bash
npm rebuild mediasoup --build-from-source
```

### Erro: "python: command not found"

```bash
sudo ln -s /usr/bin/python3 /usr/bin/python
```

### Viewers não conseguem conectar

1. Verifique se as portas RTC estão abertas no firewall
2. Confirme que `MEDIASOUP_ANNOUNCED_IP` está configurado com o IP/domínio público
3. Verifique logs de ICE connection no browser console

### Performance

Para alta carga, considere:
- Múltiplos workers MediaSoup
- Load balancer (nginx/haproxy)
- Servidores dedicados por região geográfica

## 📝 Desenvolvimento

### Estrutura

```
privatehub-media/
├── src/
│   └── server.ts          # Servidor principal
├── package.json           # Dependências
├── tsconfig.json          # Config TypeScript
├── .env.example           # Exemplo de variáveis
└── README.md             # Este arquivo
```

### Debugging

```bash
# Com logs detalhados do MediaSoup
DEBUG=mediasoup* npm run dev
```

## 📄 Licença

Mesma licença do projeto PrivateHub principal.

## 🤝 Contribuindo

Este servidor faz parte do ecossistema PrivateHub. Para contribuir, consulte o repositório principal.
