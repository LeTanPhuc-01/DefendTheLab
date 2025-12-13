from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import sys
import os

# 1. SETUP PATHS
# Get the directory where THIS file (app.py) is located (e.g., .../capstone/src)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Add this directory to the python path so we can import 'ocr' and 'model'
sys.path.append(BASE_DIR)

# Define the absolute path to the weights
WEIGHTS_PATH = os.path.join(BASE_DIR, "model", "weights", "mnist_best_model.pth")

# 2. IMPORTS
try:
    from ocr import OCR_Engine
    print("✅ OCR_Engine imported successfully!")
except ImportError as e:
    print(f"❌ Error importing ocr.py: {e}")
    print("Make sure ocr.py is in the 'src' folder alongside app.py")
    sys.exit(1)

app = Flask(__name__)
CORS(app) 

# 3. INITIALIZE ENGINE
if not os.path.exists(WEIGHTS_PATH):
    print(f"❌ Weights file not found at: {WEIGHTS_PATH}")
    sys.exit(1)

print(f"Loading model from: {WEIGHTS_PATH}")
try:
    engine = OCR_Engine(WEIGHTS_PATH, device='cpu')
    print("✅ Engine initialized")
except Exception as e:
    print(f"❌ Failed to load model: {e}")
    sys.exit(1)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        image_data = data.get('image')

        if not image_data:
            return jsonify({'error': 'No image provided'}), 400

        if "," in image_data:
            header, encoded = image_data.split(",", 1)
        else:
            encoded = image_data
            
        binary_data = base64.b64decode(encoded)
        
        # Use an absolute path for the temp file to avoid permission issues or "missing file" errors
        temp_filename = os.path.join(BASE_DIR, "temp_web_input.png")
        
        with open(temp_filename, "wb") as f:
            f.write(binary_data)

        digit, conf = engine.predict_image(temp_filename)

        # === ADD THIS SERVER-SIDE LOGGING ===
        print(f"🤖 AI PREDICTION: Digit={digit}, Confidence={conf:.4f}")

        if os.path.exists(temp_filename):
            os.remove(temp_filename)

        return jsonify({
            'digit': int(digit),
            'confidence': float(conf)
        })

    except Exception as e:
        print(f"Error during prediction: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print(f"🚀 Server running. Serving from {BASE_DIR}")
    # Listen on 0.0.0.0 to allow connections from external devices (like the phone controller)
    app.run(host='0.0.0.0', debug=True, port=5000)