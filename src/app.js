// app.js
import { createServer } from 'http';
import { Server } from 'socket.io';
import mediasoup from 'mediasoup';

const PORT = process.env.MEDIA_SERVER_PORT || 5050;

// Variáveis globais
let worker;
let router;
const connections = new Map();

// Configuração de codecs
const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000
    }
  }
];

// Inicializar mediasoup Worker
const createWorker = async () => {
  const worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });

  worker.on('died', () => {
    console.error('Mediasoup Worker morreu, saindo em 2 segundos...');
    setTimeout(() => process.exit(1), 2000);
  });

  return worker;
};

// Inicialização do mediasoup
const initializeMediasoup = async () => {
  worker = await createWorker();
  router = await worker.createRouter({ mediaCodecs });
  console.log('Mediasoup inicializado');
};

// Criar servidor HTTP e Socket.io
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Handlers do Socket.io
io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id);

  socket.on('createTransport', async (callback) => {
    try {
      const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP }], // Substitua pelo seu IP público
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      connections.set(socket.id, {
        transport,
        producers: new Map(),
        consumers: new Map()
      });

      callback({
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        }
      });
    } catch (error) {
      console.error('Erro ao criar transport:', error);
      callback({ error: error.message });
    }
  });

  socket.on('connectTransport', async ({ dtlsParameters }, callback) => {
    try {
      const connection = connections.get(socket.id);
      if (!connection) throw new Error('Connection not found');
      
      await connection.transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (error) {
      console.error('Erro ao conectar transport:', error);
      callback({ error: error.message });
    }
  });

  socket.on('produce', async ({ kind, rtpParameters }, callback) => {
    try {
      const connection = connections.get(socket.id);
      if (!connection) throw new Error('Connection not found');

      const producer = await connection.transport.produce({
        kind,
        rtpParameters
      });

      connection.producers.set(producer.id, producer);

      callback({ id: producer.id });

      // Notificar outros usuários sobre novo produtor
      socket.broadcast.emit('newProducer', {
        producerId: producer.id,
        kind: producer.kind
      });
    } catch (error) {
      console.error('Erro ao produzir:', error);
      callback({ error: error.message });
    }
  });

  socket.on('consume', async ({ producerId }, callback) => {
    try {
      const connection = connections.get(socket.id);
      if (!connection) throw new Error('Connection not found');

      const consumer = await connection.transport.consume({
        producerId,
        rtpCapabilities: router.rtpCapabilities,
        paused: true
      });

      connection.consumers.set(consumer.id, consumer);

      callback({
        params: {
          id: consumer.id,
          producerId: producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters
        }
      });

      consumer.on('transportclose', () => {
        connection.consumers.delete(consumer.id);
      });
    } catch (error) {
      console.error('Erro ao consumir:', error);
      callback({ error: error.message });
    }
  });

  socket.on('resumeConsumer', async ({ consumerId }, callback) => {
    try {
      const connection = connections.get(socket.id);
      if (!connection) throw new Error('Connection not found');

      const consumer = connection.consumers.get(consumerId);
      if (!consumer) throw new Error('Consumer not found');

      await consumer.resume();
      callback({ success: true });
    } catch (error) {
      console.error('Erro ao resumir consumer:', error);
      callback({ error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    connections.delete(socket.id);
  });
});

// Iniciar servidor
const startServer = async () => {
  await initializeMediasoup();
  
  httpServer.listen(PORT, () => {
    console.log(`Servidor mediasoup rodando na porta ${PORT}`);
    console.log(`Socket.io disponível em http://localhost:${PORT}`);
  });
};

startServer().catch(console.error);
