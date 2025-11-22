# Arquitetura do Sistema de Streaming

## 🏗️ Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX (Proxy Reverso)                         │
│                                                                   │
│  • privatehub.com.br → localhost:3000 (Next.js)                  │
│  • sfu.privatehub.com.br → localhost:5050 (MediaSoup)            │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    │ HTTP                      │ WebSocket/HTTP
                    ▼                           ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│   PrivateHub (Next.js)   │    │  MediaSoup Server (Node.js)  │
│   Port: 3000             │    │  Port: 5050                  │
│                          │    │                              │
│  • UI/UX                 │    │  • WebRTC SFU                │
│  • Autenticação          │◄───┤  • Socket.IO Server          │
│  • Chat/API              │    │  • Producer/Consumer Mgmt    │
│  • Database (SQLite)     │    │  • RTC Ports: 40000-49999    │
└──────────────────────────┘    └──────────────────────────────┘
           │                                   │
           │ Socket.IO                         │ WebRTC (UDP)
           ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENTES (Browsers)                         │
│                                                                   │
│  • BroadcastStreamMediaSoup.tsx (Broadcaster)                    │
│  • LiveStreamPlayer.tsx (Viewer)                                 │
│  • Socket.IO Client                                              │
│  • mediasoup-client (WebRTC)                                     │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Fluxo de Streaming

### 1. Broadcaster (Iniciando Live)

```
Cliente (Browser)
    │
    ├─1─► POST /api/lives/start
    │     (cria live no DB + chatroom)
    │
    ├─2─► getUserMedia()
    │     (captura câmera/microfone)
    │
    ├─3─► Socket.IO → Main Server (localhost:3000)
    │     • user:online
    │     • live:join
    │
    ├─4─► Socket.IO → Media Server (sfu.privatehub.com.br:5050)
    │     • mediasoup:getRtpCapabilities
    │     • mediasoup:createProducerTransport
    │
    ├─5─► WebRTC Handshake
    │     • Connect transport (DTLS)
    │     • Produce video/audio tracks
    │
    └─6─► Streaming! 🎥
          (media flui via UDP 40000-49999)
```

### 2. Viewer (Assistindo Live)

```
Cliente (Browser)
    │
    ├─1─► GET /[username]/live
    │     (carrega página da live)
    │
    ├─2─► Socket.IO → Main Server
    │     • live:join (recebe chat + viewer count)
    │
    ├─3─► Socket.IO → Media Server
    │     • mediasoup:getRtpCapabilities
    │     • mediasoup:getProducers
    │     • mediasoup:createConsumerTransport
    │
    ├─4─► WebRTC Handshake
    │     • Connect transport
    │     • Consume video/audio tracks
    │
    └─5─► Recebendo stream! 📺
          (media recebida via UDP)
```

## 📊 Componentes e Responsabilidades

### PrivateHub (Next.js - Port 3000)

**Arquivos Principais:**
- `src/server.ts` - Servidor Bun customizado
- `src/app/[username]/start-live/page.tsx` - Página de início de live
- `src/components/live/BroadcastStreamMediaSoup.tsx` - Componente broadcaster
- `src/components/live/LiveStreamPlayer.tsx` - Player de visualização
- `src/actions/live.ts` - Server actions para lives

**Responsabilidades:**
- ✅ Autenticação e sessões
- ✅ CRUD de lives (iniciar/parar)
- ✅ Chat em tempo real
- ✅ Contador de espectadores
- ✅ Persistência no banco de dados

### MediaSoup Server (Node.js - Port 5050)

**Arquivos Principais:**
- `src/server.ts` - Servidor MediaSoup + Socket.IO
- `.env` - Configurações de produção

**Responsabilidades:**
- ✅ SFU (Selective Forwarding Unit)
- ✅ Gerenciamento de Workers/Routers
- ✅ Producer/Consumer Transports
- ✅ Roteamento de mídia WebRTC
- ✅ Escalabilidade (suporta 100+ viewers por live)

## 🔐 Segurança e Performance

### Configuração de Rede

**Portas Necessárias:**
- `3000/tcp` - Next.js (interno)
- `5050/tcp` - Socket.IO MediaSoup (interno se usando proxy)
- `40000-49999/udp` - **OBRIGATÓRIO**: Tráfego WebRTC (PÚBLICO)

### Variáveis de Ambiente

**PrivateHub (.env.production):**
```env
NEXT_PUBLIC_MEDIA_SERVER_URL=https://sfu.privatehub.com.br
```

**MediaSoup (.env):**
```env
MEDIA_SERVER_PORT=5050
MEDIASOUP_ANNOUNCED_IP=sfu.privatehub.com.br
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=49999
CORS_ORIGIN=https://privatehub.com.br,https://www.privatehub.com.br
NODE_ENV=production
```

## 🚀 Deploy e Execução

### Servidor MediaSoup

```bash
cd /home/lucas/code/privatehub-media
npm install
npm start  # Produção
```

### PrivateHub

```bash
cd /home/lucas/code/privatehub
bun install
bun run dev  # ou bun run build && bun start
```

## 📈 Escalabilidade

O MediaSoup é um SFU (Selective Forwarding Unit) que:

- ✅ Suporta centenas de espectadores simultâneos por live
- ✅ Usa menos CPU que P2P ou MCU
- ✅ Latência ultra-baixa (~500ms)
- ✅ Pode ser escalado horizontalmente com múltiplos workers

## 🔍 Debugging

### Verificar se MediaSoup está rodando

```bash
cd /home/lucas/code/privatehub-media
./test-connection.sh
```

### Logs do servidor

```bash
# MediaSoup
cd /home/lucas/code/privatehub-media && npm start

# PrivateHub
cd /home/lucas/code/privatehub && bun run dev
```

### Teste de conexão WebRTC

Abra o console do browser (F12) e procure por:
- `[MediaSoup]` - Logs do cliente MediaSoup
- Erros de ICE/DTLS - Problemas de firewall/rede
