class PauseMenu extends Phaser.Scene {
    
    // Class to model the pause scene.
    constructor() {
        super({ key: 'PauseMenu' });
    }
    
    // Initialization. 
    init(data) {
        this.width = data.width;
        this.height = data.height;
        this.worldScene = data.worldScene; 
        this.menuContainer = document.getElementById("pauseGame-menu");
    }
    
    create() {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // Adds the semi-transparent background
        this.add.rectangle(centerX, centerY, this.width, this.height, 0x000000, 0.6)
        .setDepth(100)
        .setScrollFactor(0);
        
        // Renders the HTML menu
        this.setPauseMenuHTML();
    }
    
    // Auxiliar create function.
    setPauseMenuHTML() {
        // --- CHANGED ---
        // This HTML is now identical to your InitialMenu's structure,
        // but with a new title and the Pause Menu buttons.
        this.menuContainer.innerHTML =
        (
            `
                <div id="initial-menu" class="pause-menu" > 
                    <!-- Inner container (Same as InitialMenu) -->
                    <div id="initial-menu-button-container"
                         class="initial-menu-button-container" >
                        
                        <h1 id="main-title" >GAME PAUSED</h1>
            
                        <p id="saveText" style="color: green; 
                                                margin-bottom: 10px; 
                                                display: none;
                                                font-size: 1rem;
                                                font-weight: bold;
                                                max-width: 100%;
                                                word-wrap: break-word;
                                                line-height: 1.4;
                                                margin-top: -1.2rem">  
                        </p>
            
                        <!-- Pause Menu Buttons -->
                        <button id="resume-btn" class="menu-btn" > Resume Game </button>
                        <button id="controls-btn" class="menu-btn" > Controls </button>
                        <button id="saveOnline-btn" class="menu-btn" > Save Online </button>
                        <button id="saveOffline-btn" class="menu-btn" > Save Offline </button>
                    </div>
                </div>
            `
        );
        
        // Re-attach listeners after the HTML is rebuilt
        this.attachButtonListeners();
        // We add the listener for the 'ESC' key here, specific to the pause menu
        this.input.keyboard.on('keydown-ESC', this.goBackToGame, this); // Pause menu key listener.
    }
    
    // Helper function to create the button listeners.
    attachButtonListeners() {
        // Set listeners for the buttons.
        this.resumeBtn = document.getElementById("resume-btn"); 
        this.controlsBtn = document.getElementById("controls-btn");
        this.saveOfflineBtn = document.getElementById("saveOffline-btn");
        this.saveOnlineBtn = document.getElementById("saveOnline-btn"); 
        
        // Listeners.
        if (this.resumeBtn) this.resumeBtn.addEventListener("click", () => this.goBackToGame()); 
        if (this.controlsBtn) this.controlsBtn.addEventListener("click", () => this.aboutTheGameAndControls());
        if (this.saveOnlineBtn) this.saveOnlineBtn.addEventListener("click", () => this.saveOnline());
        if (this.saveOfflineBtn) this.saveOfflineBtn.addEventListener("click", () => this.saveOffline());
    }
    
    // Goes back to the game.
    goBackToGame() {
        this.menuContainer.innerHTML = "";
        this.worldScene.scene.resume(); 
        this.scene.stop(); 
    }
    
    aboutTheGameAndControls() {
        this.menuContainer.innerHTML =
        (
            `
            <div id="controls-menu" class="controls-menu" > 
                <div id="controls-menu-container"
                     class="controls-menu-container" >
                        
                    <h1 style="color: white;
                               text-align: center;"> Lime World </h1>
                    <h2 style="color: #ccc; font-size: 1.2em; text-align: center;"> A game with a lot of limes!</h2>
                    <p style="color: white; margin-top: 15px;"> In Lime World you will have to explore a world populated by lime monsters, and use their curative properties. <p>
                    <h2 style="color: #4ade80; margin-top: 0.8rem; text-align: center; "> Controls </h2>
                    <p style="color: white;"> Press the Escape/Esc key to open the Resume Menu </p>
                    <div style="font-family: monospace; padding: 10px; background: #2d3748; border-radius: 4px; line-height: 1.5; color: #fff;">
                        W &rarr; Go Up<br>
                        A &rarr; Go Left<br>
                        S &rarr; Go Down<br>
                        D &rarr; Go Right<br>
                        Attack &rarr; Left Click
                    </div>
                    <button id="okay-controls-btn" class="menu-btn" style="margin-top: 1.5rem;
                                                                           background-color: #4ade80;
                                                                           align-text: center;"> Got it! </button>
                </div>
            </div>
            `
        );
        
        // Attach listener for new button.
        this.okayControlsBtn = document.getElementById("okay-controls-btn");
        this.okayControlsBtn.addEventListener("click", () => this.setPauseMenuHTML());
    }
    
    // Save game to jsonBin (online) storage.
    saveOnline() {
        // Display save text.
        saveText = document.getElementById("saveText");
        saveText.innerHTML = "Game Saved in Online Storage Succesfully!";
        saveText.style.display = "block";
        
        this.worldScene.saveOnline();
    }
    
    // Save game in local storage.
    saveOffline() {
        // Display save text.
        saveText = document.getElementById("saveText");
        saveText.innerHTML = "Game Saved in Local Storage Succesfully!";
        saveText.style.display = "block";
        
        this.worldScene.saveOffline();
    }
}