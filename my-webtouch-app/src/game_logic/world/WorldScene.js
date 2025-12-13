class WorldScene extends Phaser.Scene {

    // Basic map info.
    tileSize = 32;
    tilesWidth = 30;
    tilesHeight = 20;
    mapWidth = this.tileSize * this.tilesWidth;
    mapHeight = this.tileSize * this.tilesHeight;

    // Level attributes.
    level = 1;
    virusSpeed = 40; // Will increase as rounds pass by.
    isGameRunning = false; // Flag to track game state

    // Virus stats attributes.
    // We will have an array to store all of the actually active enemies.
    active_viruses;
    spawnPadding = 64;
    spawnMaxY = 300;
    minVirusDistance = 64;
    minSpawnInterval = 2000;
    waitingForNextRound = false;
    inBetweenRoundTime = 4000;

    // Wall Stat.
    max_health = 5;
    health = 5;
    heartElements = [];

    // Construct a new scene.
    constructor() {
        super('world'); // Set this scene's id within superclass constructor.
    }

    // Open pause menu function.
    openPauseMenu() {
        this.scene.pause();  // First, pause actual scene.

        this.scene.launch('PauseMenu', {
            width: this.sys.game.config.width,
            height: this.sys.game.config.height,
            worldScene: this
        });
    }

    // Preload external game assets.
    preload() {
        // First load map related things.
        this.load.path = "docs/media/";                                 // Establish file path.
        this.load.tilemapTiledJSON("worldMap", "map/worldMap.json");    // Load JSON file.
        this.load.image("whole_map", "map/tiles/whole_map.png");        // Load tile images.

        // Load sounds.
        //this.load.audio('theme_song', 'audio/music/theme_song.mp3');

        // Load map spritesheet.
        this.load.spritesheet("wall_sprite", "wall/wall.png", { frameWidth: 960, frameHeight: 64 });

        // Now virus animations.
        this.load.spritesheet('binary_virus_sprite', 'virus/binaryVirus.png', { frameWidth: 96, frameHeight: 96 });
        this.load.spritesheet('hex_virus_sprite', 'virus/hexVirus.png', { frameWidth: 96, frameHeight: 96 });
        this.load.spritesheet('oct_virus_sprite', 'virus/octVirus.png', { frameWidth: 96, frameHeight: 96 });

    }

    /**
    *  CREATE FUNCTION
    */

    // Create the game data.
    create() {
        this.virusesToSpawn = 0;
        this.spawnTimeouts = [];
        this.nextRoundTimeout = null;
        this.isGameRunning = false;

        this.create_animations();           // We create the animations before anything else.
        this.create_map();                  // Main function that will create the map.
        this.create_buffer();

        //this.create_layout(true);
        this.create_wall();
        this.active_viruses = this.physics.add.group({ runChildUpdate: true });
        this.create_health();

        this.setup_camera();

        this.createInitialMenu();
        this.create_collisions();
        //this.show_collisions();           // Show Collisions.

        //this.createMusic();               // To create and play in a loop main theme music in the background.
    }

    /**
    * 
    *  CREATE FUNCTION AUXILIARY METHODS
    * 
    */

    // Function to encapsulate the creation of the wall.
    create_wall() {

        let startObj = this.map.findObject('wall_layer', obj => {
            return obj.name === "wall";
        });

        this.wall = new Wall(this, startObj.x + 480, startObj.y, "wall_sprite");
        this.physics.world.enable(this.wall);
    }

    // Function to create the buffer to get data from the AI Model.
    create_buffer() {
        this.ocrBuffer = document.getElementById('ocr-data-buffer');
    }

    create_layout(hide) {
        this.heartsMenu = document.getElementById("health-hud");
        this.drawingBoard = document.getElementById("ocr-container");
        if (hide) {
            if (this.heartsMenu) this.heartsMenu.style.display = "none";
            if (this.drawingBoard) this.drawingBoard.style.display = "none";
        } else {
            if (this.heartsMenu) this.heartsMenu.style.display = "flex";
            if (this.drawingBoard) this.drawingBoard.style.display = "block";
        }
    }

    create_collisions() {
        this.physics.add.collider(
            this.active_viruses,
            this.wall,
            (wall, virus) => {

                this.removeVirus(virus);

                this.flashWall(wall);

                this.updateHealthHUD(--this.health);

                if (this.health <= 0) {
                    this.gameOver();
                }
            },
            null,
            this
        );
    }

    create_health() {
        for (let i = 1; i <= this.max_health; i++) {
            const element = document.getElementById(`heart-${i}`);
            if (element) {
                this.heartElements.push(element);
            } else {
                console.error(`Heart element 'heart-${i}' not found in DOM.`);
            }
        }
        // Set initial health
        this.updateHealthHUD(this.health);
    }

    // Function to create and display the initial menu.
    createInitialMenu() {
        this.initialMenu = new InitialMenu();

        if (!this.scene.isActive('InitialMenu')) {

            // Launch the InitialMenu scene.
            this.scene.launch('InitialMenu', {
                width: this.sys.game.config.width,
                height: this.sys.game.config.height,
                worldScene: this
            });

            // Pause the WorldScene so the game logic stops while the menu is open.
            this.scene.pause();
        }

        //this.create_layout(false);    
        this.input.keyboard.on('keydown-ESC', this.openPauseMenu, this); // Pause menu key listener.
    }

    // Auxiliar function to the the user name.
    set_username(username) {
        this.username = username;
        this.conntectionPanel = document.getElementById("connectionPanel");
        this.conntectionPanel.style.display = 'none';
        this.create_layout(false);
        this.isGameRunning = true; // Start the game logic

        if (window.setControllerMode) {
            window.setControllerMode('drawing');
        }
    }

    // Auxiliar function to end the game when wall broken.
    gameOver() {
        // 1. Stop all game activity
        this.isGameRunning = false; // Stop game logic immediately
        this.scene.pause();

        // Clear any pending spawn timeouts
        if (this.spawnTimeouts) {
            this.spawnTimeouts.forEach(id => clearTimeout(id));
            this.spawnTimeouts = [];
        }

        // Clear next round timeout
        if (this.nextRoundTimeout) {
            clearTimeout(this.nextRoundTimeout);
            this.nextRoundTimeout = null;
        }

        // 2. Show connection panel again if needed (or hide it if you prefer a clean menu)
        if (this.conntectionPanel) {
            this.conntectionPanel.style.display = 'block';
        }

        // 3. Reset controller mode
        if (window.setControllerMode) {
            window.setControllerMode('MENU');
        }

        // 4. Reset Game State
        this.health = this.max_health;
        this.level = 1;
        this.virusesToSpawn = 0;
        this.waitingForNextRound = false;
        this.active_viruses.clear(true, true); // Remove all viruses

        // 5. Reset HUD
        this.updateHealthHUD(this.health);
        this.create_layout(true); // Hide HUD

        // 6. Launch Initial Menu again
        // We stop the current scene's logic but keep it alive to be restarted or just re-launch the menu
        this.scene.launch('InitialMenu', {
            width: this.sys.game.config.width,
            height: this.sys.game.config.height,
            worldScene: this
        });
    }

    checkEnemies(digitString, confidence) {

        if (digitString.length > 0) {
            console.log(`RESULTS: ${digitString} (Confidence: ${confidence.toFixed(2)})`);

            let number = parseInt(digitString);

            const targetVirus = this.active_viruses.getChildren().find(virus => virus.value == number);

            if (targetVirus) {
                this.removeVirus(targetVirus);
            }

        } else {
            console.warn("Input received but no digits detected.");
        }
    }

    // Function to update the health heart visuals on the right hand side of the screen.
    updateHealthHUD(currentHealth) {
        // Loop through the maximum number of hearts (5 in this example)
        for (let i = 1; i <= this.max_health; i++) {
            const heartElement = document.getElementById(`heart-${i}`);

            if (heartElement) {
                if (i <= currentHealth) {
                    // If the heart index is less than or equal to current health, show it as FULL
                    heartElement.classList.remove('empty');
                    heartElement.classList.add('full');
                } else {
                    // Otherwise, show it as EMPTY
                    heartElement.classList.remove('full');
                    heartElement.classList.add('empty');
                }
            }
        }
    }

    // Inside WorldScene.js

    flashWall(wall) {
        // 1. Apply a pure white tint (0xFFFFFF) immediately.
        // This makes the entire sprite flash white/bright.
        wall.setTint(0xFFFFFF);

        // 2. Use a Tween to instantly remove the tint and fade the alpha slightly.
        this.tweens.add({
            targets: wall,

            // Duration of the flash effect (e.g., 200ms)
            duration: 200,

            // Properties to tween:
            // Set alpha to a slightly lower value (0.8) to add depth to the hit.
            alpha: 0.8,

            // We use onComplete to remove the tint after the flash cycle finishes.
            onComplete: () => {
                // Remove the tint instantly, returning the wall to its original colors.
                wall.clearTint();
                // Ensure alpha returns to 1 (full visibility).
                wall.alpha = 1;
            },

            // Use a Sine wave ease for a quick snap feeling
            ease: 'Sine.easeOut',

            // We don't need 'yoyo' or 'repeat' since the onComplete handler does the cleanup.
            yoyo: false,
            repeat: 0,

            // This makes the function run with the correct 'this' context if called externally, 
            // though in the collider callback, it's already set correctly.
            callbackScope: this
        });
    }

    createMusic() {
        /*this.bgMusic = this.sound.add('theme_song', { 
        volume: 0.3,
        loop: true
        });
        
        
        this.bgMusic.play(); */
    }

    create_animations() {

        // Player Animation Stats.
        const binaryVirusFrameRate = 3;
        const hexVirusFrameRate = 3;
        const octVirusFrameRate = 3;
        const virusNumFrame = { start: 0, end: 4 };

        this.anims.create({
            key: 'binary_virus_anim',
            frames: this.anims.generateFrameNumbers('binary_virus_sprite', virusNumFrame),
            frameRate: binaryVirusFrameRate,
            repeat: -1
        });

        this.anims.create({
            key: 'hex_virus_anim',
            frames: this.anims.generateFrameNumbers('hex_virus_sprite', virusNumFrame),
            frameRate: hexVirusFrameRate,
            repeat: -1
        });

        this.anims.create({
            key: 'oct_virus_anim',
            frames: this.anims.generateFrameNumbers('oct_virus_sprite', virusNumFrame),
            frameRate: octVirusFrameRate,
            repeat: -1
        });

    }

    // Create map.
    create_map() {

        this.map = this.make.tilemap({ key: "worldMap" });  // Map object from tilemap.

        // Add tileset images into map.
        // 1st Arg: Tileset name from Tiled
        // 2nd Arg: Image key from preload
        this.tileImages = this.map.addTilesetImage("whole_map", "whole_map");
        this.create_layers(this.tileImages);
    }

    // Auxiliar function to create the layers.
    create_layers(tileImages) {
        this.groundLayer = this.map.createLayer("world_scene", tileImages, 0, 0);
    }

    // Function to remove an actual enemy.
    removeVirus(virus) {

        if (this.active_viruses.contains(virus)) {
            virus.endVirus();
            virus = this.active_viruses.remove(virus, true, false);
        }
    }

    // Create enemy functions by zones.
    // Tutorial.
    createLevelViruses() {

        // First, get the amount of viruses to be generated.
        if (this.level <= 3) {
            var numViruses = 3;
        } else {
            var numViruses = 3 + Math.trunc((this.level - 3) / 2);
        }

        this.virusesToSpawn = numViruses;
        this.waitingForNextRound = false;

        for (let i = 0; i < numViruses; ++i) {
            const timeoutId = setTimeout(() => {
                this.spawnVirus();
            }, this.getRandomSpawnTime(i + 1));
            this.spawnTimeouts.push(timeoutId);
        }

        // Restore health.
        if (this.level % 5 == 0) {
            this.updateHealthHUD(++this.health);
        }
    }

    spawnVirus() {
        // Safety check: Do not spawn if game is not running
        if (!this.isGameRunning) return;

        if (this.virusesToSpawn > 0) {
            this.virusesToSpawn--;
        }

        const position = this.findValidSpawnPosition();

        if (position) {
            // Use the static spawn method to get the instance.
            const virus = Virus.createVirus(this, position.x, position.y, this.virusSpeed);
            virus.startMoving();

            // Add it to your tracking array
            this.active_viruses.add(virus);

        } else {
            console.log("Could not find space to spawn virus this frame.");
        }
    }

    findValidSpawnPosition() {
        const maxAttempts = 10; // Try 10 times to find a spot, if didn't do it, maybe already too many viruses.

        for (let i = 0; i < maxAttempts; i++) {
            // Generate Random Coordinates within Safe Zone.
            const randomX = Phaser.Math.Between(
                this.spawnPadding,
                this.mapWidth - this.spawnPadding
            );

            const randomY = Phaser.Math.Between(
                this.spawnPadding,
                this.spawnMaxY
            );

            if (this.isValidPosition(randomX, randomY)) {
                return { x: randomX, y: randomY };
            }
        }

        return null;
    }

    // Function to check if an actual position is valid (viruses don't overlap).
    isValidPosition(x, y) {
        for (const virus of this.active_viruses.getChildren()) {
            const distance = Phaser.Math.Distance.Between(x, y, virus.x, virus.y);

            if (distance < this.minVirusDistance) {
                return false;
            }
        }
        return true;
    }

    // Get a random spawn time to generate a virus.
    getRandomSpawnTime(value) {
        return Math.random() * value * this.minSpawnInterval;
    }

    // Set up the camera to follow the
    setup_camera() {
        // Set the bounds so the camera doesn't scroll past the map edges
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        // Perform the initial resize to set the zoom and position correctly
        // We pass the current scale dimensions to our resize handler
        this.resize({ width: this.scale.width, height: this.scale.height });

        // Attach the event listener for future window resizes.
        this.scale.on('resize', this.resize, this);
    }

    // This function handles the math for fitting the map to the screen
    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;

        // Update viewport to match new window size
        this.cameras.main.setViewport(0, 0, width, height);

        // Calculate Zoom: "Fit Width"
        // This ensures the map always fills the screen width-wise
        const zoom = width / this.mapWidth;
        this.cameras.main.setZoom(zoom);

        // Center the Camera
        const viewHeight = height / zoom;

        this.cameras.main.centerOn(
            this.mapWidth / 2,
            this.mapHeight - (viewHeight / 2)
        );
    }

    // Function to see collisions.
    show_collisions() {
        this.physics.world.createDebugGraphic();
    }

    checkOCRBuffer() {
        // Check if the flag indicating new data is set
        if (this.ocrBuffer && this.ocrBuffer.getAttribute('data-new-input') === 'true') {

            // A. READ THE DATA
            const digitString = this.ocrBuffer.getAttribute('data-digit');
            const confidence = parseFloat(this.ocrBuffer.getAttribute('data-confidence'));

            // B. PROCESS
            if (digitString.length > 0) {
                this.checkEnemies(digitString, confidence);
            }

            // C. RESET THE FLAG (CRITICAL!)
            // Set the flag back to false so we don't process the same input multiple times
            this.ocrBuffer.setAttribute('data-new-input', 'false');
            this.ocrBuffer.setAttribute('data-digit', '');
        }
    }


    /**
    *  UPDATE FUNCTION
    */

    // Update the game data.
    update() {
        if (!this.isGameRunning) return;

        if (!this.waitingForNextRound && this.active_viruses.getLength() == 0 && this.virusesToSpawn === 0) {
            this.waitingForNextRound = true;
            this.nextRoundTimeout = setTimeout(() => {
                ++this.level;
                this.createLevelViruses();
            }, this.inBetweenRoundTime);
        }

        this.checkOCRBuffer();
    }

}
