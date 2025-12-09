// First, we establish the game configurations.
var config =
{
    type: Phaser.CANVAS,    // HTML Rendering API.
    width: 32 * 30,
    height: 32 * 20,
    pixelArt: true,         // This optimizes the game for pixel art.

    parent: "game-container", // To give an id to the container of the game screen.

    scene:      // Game Scenes.
    [
        WorldScene,
        InitialMenu,
        PauseMenu
    ],

    // In order to center the map in the browser.
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
    },
    
    
    physics: { default:'arcade', arcade:{gravity:0} } // Physics for collisions only, no gravity.
};

// Finally, we create the game using the previous configurations.
var game = new Phaser.Game(config);