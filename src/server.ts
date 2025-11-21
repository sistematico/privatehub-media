/**
 * MediaSoup Media Server
 * Servidor Node.js dedicado para streaming de vídeo usando MediaSoup SFU
 * Roda em paralelo com o servidor principal (Bun)
 */

import { Server } from "socket.io";
import { createServer } from "node:http";
import * as mediasoup from "mediasoup";
import type { types } from "mediasoup";

type Router = types.Router;
type Worker = types.Worker;
type WebRtcTransport = types.WebRtcTransport;
type Producer = types.Producer;
type Consumer = types.Consumer;

type PeerTransport = {
  producerTransport?: WebRtcTransport;
  consumerTransport?: WebRtcTransport;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
};

// MediaSoup worker
let worker: Worker;

// Routers por live (liveId -> Router)
const routers = new Map<number, Router>();

// Peers por socket (socketId -> PeerTransport)
const peers = new Map<string, PeerTransport>();

// Broadcasters por live (liveId -> socketId)
const broadcasters = new Map<number, string>();

// MediaSoup configuration
const mediaCodecs = [
  {
    kind: "audio" as const,
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video" as const,
    mimeType: "video/VP8",
    clockRate: 90000,
  },
] as types.RtpCodecCapability[];

// Server configuration
const MEDIA_SERVER_PORT = process.env.MEDIA_SERVER_PORT ? parseInt(process.env.MEDIA_SERVER_PORT, 10) : 3001;
const MEDIASOUP_ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1";

// Initialize MediaSoup Worker
async function createWorker() {
  if (worker) return worker;

  worker = await mediasoup.createWorker({
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });

  console.log(`[MediaSoup] Worker created with PID: ${worker.pid}`);

  worker.on("died", () => {
    console.error("[MediaSoup] Worker died, exiting in 2 seconds...");
    setTimeout(() => process.exit(1), 2000);
  });

  return worker;
}

// Get or create router for a live
async function getRouter(liveId: number): Promise<Router> {
  let router = routers.get(liveId);

  if (!router) {
    if (!worker) {
      await createWorker();
    }

    router = await worker.createRouter({ mediaCodecs });
    routers.set(liveId, router);
    console.log(`[MediaSoup] Router created for live ${liveId}`);
  }

  return router;
}

// Clean up router when live ends
function closeRouter(liveId: number) {
  const router = routers.get(liveId);
  if (router) {
    router.close();
    routers.delete(liveId);
    broadcasters.delete(liveId);
    console.log(`[MediaSoup] Router closed for live ${liveId}`);
  }
}

// Create WebRTC transport
async function createWebRtcTransport(liveId: number, socketId: string, direction: "send" | "recv") {
  const router = await getRouter(liveId);

  const transport = await router.createWebRtcTransport({
    listenIps: [
      {
        ip: "0.0.0.0",
        announcedIp: MEDIASOUP_ANNOUNCED_IP,
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  console.log(`[MediaSoup] ${direction} transport created for socket ${socketId}`);

  // Store transport
  let peer = peers.get(socketId);
  if (!peer) {
    peer = {
      producers: new Map(),
      consumers: new Map(),
    };
    peers.set(socketId, peer);
  }

  if (direction === "send") {
    peer.producerTransport = transport;
  } else {
    peer.consumerTransport = transport;
  }

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

// Connect transport
async function connectTransport(socketId: string, transportId: string, dtlsParameters: types.DtlsParameters) {
  const peer = peers.get(socketId);
  if (!peer) throw new Error("Peer not found");

  const transport = peer.producerTransport?.id === transportId ? peer.producerTransport : peer.consumerTransport;

  if (!transport) throw new Error("Transport not found");

  await transport.connect({ dtlsParameters });
  console.log(`[MediaSoup] Transport connected for socket ${socketId}`);
}

// Produce media
async function produce(
  liveId: number,
  socketId: string,
  kind: types.MediaKind,
  rtpParameters: types.RtpParameters
) {
  const peer = peers.get(socketId);
  if (!peer?.producerTransport) throw new Error("Producer transport not found");

  const producer = await peer.producerTransport.produce({
    kind,
    rtpParameters,
  });

  peer.producers.set(producer.id, producer);
  broadcasters.set(liveId, socketId);

  console.log(`[MediaSoup] Producer created: ${producer.id} (${kind}) for live ${liveId}`);

  return { id: producer.id };
}

// Consume media
async function consume(
  liveId: number,
  socketId: string,
  producerId: string,
  rtpCapabilities: types.RtpCapabilities
) {
  const router = await getRouter(liveId);
  const peer = peers.get(socketId);

  if (!peer?.consumerTransport) throw new Error("Consumer transport not found");

  // Check if we can consume
  if (!router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error("Cannot consume");
  }

  const consumer = await peer.consumerTransport.consume({
    producerId,
    rtpCapabilities,
    paused: false,
  });

  peer.consumers.set(consumer.id, consumer);

  console.log(`[MediaSoup] Consumer created: ${consumer.id} for producer ${producerId}`);

  return {
    id: consumer.id,
    producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
  };
}

// Get all producers for a live (for new consumers to subscribe)
function getProducers(liveId: number): string[] {
  const broadcasterSocketId = broadcasters.get(liveId);
  if (!broadcasterSocketId) return [];

  const peer = peers.get(broadcasterSocketId);
  if (!peer) return [];

  return Array.from(peer.producers.keys());
}

// Clean up peer
function removePeer(socketId: string) {
  const peer = peers.get(socketId);
  if (!peer) return;

  // Close all producers
  for (const producer of peer.producers.values()) {
    producer.close();
  }

  // Close all consumers
  for (const consumer of peer.consumers.values()) {
    consumer.close();
  }

  // Close transports
  peer.producerTransport?.close();
  peer.consumerTransport?.close();

  peers.delete(socketId);
  console.log(`[MediaSoup] Peer removed: ${socketId}`);
}

// Initialize server
async function startMediaServer() {
  console.log("[Media Server] Starting MediaSoup server...");

  // Create MediaSoup worker
  await createWorker();

  // Create HTTP server for Socket.IO
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production" 
        ? ["https://privatehub.com.br", "https://www.privatehub.com.br"]
        : ["http://localhost:3000"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Media Server] Client connected: ${socket.id}`);

    // Get RTP capabilities
    socket.on("mediasoup:getRtpCapabilities", async ({ liveId }: { liveId: number }, callback) => {
      try {
        const router = await getRouter(liveId);
        callback({ rtpCapabilities: router.rtpCapabilities });
      } catch (error) {
        console.error("Error getting RTP capabilities:", error);
        callback({ error: "Failed to get RTP capabilities" });
      }
    });

    // Create producer transport
    socket.on("mediasoup:createProducerTransport", async ({ liveId }: { liveId: number }, callback) => {
      try {
        const transport = await createWebRtcTransport(liveId, socket.id, "send");
        callback(transport);
      } catch (error) {
        console.error("Error creating producer transport:", error);
        callback({ error: "Failed to create producer transport" });
      }
    });

    // Create consumer transport
    socket.on("mediasoup:createConsumerTransport", async ({ liveId }: { liveId: number }, callback) => {
      try {
        const transport = await createWebRtcTransport(liveId, socket.id, "recv");
        callback(transport);
      } catch (error) {
        console.error("Error creating consumer transport:", error);
        callback({ error: "Failed to create consumer transport" });
      }
    });

    // Connect producer transport
    socket.on("mediasoup:connectProducerTransport", async ({ transportId, dtlsParameters }: { transportId: string; dtlsParameters: types.DtlsParameters }, callback) => {
      try {
        await connectTransport(socket.id, transportId, dtlsParameters);
        callback({ success: true });
      } catch (error) {
        console.error("Error connecting producer transport:", error);
        callback({ error: "Failed to connect producer transport" });
      }
    });

    // Connect consumer transport
    socket.on("mediasoup:connectConsumerTransport", async ({ transportId, dtlsParameters }: { transportId: string; dtlsParameters: types.DtlsParameters }, callback) => {
      try {
        await connectTransport(socket.id, transportId, dtlsParameters);
        callback({ success: true });
      } catch (error) {
        console.error("Error connecting consumer transport:", error);
        callback({ error: "Failed to connect consumer transport" });
      }
    });

    // Produce media
    socket.on("mediasoup:produce", async ({ liveId, kind, rtpParameters }: { liveId: number; kind: types.MediaKind; rtpParameters: types.RtpParameters }, callback) => {
      try {
        const result = await produce(liveId, socket.id, kind, rtpParameters);
        callback(result);

        // Notify all clients in this live about new producer
        socket.to(`live:${liveId}`).emit("mediasoup:newProducer", { producerId: result.id });
      } catch (error) {
        console.error("Error producing:", error);
        callback({ error: "Failed to produce" });
      }
    });

    // Consume media
    socket.on("mediasoup:consume", async ({ liveId, producerId, rtpCapabilities }: { liveId: number; producerId: string; rtpCapabilities: types.RtpCapabilities }, callback) => {
      try {
        const result = await consume(liveId, socket.id, producerId, rtpCapabilities);
        callback(result);
      } catch (error) {
        console.error("Error consuming:", error);
        callback({ error: "Failed to consume" });
      }
    });

    // Get available producers
    socket.on("mediasoup:getProducers", async ({ liveId }: { liveId: number }, callback) => {
      try {
        const producers = getProducers(liveId);
        callback({ producers });
      } catch (error) {
        console.error("Error getting producers:", error);
        callback({ error: "Failed to get producers" });
      }
    });

    // Join live room
    socket.on("mediasoup:joinLive", ({ liveId }: { liveId: number }) => {
      socket.join(`live:${liveId}`);
      console.log(`[Media Server] Socket ${socket.id} joined live ${liveId}`);
    });

    // Leave live room
    socket.on("mediasoup:leaveLive", ({ liveId }: { liveId: number }) => {
      socket.leave(`live:${liveId}`);
      console.log(`[Media Server] Socket ${socket.id} left live ${liveId}`);
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log(`[Media Server] Client disconnected: ${socket.id}`);
      removePeer(socket.id);

      // Check if this was a broadcaster
      for (const [liveId, broadcasterSocketId] of broadcasters.entries()) {
        if (broadcasterSocketId === socket.id) {
          closeRouter(liveId);
          socket.to(`live:${liveId}`).emit("mediasoup:broadcasterLeft");
        }
      }
    });
  });

  httpServer.listen(MEDIA_SERVER_PORT, () => {
    console.log(`[Media Server] MediaSoup server running on port ${MEDIA_SERVER_PORT}`);
    console.log(`[Media Server] Announced IP: ${MEDIASOUP_ANNOUNCED_IP}`);
  });
}

// Start server
startMediaServer().catch((error) => {
  console.error("[Media Server] Failed to start:", error);
  process.exit(1);
});
