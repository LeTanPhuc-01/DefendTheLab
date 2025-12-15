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

        // Switch controller to MENU mode for navigation
        if (window.setControllerMode) {
            window.setControllerMode('MENU');
        }
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
                        <button id="leaderboard-btn" class="menu-btn" > Leaderboard </button>
                        <button id="controls-btn" class="menu-btn" > Controls </button>
                        <button id="quit-btn" class="menu-btn" style="background-color: #ef4444;"> Quit Game </button>
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
        this.leaderboardBtn = document.getElementById("leaderboard-btn");
        this.controlsBtn = document.getElementById("controls-btn");
        this.quitBtn = document.getElementById("quit-btn");

        // Listeners.
        if (this.resumeBtn) this.resumeBtn.addEventListener("click", () => this.goBackToGame());
        if (this.leaderboardBtn) this.leaderboardBtn.addEventListener("click", () => this.showLeaderboard());
        if (this.controlsBtn) this.controlsBtn.addEventListener("click", () => this.aboutTheGameAndControls());
        if (this.quitBtn) this.quitBtn.addEventListener("click", () => this.quitGame());
    }    // Goes back to the game.
    goBackToGame() {
        this.menuContainer.innerHTML = "";
        this.worldScene.scene.resume();
        this.scene.stop();

        // Switch controller back to GAME mode
        if (window.setControllerMode) {
            window.setControllerMode('GAME');
        }
    }

    aboutTheGameAndControls() {
        this.menuContainer.innerHTML = MenuHelpers.getControlsHTML();

        // Attach listener for new button.
        this.okayControlsBtn = document.getElementById("okay-controls-btn");
        this.okayControlsBtn.addEventListener("click", () => this.setPauseMenuHTML());
    }

    // Quit the game and return to main menu
    quitGame() {
        this.menuContainer.innerHTML = "";
        this.scene.stop();

        // Call gameOver on WorldScene to reset state and go back to InitialMenu
        // Pass false to prevent score submission
        if (this.worldScene) {
            this.worldScene.gameOver(false);
        }
    }

    async showLeaderboard() {
        this.menuContainer.innerHTML = MenuHelpers.getLeaderboardHTML();

        document.getElementById("back-btn").addEventListener("click", () => this.setPauseMenuHTML());

        await MenuHelpers.fetchAndRenderLeaderboard("leaderboard-list");
    }
}