/**
* InitialMenu Scene: Displays the main menu for the game.
* Uses the proper Phaser lifecycle for data initialization (init) and object creation (create).
*/
class InitialMenu extends Phaser.Scene {
    
    constructor() {
        // IMPORTANT: Use a unique key that matches the scene's name
        super({ key: 'InitialMenu' });
    }
    
    // Initialization. Receives data passed from scene.launch()
    init(data) {
        // Grab the data (dimensions and WorldScene reference) and save them to 'this'
        this.width = data.width;
        this.height = data.height;
        this.worldScene = data.worldScene;
        
        // Get the container element for the HTML menu (corrected ID)
        this.menuContainer = document.getElementById("pauseGame-menu"); 
        
        // Calculate center coordinates as instance properties
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
    }
    
    // Phase 2: Creation. Called automatically by Phaser after init()
    create() {
        // Insert a black rectangle that is semi opaque to simulate the game stop mode.
        // Now uses instance properties (this.centerX, this.centerY)
        this.add.rectangle(this.centerX, this.centerY, this.width*10, this.height*10, 0x000000, 0.6)
        .setDepth(100)
        .setScrollFactor(0); 
        
        this.setInitialMenuHTML();
        
        // Attach listeners immediately after setting HTML
        this.attachButtonListeners();
    }
    
    // Helper to attach listeners (must be called whenever HTML is re-rendered)
    attachButtonListeners() {
        // Set listeners for the buttons.
        this.playBtn = document.getElementById("play-btn");
        this.seeCodeBtn = document.getElementById("seeCode-btn");
        this.controlsBtn = document.getElementById("controls-btn");
        
        // FIX: Pass the function reference using an arrow function
        if (this.playBtn) this.playBtn.addEventListener("click", () => this.askSessionNameAndStart());
        if (this.seeCodeBtn) this.seeCodeBtn.addEventListener("click", () => this.seeCode());
        if (this.controlsBtn) this.controlsBtn.addEventListener("click", () => this.aboutTheGameAndControls());
    }
    
    // Auxiliar create function.
    setInitialMenuHTML() {
        // Use innerHTML on the container
        this.menuContainer.innerHTML =
        (
            // Outer wrapper uses Absolute Positioning and Flexbox for full-screen centering
            ` <!-- Outer Container -->
                <div id="initial-menu" class="initial-menu" >
                    <!-- Inner container for the buttons with styling -->
                    <div id="initial-menu-button-container"
                         class="initial-menu-button-container" >
                        <h1 id="main-title" >DEFEND THE LAB</h1>
                        <button id="play-btn" class="menu-btn" > Play Game </button>
                        <button id="seeCode-btn" class="menu-btn" > See Code </button>
                        <button id="controls-btn" class="menu-btn" > Controls </button>
                    </div>
                </div>
            `
        );
        // Re-attach listeners after rebuilding the HTML
        this.attachButtonListeners();
    }
    
    // Auxiliar create function.
    // It simulates the procedure to start the game.
    askSessionNameAndStart() {
        const self = this;
        
        self.menuContainer.innerHTML =
        (
            `
            <div id="session-name-prompt" class="session-name-prompt">
                <h4 style="color: white;">What is the name of your character?</h4>
        
                <input id="name-input" placeholder="Enter name here..." style="padding: 8px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #ccc;">
                
                <p id="username-wrong-alert" style="color: red; margin-bottom: 10px; display: none;"> 
                    User name must have at least one character that isn't a white space 
                </p>
            
                <div>
                    <button id="cancel-btn" class="menu-btn" >Cancel</button>
                    <button id="submit-btn" class="menu-btn" ">Submit</button>
                </div>
            </div>
            `
        );
        
        // Get references to new DOM elements
        const nameInput = document.getElementById("name-input");
        const cancelButton = document.getElementById("cancel-btn");
        const submitButton = document.getElementById("submit-btn");
        const alertElement = document.getElementById("username-wrong-alert");
        
        // Attach event listeners correctly (passing function references)
        if (submitButton) {
            submitButton.addEventListener('click', () => {
                
                const rawInput = nameInput.value; 
                const newName = rawInput.trim(); 
                
                if (newName.length === 0) {
                    alertElement.style.display = "block";
                } else {
                    // Start the game, passing the user name
                    self.worldScene.set_username(newName);
                    self.goBackToGame();
                }
            });
        }
        
        cancelButton.addEventListener("click", () => self.setInitialMenuHTML());
    }
    
    // Goes to the game.
    goBackToGame() {
        // Clear the menu HTML
        this.menuContainer.innerHTML = "";
        
        // Use the saved worldScene reference to resume it
        if (this.worldScene) {
            this.worldScene.scene.resume(); 
            this.worldScene.createLevelViruses();
        }
        
        this.scene.stop(); // Stop this scene.
    }
    
    // Goes to the github repo of the game.
    seeCode() {
        window.location.href = "https://github.com/LeTanPhuc-01/computer-math";
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
                                                                           background-color: #4ade80;"> Got it! </button>
                </div>
            </div>
            `
        );
        
        // Attach listener for new button.
        this.okayControlsBtn = document.getElementById("okay-controls-btn");
        this.okayControlsBtn.addEventListener("click", () => this.setInitialMenuHTML());
    }  
}
