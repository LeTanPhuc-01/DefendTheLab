class Virus extends Phaser.Physics.Arcade.Sprite {

    // Function to control not receive multiple hits from just once.
    damageReceivedRecently = false;
    // To handle only dealing damage once per attack.
    canAttack = true;

    // Simulating an enumerate type for virus types in js.
    static virusType = Object.freeze({
        BIN: "BIN",
        HEX: "HEX",
        OCT: "OCT"
    })

    // This constructor receives 12 arguments.
    constructor(scene, positionX, positionY, spriteSheet, animKey, id, type, depth, speed) {
        super(scene, positionX, positionY, spriteSheet);

        // Save parameters.
        this.animKey = animKey;
        this.id = id;
        this.type = type;
        this.depth = depth;
        this.speed = speed;
        // Check if wall exists before assigning
        if (scene.wall) {
            this.wall = scene.wall;
        }
        this.scene = scene;

        // Add the monster to the scene and enable physics.
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        
        // Generate a random number for the virus
        this.value = Phaser.Math.Between(1, 256);
        let labelText = "";
        
        if (this.type === Virus.virusType.BIN) {
            labelText = this.value.toString(2).padStart(4, '0'); // Binary
        } else if (this.type === Virus.virusType.HEX) {
            labelText = "0x" + this.value.toString(16).toUpperCase(); // Hex
        } else {
            labelText = "0o" + this.value.toString(8); // Octal
        }

        this.label = this.scene.add.text(this.x, this.y, labelText, {
            fontFamily: '"Press Start 2P"',
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        });
        this.label.setOrigin(0.5, 0.5);
        this.label.setDepth(this.depth + 1);
        
        // Start moving immediately upon creation.
        this.startMoving();
    }

    static createVirus(scene, x, y, speed) {

        const id = 'virus_' + Date.now() + Math.random(); 

        let typeNumber = Math.random();
        let type;
        let spriteSheet;
        let animKey;

        if(typeNumber <= 0.33) {
            type = Virus.virusType.BIN;
            spriteSheet = "binary_virus_sprite";
            animKey = "binary_virus_anim";
        } else if(typeNumber <= 0.66) {
            type = Virus.virusType.HEX;
            spriteSheet = "hex_virus_sprite";
            animKey = "hex_virus_anim";
        } else {
            type = Virus.virusType.OCT;
            spriteSheet = "oct_virus_sprite";
            animKey = "oct_virus_anim";
        }

        const depth = 5; // Higher depth to be above ground

        const virus = new Virus(
            scene, 
            x, 
            y, 
            spriteSheet,
            animKey,
            id, 
            type, 
            depth, 
            speed
        );

        return virus;
    }

    startMoving() {
        if (this.body) {
            this.body.setVelocity(0, this.speed);
        }
    }

    // preUpdate is preferred for syncing attached objects like the label
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        this.anims.play(this.animKey, true);
        
        // Sync label position
        if (this.label) {
            this.label.x = this.x;
            this.label.y = this.y;
        }

        // Cleanup if it falls off the bottom of the world
        if (this.y > this.scene.physics.world.bounds.height + 100) {
            this.destroy();
        }
    }

    // update function to make speed incrementally bigger.
    update() {
        this.speed += this.speed*0.01;
        this.body.setVelocity(0, this.speed);
    }
    
    // Stops the enemy's movement.
    stopMovement() {
        if(this.body) {
            this.body.setVelocity(0, 0);
        }
    }

    // Function to end the enemy.
    endVirus() {
        // Destroy label first
        if (this.label) {
            this.label.destroy();
        }
        this.destroy();
    }
}