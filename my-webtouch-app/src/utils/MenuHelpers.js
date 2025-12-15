// src/utils/MenuHelpers.js

const MenuHelpers = {
    getControlsHTML: function () {
        return `
            <div id="controls-menu" class="controls-menu">
                <div id="controls-menu-container" class="controls-menu-container">
                        
                    <h1 style="color: white; text-align: center;"> 🧪 Defend the Lab </h1>
                    <h2 style="color: #ccc; font-size: 1.2em; text-align: center;">
                        Decode viruses before they breach the firewall!
                    </h2>
                        
                    <p style="color: white; margin-top: 15px;">
                        In Defend the Lab, waves of corrupted data viruses attempt to infiltrate
                        your firewall. Each virus is encoded in a different number system - decode
                        them into Decimal before they compromise the lab!
                    </p>
                        
                    <h2 style="color: #4ade80; margin-top: 0.8rem; text-align: center;">
                        Virus Types
                    </h2>
                        
                    <div style="font-family: monospace; padding: 10px; background: #2d3748; border-radius: 4px; line-height: 1.5; color: #fff;">
                        Green Virus &rarr; Hexadecimal (Base 16) <br>
                        Yellow Virus &rarr; Binary (Base 2) <br>
                        Orange Virus &rarr; Octal (Base 8)
                    </div>
                        
                    <h2 style="color: #4ade80; margin-top: 0.8rem; text-align: center;">
                        Objective
                    </h2>
                        
                    <p style="color: white;">
                        Convert the virus's N-Base value into a correct Decimal number.
                        Draw the Decimal answer to neutralize the virus and protect the firewall.
                    </p>

                    <h2 style="color: #4ade80; margin-top: 0.8rem; text-align: center;">
                        Mechanics
                    </h2>
                        
                    <div style="font-family: monospace; padding: 10px; background: #2d3748; border-radius: 4px; line-height: 1.5; color: #fff;">
                        Every 3 Levels &rarr; Virus speed increases <br>
                        Every 5 Levels &rarr; Recover 1 Life ❤️
                    </div>
                        
                    <h2 style="color: #4ade80; margin-top: 0.8rem; text-align: center;">
                        Controls
                    </h2>
                        
                    <div style="font-family: monospace; padding: 10px; background: #2d3748; border-radius: 4px; line-height: 1.5; color: #fff;">
                        Canvas &rarr; Draw your numeric answer <br>
                    </div>
                        
                    <button id="okay-controls-btn" class="menu-btn"
                        style="margin-top: 1.5rem; background-color: #4ade80;">
                        Got it!
                    </button>
                </div>
            </div>
        `;
    },

    getLeaderboardHTML: function () {
        return `
            <div id="leaderboard-menu" class="controls-menu">
                <div class="controls-menu-container" style="max-width: 600px;">
                    <h1 style="color: white; text-align: center; margin-bottom: 20px;">Leaderboard</h1>
                    <div id="leaderboard-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;">
                        <p style="color: white; text-align: center;">Loading...</p>
                    </div>
                    <button id="back-btn" class="menu-btn">Back</button>
                </div>
            </div>
        `;
    },

    fetchAndRenderLeaderboard: async function (listContainerId) {
        try {
            const response = await fetch('/api/leaderboard');
            const data = await response.json();

            const listContainer = document.getElementById(listContainerId);
            if (!listContainer) return;

            if (data.length === 0) {
                listContainer.innerHTML = '<p style="color: #ccc; text-align: center;">No scores yet!</p>';
                return;
            }

            let html = '<table style="width: 100%; color: white; border-collapse: collapse;">';
            html += '<tr style="border-bottom: 1px solid #4ade80; text-align: left;"><th>Rank</th><th>Name</th><th style="text-align: right;">Score</th></tr>';

            data.forEach(player => {
                html += `
                    <tr style="border-bottom: 1px solid #333;">
                        <td style="padding: 8px;">#${player.rank}</td>
                        <td style="padding: 8px;">${player.name}</td>
                        <td style="padding: 8px; text-align: right; color: #4ade80;">${player.score}</td>
                    </tr>
                `;
            });
            html += '</table>';

            listContainer.innerHTML = html;

        } catch (error) {
            console.error("Failed to fetch leaderboard:", error);
            const listContainer = document.getElementById(listContainerId);
            if (listContainer) listContainer.innerHTML = '<p style="color: red; text-align: center;">Failed to load leaderboard.</p>';
        }
    }
};
