from flask import Flask, jsonify # type: ignore
from flask_cors import CORS  # type: ignore # Import CORS
from flask import Flask, jsonify, send_from_directory # type: ignore # Import send_from_directory
from flask_cors import CORS # type: ignore
app = Flask(__name__)
CORS(app)
import speech_recognition as sr # type: ignore
import keyboard # type: ignore
import re
import joblib
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from Levenshtein import distance as levenshtein_distance # type: ignore
from flask import Flask, jsonify # type: ignore

app = Flask(__name__)

# Define ship types and their sizes
ship_types = {
    "carrier": 5, "battleship": 4, "destroyer": 3, "cruiser": 3, "submarine": 2
}
placed_ships = {}

# State control for placement and firing phases
phase = "placement"

# Machine learning setup
vectorizer = CountVectorizer()
classifier = MultinomialNB()

# Regex patterns for commands
grid_pattern = r"[0-9]{2}"
phonetic_corrections = {}

# Grid for collision detection
grid_size = 10
occupied_cells = [[False] * grid_size for _ in range(grid_size)]

# Define training phrases dynamically for all coordinates
def generate_training_phrases():
    training_phrases = []
    labels = []

    orientations = ["horizontally", "vertically"]
    for row in range(10):
        for col in range(10):
            grid = f"{row:01}{col:01}"
            for ship_type in ship_types:
                for orientation in orientations:
                    training_phrases.append(f"place {ship_type} at {grid} {orientation}")
                    labels.append(f"placement_{ship_type}_{grid}_{orientation}")
            # Firing commands
            training_phrases.append(f"fire at {grid}")
            labels.append(f"firing_{grid}")

    return training_phrases, labels

def train_model():
    training_phrases, labels = generate_training_phrases()
    X_train = vectorizer.fit_transform(training_phrases)
    classifier.fit(X_train, labels)

def predict_action(text):
    X_test = vectorizer.transform([text])
    prediction = classifier.predict(X_test)[0]
    return prediction

def recognize_speech():
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("Listening...")
        # Adjust for ambient noise
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
        try:
            # Set timeout to 5 seconds
            audio = recognizer.listen(source, timeout=5)
            text = recognizer.recognize_google(audio)
            print(f"Recognized: {text}")
            return text
        except sr.WaitTimeoutError:
            raise Exception("Listening timed out. Please try again.")
        except sr.UnknownValueError:
            raise Exception("Could not understand audio")
        except sr.RequestError:
            raise Exception("Speech recognition service unavailable")

def is_within_grid(row, col):
    return 0 <= row < grid_size and 0 <= col < grid_size

def is_collision(ship_type, row, col, orientation):
    size = ship_types[ship_type]

    for i in range(size):
        r = row + (i if orientation == "vertically" else 0)
        c = col + (i if orientation == "horizontally" else 0)
        if not is_within_grid(r, c) or occupied_cells[r][c]:
            return True

    return False

def mark_cells(ship_type, row, col, orientation):
    size = ship_types[ship_type]

    for i in range(size):
        r = row + (i if orientation == "vertically" else 0)
        c = col + (i if orientation == "horizontally" else 0)
        if is_within_grid(r, c):
            occupied_cells[r][c] = True

def parse_placement_command(prediction, command_text):
    match = re.match(r"placement_(\w+)_(\d{2})_(\w+)", prediction)
    if match:
        ship_type, grid, orientation = match.groups()

        # Handle spaced integers and potential phonetic errors for coordinates
        grid_text = re.sub(r"[^0-9]", "", command_text)

        if len(grid_text) == 2:
            row, col = int(grid_text[0]), int(grid_text[1])
        elif len(grid_text) == 3 and grid_text[1] == '0':
            row, col = int(grid_text[0:2]), int(grid_text[2])
        else:
            return "Invalid grid coordinates."

        if ship_type in placed_ships:
            return f"{ship_type.capitalize()} has been placed already at {placed_ships[ship_type][0]} {placed_ships[ship_type][1]}."

        if is_collision(ship_type, row, col, orientation):
            return f"Cannot place {ship_type.capitalize()} at {row}{col} {orientation} due to a collision or out-of-bound placement."

        placed_ships[ship_type] = (f"{row}{col}", orientation)
        mark_cells(ship_type, row, col, orientation)

        if len(placed_ships) == len(ship_types):
            global phase
            phase = "firing"
            return f"All ships placed. {ship_type.capitalize()} placed at {row}{col} {orientation}. Switching to firing phase."

        return f"{ship_type.capitalize()} placed at {row}{col} {orientation}."
    return "Invalid placement command."

def parse_firing_command(prediction):
    match = re.match(r"firing_(\d{2})", prediction)
    if match:
        grid = match.group(1)
        return f"Fire at {grid}"
    return "Unrecognized command."

@app.route('/activate-voice-command', methods=['GET'])
def activate_voice_command():
    try:
        command_text = recognize_speech()
        if command_text:
            prediction = predict_action(command_text)
            if phase == "placement":
                game_action = parse_placement_command(prediction, command_text)
            else:
                game_action = parse_firing_command(prediction)
            return jsonify({
                "game_action": game_action,
                "recognized_text": command_text,
                "status": "success"
            })
        return jsonify({
            "error": "Voice command not recognized",
            "status": "error"
        })
    except Exception as e:
        return jsonify({
            "error": str(e),
            "status": "error"
        })

@app.route('/static/<path:path>')
def serve_static(path):
    full_path = os.path.join(app.root_path, 'static', path) # Use app.root_path
    print(f"Full path: {full_path}")  # Debug print
    if os.path.exists(full_path):
        return send_from_directory(os.path.join(app.root_path, 'static'), path) # Use app.root_path
    else:
        print(f"File not found: {full_path}")  # Debug print
        return "File not found", 404
def main():
    train_model()
    app.run(port=5000, debug=True)

if __name__ == "__main__":
    main()
