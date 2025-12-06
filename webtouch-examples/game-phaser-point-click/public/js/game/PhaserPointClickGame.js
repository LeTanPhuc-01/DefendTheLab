// public/js/game/PhaserPointClickGame.js

/* global Phaser */

// Wrapper class used by appMain.js
export class PhaserPointClickGame {
  constructor({
    parentId = "game-container",
    onUiStateChange = () => {},
    onDescriptionChange = () => {},
  } = {}) {
    this.parentId = parentId;
    this.onUiStateChange = onUiStateChange;
    this.onDescriptionChange = onDescriptionChange;

    this.game = null;
    this.scene = null;
    this._sceneReady = false;
    this._pendingCursorDeltas = [];
    this._pendingTaps = [];
  }

  start() {
    if (this.game) {
      this._sceneReady = false;
      this.game.scene.start("AdventureScene", {
        onReady: (scene) => this._onSceneReady(scene),
        onUiStateChange: (state) => this.onUiStateChange(state),
        onDescriptionChange: (text) => this.onDescriptionChange(text),
      });
      return;
    }

    const config = {
      type: Phaser.AUTO,
      scale: {
        mode: Phaser.Scale.FIT,
        parent: this.parentId,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 600,
      },
      physics: {
        default: "arcade",
        arcade: { debug: false },
      },
      scene: [AdventureScene],
    };

    this.game = new Phaser.Game(config);
    this.game.scene.start("AdventureScene", {
      onReady: (scene) => this._onSceneReady(scene),
      onUiStateChange: (state) => this.onUiStateChange(state),
      onDescriptionChange: (text) => this.onDescriptionChange(text),
    });
  }

  pause() {
    if (this.game && this.scene) {
      this.game.scene.pause("AdventureScene");
    }
  }

  _onSceneReady(scene) {
    this.scene = scene;
    this._sceneReady = true;

    this._pendingCursorDeltas.forEach(({ dx, dy }) =>
      this.scene.applyCursorDelta(dx, dy)
    );
    this._pendingCursorDeltas = [];

    this._pendingTaps.forEach(({ actionVerb, selectedItemId }) =>
      this.scene.handleTapFromController(actionVerb, selectedItemId)
    );
    this._pendingTaps = [];
  }

  cursorMove(deltaX, deltaY) {
    if (!this._sceneReady || !this.scene) {
      this._pendingCursorDeltas.push({ dx: deltaX, dy: deltaY });
      return;
    }
    this.scene.applyCursorDelta(deltaX, deltaY);
  }

  tap(controllerId, { actionVerb, selectedItemId }) {
    if (!this._sceneReady || !this.scene) {
      this._pendingTaps.push({ actionVerb, selectedItemId });
      return;
    }
    this.scene.handleTapFromController(actionVerb, selectedItemId);
  }

  controllerCountChanged(count) {
    if (!this._sceneReady || !this.scene) return;
    this.scene.updateControllerStatus(count);
  }

  // Optional: used for custom events
  controllerSelectedItem(controllerId, itemId) {
    if (!this._sceneReady || !this.scene) return;
    this.scene.controllerSelectedItem(itemId);
  }

  controllerRequestedDescription(controllerId, itemId) {
    if (!this._sceneReady || !this.scene) return;
    this.scene.controllerRequestedDescription(itemId);
  }
}

// ---------------------------------------------------------------------------
// AdventureScene
// ---------------------------------------------------------------------------

class AdventureScene extends Phaser.Scene {
  constructor() {
    super({ key: "AdventureScene" });

    // Game state
    this.player = null;
    this.playerSpeed = 180;
    this.targetDestination = null;
    this.isPlayerMoving = false;

    this.virtualCursor = null;
    this.cursorPosition = { x: 400, y: 300 };
    this.isCursorVisible = false;
    this.cursorColor = 0xffffff;

    this.interactionItems = null;

    this.inventory = [];
    this.activeInventoryItem = null;

    this.noControllerText = null;
    this.inventoryDescriptionText = null;
    this.inventoryDescDisplayTimer = null;

    this._internallyHoveredItem = null;

    // Callbacks
    this._onReady = null;
    this._onUiStateChange = null;
    this._onDescriptionChange = null;
  }

  init(data) {
    if (data && typeof data.onReady === "function") {
      this._onReady = data.onReady;
    }
    if (data && typeof data.onUiStateChange === "function") {
      this._onUiStateChange = data.onUiStateChange;
    }
    if (data && typeof data.onDescriptionChange === "function") {
      this._onDescriptionChange = data.onDescriptionChange;
    }
  }

  preload() {}

  create() {
    // Reset state
    this.targetDestination = null;
    this.isPlayerMoving = false;
    this.activeInventoryItem = null;
    this._internallyHoveredItem = null;
    this.inventory = [];
    this.cursorPosition = {
      x: this.cameras.main.centerX,
      y: this.cameras.main.centerY,
    };

    // Background
    this.add
      .rectangle(
        0,
        0,
        this.cameras.main.width,
        this.cameras.main.height,
        0x5c8f4c
      )
      .setOrigin(0);

    // Player
    this.player = this.add.circle(400, 400, 20, 0x0000ff);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    // Virtual cursor
    this.virtualCursor = this.add.graphics();
    this.virtualCursor.setDepth(1000);
    this.virtualCursor.setVisible(this.isCursorVisible);
    this.cursorColor = 0xffffff;
    this.drawCursor();

    // "Waiting for controller..." text
    this.noControllerText = this.add
      .text(
        this.cameras.main.centerX,
        50,
        "",
        {
          fontSize: "20px",
          fill: "#FFF",
          align: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: { x: 10, y: 5 },
        }
      )
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(true);

    // Inventory description line
    this.inventoryDescriptionText = this.add
      .text(
        this.cameras.main.centerX,
        this.cameras.main.height - 30,
        "",
        {
          fontSize: "16px",
          fill: "#ffffff",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          padding: { x: 10, y: 5 },
          align: "center",
          wordWrap: {
            width: this.cameras.main.width - 40,
            useAdvancedWrap: true,
          },
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(900)
      .setVisible(false);

    // Scene items
    this.interactionItems = this.physics.add.group();

    // Door
    const door = this.add
      .rectangle(720, 300, 60, 120, 0x8b4513)
      .setOrigin(0.5)
      .setInteractive();
    door.setDataEnabled();
    door.setData({
      itemId: "wooden_door",
      itemName: "Sturdy Door",
      description: "A solid oak door. It won't budge.",
      availableActions: ["look", "use"],
      isInventoryItem: false,
    });
    this.interactionItems.add(door);

    // Orb
    const orb = this.add
      .circle(100, 500, 25, 0xadd8e6)
      .setOrigin(0.5)
      .setInteractive();
    orb.setDataEnabled();
    orb.setData({
      itemId: "glowing_orb",
      itemName: "Glowing Orb",
      description: "It emits a faint, calming light.",
      availableActions: ["look", "touch", "use"],
      isInventoryItem: false,
    });
    this.interactionItems.add(orb);

    // Key (inventory pickup)
    const key = this.add
      .rectangle(250, 450, 25, 15, 0xaaaaaa)
      .setOrigin(0.5)
      .setInteractive();
    key.setDataEnabled();
    key.setData({
      itemId: "key_01",
      itemName: "Rusty Key",
      description: "An old key, covered in rust.",
      availableActions: ["look", "pickup"],
      isInventoryItem: true,
      emoji: "🔑",
    });
    this.interactionItems.add(key);

    // Coin (inventory pickup)
    const coin = this.add
      .circle(150, 350, 12, 0xffd700)
      .setOrigin(0.5)
      .setInteractive();
    coin.setDataEnabled();
    coin.setData({
      itemId: "coin_01",
      itemName: "Shiny Coin",
      description: "A gold coin. Looks valuable.",
      availableActions: ["look", "pickup"],
      isInventoryItem: true,
      emoji: "🪙",
    });
    this.interactionItems.add(coin);

    // Initial UI push
    this._emitUiState(
      this._computeHoverInfo(),
      this.inventory,
      this.activeInventoryItem
    );

    if (this._onReady) {
      this._onReady(this);
    }
  }

  // --- Adapter methods called by PhaserPointClickGame ---

  applyCursorDelta(deltaX, deltaY) {
    if (!this.virtualCursor) return;
    if (!this.isCursorVisible) {
      this.isCursorVisible = true;
      this.virtualCursor.setVisible(true);
    }

    this.cursorPosition.x += deltaX || 0;
    this.cursorPosition.y += deltaY || 0;

    this.cursorPosition.x = Phaser.Math.Clamp(
      this.cursorPosition.x,
      0,
      this.cameras.main.width
    );
    this.cursorPosition.y = Phaser.Math.Clamp(
      this.cursorPosition.y,
      0,
      this.cameras.main.height
    );

    this.checkCursorHoverAndReport();
  }

  handleTapFromController(actionVerb, selectedItemId) {
    if (!this.isCursorVisible) return;

    // Compute hover metadata and update _internallyHoveredItem
    const hoverInfo = this._computeHoverInfo();
    const targetSceneItem = this._internallyHoveredItem; // actual Phaser GameObject or null

    // --- "use" verb with inventory item selected ---
    if (actionVerb === "use") {
      const invItem = this.inventory.find((i) => i.itemId === selectedItemId);
      if (!invItem) {
        this._emitDescription(`You don't have that item.`);
      } else if (hoverInfo) {
        // _handleUseItemOnObject expects hover metadata (uses hoverInfo.itemId)
        this._handleUseItemOnObject(invItem, hoverInfo);
      } else {
        this._emitDescription("Use it on what?");
      }
    }

    // --- Other verbs (look, touch, open, pickup, talk) ---
    else if (actionVerb) {
      if (targetSceneItem) {
        this._handleItemInteraction(targetSceneItem, actionVerb);
      } else {
        if (actionVerb === "look") {
          this._emitDescription("Just the usual floor.");
        } else {
          this._emitDescription(`You can't ${actionVerb} nothing.`);
        }
      }
    }

    // --- No verb specified: default tap ---
    else {
      if (targetSceneItem) {
        // Default to "look"
        this._handleItemInteraction(targetSceneItem, "look");
      } else {
        // Move player to cursor position
        this.targetDestination = {
          x: this.cursorPosition.x,
          y: this.cursorPosition.y,
        };
        this.isPlayerMoving = true;
        this.physics.moveToObject(
          this.player,
          this.targetDestination,
          this.playerSpeed
        );
        this._emitDescription(""); // clear any prior text
      }
    }

    // Recompute hover + UI state and push down to controllers
    const newHover = this._computeHoverInfo();
    this._emitUiState(newHover, this.inventory, this.activeInventoryItem);
  }

  updateControllerStatus(count) {
    const hasControllers = count > 0;
    if (this.noControllerText) {
      this.noControllerText.setVisible(!hasControllers);
      this.noControllerText.setText(
        hasControllers ? "" : "Waiting for controller..."
      );
    }
    if (!hasControllers && this.isCursorVisible) {
      this.isCursorVisible = false;
      this.virtualCursor?.setVisible(false);
      this._internallyHoveredItem = null;
      this._emitUiState(null, this.inventory, this.activeInventoryItem);
    }
  }

  controllerSelectedItem(itemId) {
    this.activeInventoryItem = itemId || null;
    this._emitUiState(
      this._computeHoverInfo(),
      this.inventory,
      this.activeInventoryItem
    );
  }

  controllerRequestedDescription(itemId) {
    const item = this.inventory.find((i) => i.itemId === itemId);
    const description =
      (item && item.description) || "You see nothing special about it.";
    this._emitDescription(description);
  }

  // --- Hover / inventory / description helpers ---

  _computeHoverInfo() {
    if (!this.isCursorVisible) return null;

    const pointer = {
      x: this.cursorPosition.x,
      y: this.cursorPosition.y,
    };
    const hits = this.input.hitTestPointer(pointer);
    for (const obj of hits) {
      if (this.interactionItems.contains(obj)) {
        const data = obj.data?.values;
        if (data && data.itemId) {
          this._internallyHoveredItem = obj;
          this.cursorColor = 0xff0000;
          return {
            itemId: data.itemId,
            itemName: data.itemName || data.itemId,
            availableActions: data.availableActions || [],
          };
        }
      }
    }

    this._internallyHoveredItem = null;
    this.cursorColor = 0xffffff;
    return null;
  }

  _emitUiState(hoverInfo, inventory, activeInventoryItem) {
    if (this._onUiStateChange) {
      this._onUiStateChange({
        hoverInfo: hoverInfo || null,
        inventory: inventory || [],
        activeInventoryItem: activeInventoryItem || null,
      });
    }
  }

  _emitDescription(text) {
    if (this._onDescriptionChange) {
      this._onDescriptionChange(text || "");
    }
    // Also show in-scene UI
    if (this.inventoryDescriptionText) {
      const visible = !!text;
      this.inventoryDescriptionText.setText(text || "");
      this.inventoryDescriptionText.setVisible(visible);
    }
  }

  _handleItemInteraction(itemObj, action) {
    const data = itemObj.data?.values || {};
    const itemId = data.itemId;
    const itemName = data.itemName || itemId;

    switch (action) {
      case "look":
        this._emitDescription(
          data.description || `You see the ${itemName}.`
        );
        break;
      case "pickup":
        if (data.isInventoryItem) {
          this._pickupItem(itemObj);
        } else {
          this._emitDescription(`You can't pick up the ${itemName}.`);
        }
        break;
      case "talk":
        this._emitDescription(
          `You try talking to the ${itemName}. No response.`
        );
        break;
      case "touch":
        if (itemId === "glowing_orb") {
          this._emitDescription("The orb pulses!");
          this.tweens.add({
            targets: itemObj,
            scale: { from: 1, to: 1.2 },
            duration: 150,
            yoyo: true,
          });
        } else {
          this._emitDescription(`You touch the ${itemName}.`);
        }
        break;
      case "open":
        if (itemId === "wooden_door") {
          this._emitDescription("The door creaks open.");
          itemObj.setVisible(false);
          data.availableActions = ["look"];
        } else {
          this._emitDescription(`You can't open that.`);
        }
        break;
      default:
        this._emitDescription(
          `Action '${action}' on ${itemName} not implemented.`
        );
        break;
    }
  }

  _handleUseItemOnObject(invItem, hovered) {
    const invId = invItem.itemId;
    const sceneItem = this._findItemById(hovered.itemId);
    if (!sceneItem) {
      this._emitDescription("That doesn't seem to be here anymore.");
      return;
    }

    const sceneId = sceneItem.getData("itemId");
    const sceneName = sceneItem.getData("itemName") || sceneId;

    if (invId === "key_01" && sceneId === "wooden_door") {
      this._emitDescription("Click! The rusty key unlocks the door!");
      this._removeItemFromInventory(invId);
      sceneItem.setData("description", "The door is now unlocked.");
      sceneItem.setData("availableActions", ["look", "open"]);
    } else if (invId === "coin_01" && sceneId === "glowing_orb") {
      this._emitDescription("The coin dissolves into the orb's light!");
      this._removeItemFromInventory(invId);
      sceneItem.setFillStyle(0xffffff);
      this.time.delayedCall(200, () => {
        sceneItem.setFillStyle(0xadd8e6);
      });
    } else {
      this._emitDescription(
        `Using the ${invItem.name} on the ${sceneName} doesn't seem right.`
      );
    }
  }

  _pickupItem(itemObject) {
    const data = itemObject.data?.values || {};
    if (!data.itemId || !data.isInventoryItem) return;

    const itemData = {
      itemId: data.itemId,
      name: data.itemName || data.itemId,
      emoji: data.emoji || "❓",
      description: data.description || "An item.",
    };

    if (!this.inventory.some((i) => i.itemId === itemData.itemId)) {
      this.inventory.push(itemData);
      this._emitDescription(`Picked up ${itemData.name}.`);
    }

    itemObject.destroy();
    this._internallyHoveredItem = null;
    this._emitUiState(
      this._computeHoverInfo(),
      this.inventory,
      this.activeInventoryItem
    );
  }

  _removeItemFromInventory(itemId) {
    const before = this.inventory.length;
    this.inventory = this.inventory.filter((i) => i.itemId !== itemId);
    if (this.activeInventoryItem === itemId) {
      this.activeInventoryItem = null;
    }
    if (this.inventory.length !== before) {
      this._emitUiState(
        this._computeHoverInfo(),
        this.inventory,
        this.activeInventoryItem
      );
    }
  }

  _findItemById(itemId) {
    return this.interactionItems
      .getChildren()
      .find((obj) => obj.getData("itemId") === itemId);
  }

  // --- drawing and update ---

  drawCursor() {
    if (!this.virtualCursor) return;
    this.virtualCursor.clear();
    this.virtualCursor.fillStyle(this.cursorColor, 1);
    this.virtualCursor.fillCircle(
      this.cursorPosition.x,
      this.cursorPosition.y,
      6
    );
  }

  checkCursorHoverAndReport(forceClear = false) {
    let hoverInfo = null;

    if (forceClear) {
      this._internallyHoveredItem = null;
      this.cursorColor = 0xffffff;
    } else {
      hoverInfo = this._computeHoverInfo();
    }

    this._emitUiState(hoverInfo, this.inventory, this.activeInventoryItem);
  }

  update(time, delta) {
    if (this.isPlayerMoving && this.targetDestination) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.targetDestination.x,
        this.targetDestination.y
      );
      if (dist < 5) {
        this.player.body.setVelocity(0);
        this.targetDestination = null;
        this.isPlayerMoving = false;
      }
    }

    if (this.virtualCursor?.visible) {
      this.drawCursor();
    }
  }
}
