class WorldScene extends Phaser.Scene {
    
    // Basic map info.
    tileSize = 32;
    tilesWidth = 30;
    tilesHeight = 20;
    mapWidth = this.tileSize*this.tilesWidth;
    mapHeight = this.tileSize*this.tilesHeight;
    
    // Level attributes.
    level = 1;
    virusSpeed = 15; // Will increase as rounds pass by.
    
    // Virus stats attributes.
    // We will have an array to store all of the actually active enemies.
    active_viruses = [];
    spawnPadding = 64;
    spawnMaxY = 300;
    minVirusDistance = 64;
    minSpawnInterval = 2000;
    waitingForNextRound = false;
    inBetweenRoundTime = 4000;
    
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
    preload()  {
        // First load map related things.
        this.load.path = "docs/media/";                                 // Establish file path.
        this.load.tilemapTiledJSON("worldMap", "map/worldMap.json");    // Load JSON file.
        this.load.image("whole_map", "map/tiles/whole_map.png");        // Load tile images.
        
        // Load sounds.
        //this.load.audio('theme_song', 'audio/music/theme_song.mp3');
        
        // Load map spritesheet.
        this.load.spritesheet("wall_sprite", "wall/wall.png", { frameWidth: 960, frameHeight: 64 })

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
        
        this.create_animations();           // We create the animations before anything else.
        this.create_map();                  // Main function that will create the map.
        
        this.create_wall();
        
        this.setup_camera();
        
        this.createInitialMenu();
        //this.show_collisions();           // Show Collisions.
        
        //this.createMusic();                 // To create and play in a loop main theme music in the background.
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

        this.wall = new Wall(this, startObj.x+480, startObj.y, "wall_sprite");
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
        
        this.input.keyboard.on('keydown-ESC', this.openPauseMenu, this); // Pause menu key listener.
    }
    
    // Auxiliar function to the the user name.
    set_username(username) {
        this.username = username;
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
        this.tileImages = this.map.addTilesetImage( "whole_map", "whole_map" );
        this.create_layers(this.tileImages);
    }
    
    // Auxiliar function to create the layers.
    create_layers(tileImages) {
        this.groundLayer = this.map.createLayer("world_scene", tileImages, 0, 0);
    }
    
    // Function to remove an actual enemy.
    removeVirus(virus) {
        const index = this.active_viruses.findIndex(e => e === virus);
        
        if(index != -1) {
            this.active_viruses.splice(index, 1);
            virus.endVirus();
        }
    }
    
    // Create enemy functions by zones.
    // Tutorial.
    createLevelViruses() {
        
        // First, get the amount of viruses to be generated.
        if(this.level <= 3) {
            var numViruses = 3;
        } else {
            var numViruses = 3 + truncate((this.level-3)/2);
        }
        
        for(let i = 0; i < numViruses; ++i) {
            setTimeout(() => {
                this.spawnVirus();
            }, this.getRandomSpawnTime(i+1));
        }
        
        // Setup collisions
        if (this.active_viruses.length > 0) {
            this.physics.add.collider(this.wall, this.active_viruses);
        }
    }
    
    spawnVirus() {
        const position = this.findValidSpawnPosition();
        
        if (position) {
            // Use the static spawn method to get the instance.
            const virus = Virus.createVirus(this, position.x, position.y, this.virusSpeed);
            
            // Add it to your tracking array
            this.active_viruses.push(virus);
            
            // Optional: Add collision with the wall if you have one
            if (this.wall) {
                this.physics.add.collider(virus, this.wall);
            }
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
        // Iterate through all active viruses.
        for (const virus of this.active_viruses) {
            // Calculate distance between candidate point and existing virus.
            const distance = Phaser.Math.Distance.Between(x, y, virus.x, virus.y);
            
            // If too close, this position is invalid.
            if (distance < this.minVirusDistance) {
                return false;
            }
        }
        return true;
    }
    
    // Get a random spawn time to generate a virus.
    getRandomSpawnTime(value) {
        return Math.random()*value*this.minSpawnInterval;
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
    
    
    /**
    *  UPDATE FUNCTION
    */
    
    // Update the game data.
    update() {
        // We check if all the viruses of the actual level dissapeared.
        // In that case, we just wait a little bit and start a new game.
        if(!this.waitingForNextRound && this.active_viruses.length == 0) {
            this.waitingForNextRound = true;
            setTimeout(() => {
                ++this.level;
                this.createLevelViruses;
            }, this.inBetweenRoundTime);
        } 
    }
    
}
