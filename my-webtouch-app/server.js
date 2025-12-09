//dom-bridge-demo/server.js + mongo db implemented in here
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import { attachWebTouchHub, printDevBanner } from 'webtouch-sdk';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Player from './models/Player.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Connect to MongoDB directly here
mongoose.connect(process.env.MONGO_URI)
    .then(conn => console.log(`MongoDB Connected: ${conn.connection.host}`))
    .catch(err => {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    });

// Middleware to parse JSON bodies
app.use(express.json());
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// Attach WebTouch hub from the SDK
attachWebTouchHub(io, { debug: true });

app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// --- API Routes ---

// Route: Submit a Score
app.post('/api/score', async (req, res) => {
    const { name, newScore } = req.body;

    try {
        // 1. Check if user exists by name
        const existingPlayer = await Player.findOne({ name: name });

        if (existingPlayer) {
            // 2a. User exists: Check if new score is higher
            if (newScore > existingPlayer.score) {
                existingPlayer.score = newScore;
                await existingPlayer.save();
                return res.json({ message: "New High Score!", data: existingPlayer });
            } else {
                // 2b. User exists but score is lower/equal: Do nothing
                return res.json({ message: "No new record.", data: existingPlayer });
            }
        } else {
            // 3. User does not exist: Create them
            const newPlayer = await Player.create({ name, score: newScore });
            return res.status(201).json({ message: "Welcome new player!", data: newPlayer });
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route: Get Top 20 Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        // .find() -> get everyone
        // .sort({ score: -1 }) -> -1 means Descending (Highest first)
        // .limit(20) -> only take the top 20
        const topPlayers = await Player.find()
            .sort({ score: -1 })
            .limit(20);

        // OPTIONAL: Add "rank" number manually before sending to frontend
        // map converts the database array into a plain JSON array with a rank #
        const rankedList = topPlayers.map((player, index) => ({
            rank: index + 1,      // 0 becomes Rank 1, 1 becomes Rank 2...
            name: player.name,
            score: player.score
        }));

        res.json(rankedList);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//dom-demo-code
// 1. Serve public assets (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// 2. Serve node_modules so the browser can load webtouch-sdk/client.js
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Routes
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/controller', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'controller.html'));
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, '0.0.0.0', () => {
    printDevBanner(PORT);
});
