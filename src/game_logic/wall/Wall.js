class Wall extends Phaser.Physics.Arcade.Sprite
{
    // Important variables for data manipulation
    INITIAL_MAX_HEALTH = 5;
    CORRECT_HEALING_RATIO = 10;
    actualMaxHealth = this.INITIAL_MAX_HEALTH;

    // Stats.
    health = this.INITIAL_MAX_HEALTH;
    sizeX = 960;
    sizeY = 64;
    
    constructor(scene, positionX, positionY, spriteSheet)
    {
        // Call super constructor with the player image stated at preload.
        super(scene, positionX, positionY, spriteSheet);
        
        // Set layer depth.
        this.depth = 1;
        
        // Important, add player to the scene.
        scene.add.existing(this);
        
        // Add physics.
        scene.physics.add.existing(this).setImmovable(true);
        
        // Let's implement custom size physics.
        this.body.setSize(this.sizeX, this.sizeY);
    }
    
    // Receive Damage Function.
    receiveDamage(quantity) {
        if(this.health - quantity < 0) {
            this.health = 0
        } else {
            this.health -= quantity;
        }
    }

    // Heal Function.
    heal(quantity) {
        if(this.health + quantity > this.actualMaxHealth) {
            this.health = this.actualMaxHealth;
        } else {
            this.health += quantity;
        }
    }
}