import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import "dotenv/config";
import cors from 'cors';
import { log } from 'console';

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


const redisHost = process.env.REDIS_HOST;
const redisPort = Number(process.env.REDIS_PORT) || 6379;
const redisPassword = process.env.REDIS_PASSWORD;

// Construct the full Redis URL
const redisUrl = `redis://:${redisPassword}@${redisHost}:${redisPort}`;

const pubClient = createClient({
  url: redisUrl,
  socket: {
    connectTimeout: 20000, // Increased timeout to 20 seconds
    reconnectStrategy: (retries) => {
      console.log(`Redis connection attempt: ${retries}`);
      if (retries > 5) {
        console.error('Max reconnection attempts reached');
        return new Error('Max reconnection attempts');
      }
      return Math.min(retries * 1000, 5000); // Exponential backoff
    }
  }
});

const subClient = createClient({
  url: redisUrl,
  socket: {
    connectTimeout: 20000,
    reconnectStrategy: (retries) => {
      console.log(`Redis connection attempt: ${retries}`);
      if (retries > 5) {
        console.error('Max reconnection attempts reached');
        return new Error('Max reconnection attempts');
      }
      return Math.min(retries * 1000, 5000);
    }
  }
});

// Detailed error logging
pubClient.on('error', (err) => {
  console.error('Redis PubClient Error:', {
    message: err.message,
    code: err.code,
    name: err.name,
    stack: err.stack
  });
});

subClient.on('error', (err) => {
  console.error('Redis SubClient Error:', {
    message: err.message,
    code: err.code,
    name: err.name,
    stack: err.stack
  });
});

// Connection function with extensive logging
async function connectRedisClients() {
  try {
    console.log('Attempting to connect to Redis...');
    console.log('Redis Connection Details:', {
      host: redisHost,
      port: redisPort,
      // Avoid logging password
    });

    await pubClient.connect();
    await subClient.connect();

    console.log('Redis clients connected successfully');

    // Verify connection with ping
    const pubPing = await pubClient.ping();
    const subPing = await subClient.ping();
    console.log('PubClient PING:', pubPing);
    console.log('SubClient PING:', subPing);
  } catch (err) {
    console.error('Comprehensive Redis Connection Error:', {
      message: err.message,
      name: err.name,
      code: err.code,
      stack: err.stack
    });
    
    // Optional: Implement a more graceful error handling strategy
    // You might want to retry, use a fallback, or gracefully degrade functionality
    process.exit(1);
  }
}

// Call connection function
connectRedisClients();

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
