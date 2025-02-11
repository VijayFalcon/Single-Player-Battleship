const shipLengths = { carrier: 5, battleship: 4, cruiser: 3, submarine: 3, destroyer: 2 };
let playerBoard = [];
let computerBoard = [];
let placingShips = true;
let selectedShip = null;
let shipCount = 0;
let placedShips = {};
let horizontal = true;
let playerTurn = true;
let isListening = false;
let voiceCommandActive = false;

function updateVoiceStatus(status) {
    const statusElement = document.getElementById('voiceStatus');
    statusElement.innerText = status;
    statusElement.style.display = 'block';
}

function updateRecognizedText(text) {
    const recognizedTextElement = document.getElementById('recognizedText');
    recognizedTextElement.innerText = `Recognized: ${text}`;
    recognizedTextElement.style.display = 'block';
}


function createBoard(boardId) {
    const board = document.getElementById(boardId);
    for (let i = 0; i < 10; i++) {
        const row = document.createElement("tr");
        for (let j = 0; j < 10; j++) {
            const cell = document.createElement("td");
            cell.dataset.row = i;
            cell.dataset.col = j;
            cell.classList.add("grid-cell");
            cell.addEventListener("click", () => handleClick(boardId, i, j));
            row.appendChild(cell);
        }
        board.appendChild(row);
    }
}

function handleClick(boardId, row, col) {
    if (placingShips && boardId === "playerBoard") {
        placeShip(row, col);
    } else if (!placingShips && boardId === "computerBoard" && playerTurn) {
        attack(row, col);
    }
}


function placeShip(row, col) {
    if (!selectedShip || placedShips[selectedShip]) return;

    const shipSize = shipLengths[selectedShip];
    const positions = [];

    for (let i = 0; i < shipSize; i++) {
        const newRow = horizontal ? row : row + i;
        const newCol = horizontal ? col + i : col;
        if (newRow >= 10 || newCol >= 10) return; // Don't place if out of bounds
        positions.push({row: newRow, col: newCol}); // Store as {row, col} objects
    }

    // Correct Overlap Check (using a helper function):
    if (positions.some(pos => isPositionOccupied(pos.row, pos.col))) { // Pass row and col
        return; // Don't place if it overlaps
    }

    positions.forEach(({row, col}) => {
        const cell = document.querySelector(`#playerBoard td[data-row="${row}"][data-col="${col}"]`);
        cell.classList.add("ship");
    });

    placedShips[selectedShip] = positions;
    playerBoard.push(...positions); // push the {row, col} objects

    shipCount++;
    if (shipCount === 5) {
        document.getElementById("finishPlacement").disabled = false;
    }
}

// Helper function to check if a position is occupied:
function isPositionOccupied(row, col) { // Expect row and col as arguments
    for (const occupiedPos of playerBoard) {
        if (occupiedPos.row === row && occupiedPos.col === col) {
            return true;
        }
    }
    return false;
}

function getRandomPosition() {
    return Math.floor(Math.random() * 10);
}

function placeComputerShips() {
    Object.keys(shipLengths).forEach(ship => {
        let placed = false;
        while (!placed) {
            const isHorizontal = Math.random() < 0.5;
            const row = getRandomPosition();
            const col = getRandomPosition();
            const positions = [];

            for (let i = 0; i < shipLengths[ship]; i++) {
                const newRow = isHorizontal ? row : row + i;
                const newCol = isHorizontal ? col + i : col;
                if (newRow >= 10 || newCol >= 10) break;
                positions.push({ row: newRow, col: newCol });
            }

            if (positions.length === shipLengths[ship] && positions.every(pos => !computerBoard.some(p => p.row === pos.row && p.col === pos.col))) {
                computerBoard.push(...positions);
                placed = true;
            }
        }
    });
}

function attack(row, col) {
    const cell = document.querySelector(`#computerBoard td[data-row="${row}"][data-col="${col}"]`);
    if (cell.classList.contains("hit") || cell.classList.contains("miss")) return;

    const hit = computerBoard.some(pos => pos.row === row && pos.col === col);
    cell.classList.add(hit ? "hit" : "miss");

    if (hit) {
        computerBoard = computerBoard.filter(pos => pos.row !== row || pos.col !== col);
        if (computerBoard.length === 0) {
            document.getElementById("message").innerText = "You win!";
            return;
        }
    }

    playerTurn = false;
    setTimeout(computerAttack, 1000);
}

function computerAttack() {
    const row = getRandomPosition();
    const col = getRandomPosition();
    const cell = document.querySelector(`#playerBoard td[data-row="${row}"][data-col="${col}"]`);

    if (cell.classList.contains("hit") || cell.classList.contains("miss")) {
        computerAttack();
        return;
    }

    const hit = playerBoard.some(pos => pos.row === row && pos.col === col);
    if (hit) {
        cell.classList.remove("ship");
    }
    cell.classList.add(hit ? "hit" : "miss");

    if (hit) {
        playerBoard = playerBoard.filter(pos => pos.row !== row || pos.col !== col);
        if (playerBoard.length === 0) {
            document.getElementById("message").innerText = "You lose!";
            return;
        }
    }

    playerTurn = true;
    document.getElementById("message").innerText = "Your turn!";
}

document.addEventListener("DOMContentLoaded", () => {
    createBoard("playerBoard");
    createBoard("computerBoard");
    placeComputerShips();

    document.getElementById("shipSelect").addEventListener("change", (e) => {
        selectedShip = e.target.value;
    });

    document.getElementById("rotateShip").addEventListener("click", () => {
        horizontal = !horizontal;
    });

    document.getElementById("finishPlacement").addEventListener("click", () => {
        placingShips = false;
        document.getElementById("message").innerText = "Game on! Attack the enemy board.";
        document.getElementById("finishPlacement").disabled = true;
        document.getElementById("startGame").disabled = false;
    });

    document.getElementById("startGame").addEventListener("click", () => {
        playerTurn = true;
        document.getElementById("message").innerText = "Your turn!";
    });

    document.getElementById("voiceCommandBtn").addEventListener("click", () => {
        const button = document.getElementById("voiceCommandBtn");
        
        if (!voiceCommandActive) {
            voiceCommandActive = true;
            button.classList.add('active');
            button.innerText = 'Listening...';
            updateVoiceStatus('🎤 Microphone activated - Speak now');
            
            fetch('/activate-voice-command')
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        updateVoiceStatus('❌ ' + data.error);
                    } else {
                        updateRecognizedText(data.recognized_text || '');
                        
                        if (data.game_action) {
                            document.getElementById('commandResult').innerText = data.game_action;
                            
                            if (placingShips) {
                                handleVoicePlacement(data.game_action);
                            } else {
                                handleVoiceFiring(data.game_action);
                            }
                        }
                    }
                })
                .catch(error => {
                    console.error("Error:", error);
                    updateVoiceStatus('❌ Error connecting to voice service');
                })
                .finally(() => {
                    voiceCommandActive = false;
                    button.classList.remove('active');
                    button.innerText = 'Activate Voice Command';
                    setTimeout(() => {
                        updateVoiceStatus('Voice command completed');
                    }, 3000);
                });
        }
    });
});

function handleVoicePlacement(command) {
    const match = command.match(/placed at (\d)(\d) (\w+)/);
    if (match) {
        const row = parseInt(match[1]);
        const col = parseInt(match[2]);
        const orientation = match[3];
        selectedShip = document.getElementById("shipSelect").value;
        horizontal = orientation === "horizontally";
        placeShip(row, col);
    } else {
        alert("Invalid placement command received from voice recognition.");
    }
}

function handleVoiceFiring(command) {
    const match = command.match(/Fire at (\d{2})/);
    if (match) {
        const row = parseInt(match[1][0]);
        const col = parseInt(match[1][1]);
        attack(row, col);
    } else {
        alert("Invalid firing command received from voice recognition.");
    }
}
