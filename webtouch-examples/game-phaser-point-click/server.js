// server.js

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

import { attachWebTouchHub, printDevBanner } from "webtouch-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Attach WebTouch hub: handles rooms, app/controller registration,
// controller_event routing with controllerId, etc.
attachWebTouchHub(io, { debug: true });

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/node_modules", express.static(path.join(__dirname, "node_modules")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "app.html"));
});

app.get("/controller", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "controller.html"));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  printDevBanner(PORT);
});
