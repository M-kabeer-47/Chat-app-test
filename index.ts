import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import "dotenv/config";
import cors from 'cors';

const app = express();
app.use(cors({ origin: "*" }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Redis connection configuration
const redisHost = process.env.REDIS_HOST; // e.g., "your-redis-host.amazonaws.com"
const redisPort = Number(process.env.REDIS_PORT) || 6379; // Default Redis port
const redisPassword = process.env.REDIS_PASSWORD;

const pubClient = createClient({
  socket: {
    host: redisHost,
    port: redisPort,
  },
  password: redisPassword,
});

const subClient = pubClient.duplicate();

// Connect and handle errors
pubClient.connect().catch(err => {
  console.error('Failed to connect to Redis (pubClient):', err.message);
});

subClient.connect().catch(err => {
  console.error('Failed to connect to Redis (subClient):', err.message);
});

// Handle Redis client errors
pubClient.on('error', (err) => {
  console.error('Redis pubClient error:', err);
});

subClient.on('error', (err) => {
  console.error('Redis subClient error:', err);
});

// Handle Redis client reconnection attempts
pubClient.on('reconnecting', (attempt) => {
  console.log(`Redis pubClient reconnecting, attempt #${attempt}`);
});

subClient.on('reconnecting', (attempt) => {
  console.log(`Redis subClient reconnecting, attempt #${attempt}`);
});

pubClient.on('end', () => {
  console.warn('Redis pubClient connection closed.');
});

subClient.on('end', () => {
  console.warn('Redis subClient connection closed.');
});

// Attach Redis adapter
io.adapter(createAdapter(pubClient, subClient));

io.on('connect', (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on('register', async (userId) => {
    try {
      await pubClient.hSet('online_users', userId, socket.id);
      console.log("User registered:", userId);
    } catch (err) {
      console.error("Error registering user:", err.message);
    }
  });

  socket.on('send-private-message', async ({ senderId, recipientId, message }) => {
    try {
      const recipientSocketId = await pubClient.hGet('online_users', recipientId);
      console.log("Recipient socket ID:", recipientSocketId);

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('private-message', {
          senderId,
          message
        });
      } else {
        console.log(`Recipient ${recipientId} is not online`);
      }
    } catch (err) {
      console.error("Error sending private message:", err.message);
    }
  });

  socket.on('disconnect', async () => {
    console.log("Socket disconnected:", socket.id);
    try {
      const userId = Object.entries(await pubClient.hGetAll('online_users')).find(
        ([, id]) => id === socket.id
      );
      if (userId) {
        await pubClient.hDel('online_users', userId);
      }
    } catch (err) {
      console.error("Error handling disconnect:", err.message);
    }
  });
});

// Start server
const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
