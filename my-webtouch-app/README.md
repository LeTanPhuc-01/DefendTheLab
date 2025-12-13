# Defend the Lab

**Defend the Lab** is an interactive computational game where you play as a cybersecurity admin defending a high-security facility from digital threats.

## 🛡️ What it Does

You are the last line of defense for a lab holding critical national secrets. Dangerous viruses—encoded in **Decimal**, **Binary**, and **Octal** formats—are attempting to breach the firewall.

Your mission is to **decode** these viruses by translating their values into decimal numbers using your controller. Correctly identifying the threat neutralizes the virus before it can penetrate the system.

## 🚀 Install & Run

### 1. Node.js Server (Game Hub)
1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Start the System**
    ```bash
    npm start
    ```
    This command launches the Node.js server (Hub) and serves the application at `http://localhost:3000`.

### 2. Python Backend (AI Model)
The game requires a Python backend to process handwriting recognition.

1.  **Install Python Dependencies**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Start the Python Server**
    ```bash
    python src/app.py
    ```
    This will start the Flask server on `http://0.0.0.0:5000`.

> **Note:** Both the Node.js server and the Python server must be running for the game to work correctly.

## ⚙️ How it Works

Defend the Lab is built on a robust "Thick-Server" architecture leveraging the **WebTouch SDK**.

*   **Core Stack**:
    *   **Node.js & Express**: Handles routing and serves as the central Hub.
    *   **MongoDB Atlas**: Persists player scores and game data.
    *   **Python Flask**: Runs the AI Character Recognition model to process handwriting inputs.
    *   **Phaser**: Renders the game world and handles physics on the main Kiosk display.

*   **Architecture**:
    The system uses a centralized **Server (Hub)** that orchestrates communication between two asymmetric clients via **Socket.IO** (pre-configured in the `webtouch-sdk`):
    1.  **WebTouch Kiosk**: The main game screen (TV/Monitor) running the Phaser game engine.
    2.  **Controller Device**: A mobile interface where players write their answers.

## 📡 API Usage Examples

```bash
# Example: Submit Score
curl -X POST http://localhost:3000/api/score \
     -H "Content-Type: application/json" \
     -d '{"name": "Admin1", "newScore": 150}'
```

## 📚 Developer Documentation

