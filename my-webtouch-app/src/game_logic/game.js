// src/game_logic/game.js

var config = {
    type: Phaser.CANVAS,
    // Use the parent's size 100%
    width: window.innerWidth, 
    height: window.innerHeight,
    pixelArt: true,
    parent: "game-container", 
    
    // Scale Manager: fit the container
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    
    physics: { 
        default: 'arcade', 
        arcade: { gravity: { y: 0 } } 
    },
    
    scene: [
        WorldScene,
        InitialMenu,
        PauseMenu
    ]
};

// FIX: Assign to window so app.html can access it
window.game = new Phaser.Game(config);
