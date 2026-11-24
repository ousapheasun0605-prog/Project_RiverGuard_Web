import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

let wss = null;
let messageHandler = null;

export const onClientMessage = (handler) => {
  messageHandler = handler;
};

export const broadcast = (type, data) => {
  if (!wss) return;
  const text = JSON.stringify({ type, data, at: new Date().toISOString() });
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.user) client.send(text);
  }
};

export const sendTo = (socket, type, data) => {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify({ type, data, at: new Date().toISOString() }));
  }
};

const authenticateToken = async (token) => {
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, role: true, isActive: true },
    });
    return user && user.isActive ? user : null;
  } catch {
    return null;
  }
};

export const attachWebSocket = (server, { onConnect } = {}) => {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (socket, req) => {
    const url = new URL(req.url, "http://localhost");
    const user = await authenticateToken(url.searchParams.get("token"));

    if (!user) {
      socket.close(4401, "Unauthorized");
      return;
    }

    socket.user = user;
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", async (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return sendTo(socket, "error", { message: "Invalid JSON" });
      }
      if (!messageHandler) return;
      try {
        await messageHandler(socket, message);
      } catch (error) {
        sendTo(socket, "error", { message: error.message });
      }
    });

    if (onConnect) await onConnect(socket);
  });

  // Drop dead browser connections.
  const interval = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  return wss;
};
