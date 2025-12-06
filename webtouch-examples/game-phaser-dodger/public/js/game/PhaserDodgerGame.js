// public/js/game/PhaserDodgerGame.js

/* global Phaser */

export class PhaserDodgerGame {
  constructor({ parentId = "game-container" } = {}) {
    this.parentId = parentId;
    this.game = null;
    this.scene = null; // GameScene instance
    this.pendingJoins = []; // { controllerId, meta }
  }

  start() {
    if (this.game) {
      this.game.scene.start("GameScene", {
        onReady: (scene) => this._onSceneReady(scene),
      });
      return;
    }

    const config = {
      type: Phaser.AUTO,
      scale: {
        mode: Phaser.Scale.FIT,
        parent: this.parentId,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 600,
        height: 800,
      },
      physics: {
        default: "arcade",
        arcade: { debug: false },
      },
      scene: [GameScene],
    };

    this.game = new Phaser.Game(config);
    this.game.scene.start("GameScene", {
      onReady: (scene) => this._onSceneReady(scene),
    });
  }

  _onSceneReady(scene) {
    this.scene = scene;

    // Flush any controllers that joined before scene was ready
    if (this.pendingJoins.length > 0) {
      this.pendingJoins.forEach(({ controllerId, meta }) => {
        this.scene.addPlayer(controllerId, meta);
      });
      this.pendingJoins = [];
    }
  }

  pause() {
    if (this.game && this.scene) {
      this.game.scene.pause("GameScene");
    }
  }

  controllerJoined(controllerId, meta) {
    if (!this.scene) {
      this.pendingJoins.push({ controllerId, meta });
      return;
    }
    this.scene.addPlayer(controllerId, meta);
  }

  controllerLeft(controllerId) {
    if (!this.scene) return;
    this.scene.removePlayer(controllerId);
  }

  cursorMove(controllerId, deltaX, deltaY) {
    if (!this.scene) return;
    this.scene.onPlayerMove(controllerId, deltaX, deltaY);
  }

  tap(controllerId, source) {
    if (!this.scene) return;
    this.scene.onPlayerAction(controllerId, source);
  }
}

// ---------------------------------------------------------------------------
// GameScene: unchanged logic + tiny hook in init()
// ---------------------------------------------------------------------------

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
    this.playersGroup = null;
    this.playerObjects = new Map(); // controllerId → player
    this.enemies = null;
    this.enemySpawnTimer = null;
    this.score = 0;
    this.scoreText = null;
    this.gameOver = false;
    this.gameStarted = false;
    this.waitingText = null;
    this.playerSensitivity = 1.5;
    this.playerSize = 35;
    this._onReady = null;
  }

  init(data) {
    // data.onReady is passed from PhaserDodgerGame.start()
    if (data && typeof data.onReady === "function") {
      this._onReady = data.onReady;
    }
  }

  preload() {}

  create() {
    this.playersGroup = this.physics.add.group({ collideWorldBounds: true });
    this.enemies = this.physics.add.group();

    this.physics.add.collider(
      this.playersGroup,
      this.enemies,
      this.hitEnemy,
      null,
      this
    );
    this.physics.add.collider(this.playersGroup, this.playersGroup);

    this.score = 0;
    this.scoreText = this.add
      .text(16, 16, "Score: 0", {
        fontSize: "24px",
        fill: "#FFF",
      })
      .setDepth(1);

    this.gameOverText = this.add
      .text(
        this.cameras.main.centerX,
        this.cameras.main.centerY,
        "GAME OVER\nTap controller to Restart",
        { fontSize: "32px", fill: "#FF0000", align: "center" }
      )
      .setOrigin(0.5)
      .setDepth(1)
      .setVisible(false);

    this.waitingText = this.add
      .text(
        this.cameras.main.centerX,
        this.cameras.main.centerY,
        "Waiting for player(s) to join...",
        { fontSize: "28px", fill: "#FFF", align: "center" }
      )
      .setOrigin(0.5)
      .setDepth(1)
      .setVisible(true);

    this.enemySpawnTimer = this.time.addEvent({
      delay: 800,
      callback: this.spawnEnemy,
      callbackScope: this,
      loop: true,
      paused: true,
    });

    // Notify PhaserDodgerGame that the scene is fully ready
    if (this._onReady) {
      this._onReady(this);
    }
  }

  addPlayer(controllerId, playerData) {
    const startX =
      this.cameras.main.width / 2 + Phaser.Math.Between(-50, 50);
    const startY =
      this.cameras.main.height / 2 + Phaser.Math.Between(-50, 50);

    const player = this.add.rectangle(
      startX,
      startY,
      this.playerSize,
      this.playerSize,
      playerData.color
    );
    this.playersGroup.add(player);
    player.body.setCollideWorldBounds(true);
    player.body.allowGravity = false;
    player.body.setBounce(0.1);
    player.body.setDrag(0.5);
    player.body.useDamping = true;

    player.setData("playerNumber", playerData.playerNumber);
    player.setData("controllerId", controllerId);
    player.setData("baseColor", playerData.color); // 🔹 remember original color
    this.playerObjects.set(controllerId, player);

    if (!this.gameStarted) this.startGame();
  }

  removePlayer(controllerId) {
    const player = this.playerObjects.get(controllerId);
    if (!player) return;
    const playerNumber = player.getData("playerNumber");
    showStatus(`Player ${playerNumber} left.`, 2000);

    this.playersGroup.remove(player, true, true);
    this.playerObjects.delete(controllerId);

    if (this.playerObjects.size === 0 && this.gameStarted && !this.gameOver) {
      this.pauseGame();
    }
  }

  onPlayerMove(controllerId, deltaX, deltaY) {
    if (this.gameOver || !this.gameStarted) return;
    const player = this.playerObjects.get(controllerId);
    if (!player || !player.body) return;

    const dx = (deltaX || 0) * this.playerSensitivity;
    const dy = (deltaY || 0) * this.playerSensitivity;

    let newX = player.x + dx;
    let newY = player.y + dy;
    const halfW = player.displayWidth / 2;
    const halfH = player.displayHeight / 2;

    newX = Phaser.Math.Clamp(
      newX,
      halfW,
      this.cameras.main.width - halfW
    );
    newY = Phaser.Math.Clamp(
      newY,
      halfH,
      this.cameras.main.height - halfH
    );

    player.setPosition(newX, newY);
    player.body.setVelocity(0, 0);
  }

  onPlayerAction(controllerId, source) {
    if (this.gameOver) {
      this.restartGame();
    }
  }

  startGame() {
    if (this.gameStarted || this.playerObjects.size === 0) return;
    this.gameStarted = true;
    this.gameOver = false;
    this.waitingText.setVisible(false);
    this.score = 0;
    this.scoreText.setText("Score: 0");
    this.enemySpawnTimer.paused = false;
    this.physics.resume();
    hideStatus();
    showStatus("Game Started!", 2000);
  }

  pauseGame() {
    if (!this.gameStarted || this.gameOver) return;
    this.gameStarted = false;
    this.waitingText
      .setText("Paused - Waiting for players...")
      .setVisible(true);
    this.enemySpawnTimer.paused = true;
    this.physics.pause();
    this.playerObjects.forEach((p) => p.body && p.body.setVelocity(0, 0));
    showStatus("Game Paused - No players.", 0);
  }

  hitEnemy(player, enemy) {
    if (this.gameOver) return;
    const playerNumber = player.getData("playerNumber");
    this.gameOver = true;
    this.physics.pause();
    this.enemySpawnTimer.paused = true;

    // "Tint" by changing fillStyle for rectangles
    this.playerObjects.forEach((p) => {
      if (p === player) {
        p.setFillStyle(0xff0000); // hit player = red
      } else {
        p.setFillStyle(0x888888); // others = gray
      }
      if (p.body) p.body.setVelocity(0, 0);
    });

    this.gameOverText.setVisible(true);
    showStatus("Game Over! Tap controller to restart.", 0);
  }

  restartGame() {
    this.gameOver = false;
    this.physics.resume();
    this.score = 0;
    this.scoreText.setText("Score: 0");

    this.playerObjects.forEach((player, id) => {
      // Restore original color instead of clearTint
      const baseColor = player.getData("baseColor") || 0xffffff;
      player.setFillStyle(baseColor);

      const pNum = player.getData("playerNumber") || 1;
      const offsetX =
        (pNum - (this.playerObjects.size + 1) / 2) *
        (this.playerSize + 10);
      player.setPosition(
        this.cameras.main.width / 2 + offsetX,
        this.cameras.main.height / 2 + 50
      );
      if (player.body) {
        player.body.setVelocity(0, 0);
      }
    });

    this.enemies.clear(true, true);
    this.gameOverText.setVisible(false);
    this.waitingText.setVisible(false);

    if (this.playerObjects.size > 0) {
      this.gameStarted = true;
      this.enemySpawnTimer.paused = false;
      hideStatus();
      showStatus("Game Restarted!", 2000);
    } else {
      this.pauseGame();
    }
  }

  update(time, delta) {
    if (!this.gameStarted || this.gameOver) return;
    this.score += (delta / 100) * this.playerObjects.size;
    this.scoreText.setText("Score: " + Math.floor(this.score));

    this.enemies.children.each((enemy) => {
      if (enemy && enemy.y > this.cameras.main.height + enemy.height / 2) {
        enemy.destroy();
      }
    });
  }

  spawnEnemy() {
    if (this.gameOver || !this.gameStarted) return;
    const x = Phaser.Math.Between(
      20,
      this.cameras.main.width - 20
    );
    const enemy = this.enemies.create(x, -30, null);

    enemy.setSize(30, 30);
    enemy.setDisplaySize(30, 30);

    if (!this.textures.exists("enemyTexture")) {
      const g = this.add.graphics()
        .fillStyle(0xff0000)
        .fillRect(0, 0, 30, 30);
      g.generateTexture("enemyTexture", 30, 30);
      g.destroy();
    }
    enemy.setTexture("enemyTexture");
    enemy.body.setVelocityY(
      150 + this.score / 15 + this.playerObjects.size * 10
    );
    enemy.body.setImmovable(true);
    enemy.body.allowGravity = false;
  }
}
