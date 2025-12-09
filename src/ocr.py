import torch
import torchvision.transforms as transforms
from PIL import Image, ImageOps
import os

# Import your model definition
try:
    from model.MobileNET_v2 import MobileNET_v2
except ImportError:
    # Handle case where script is run directly from src/
    from MobileNET_v2 import MobileNET_v2

class OCR_Engine:
    def __init__(self, weights_path, device='cpu'):
        self.device = torch.device(device)
        
        # Initialize Model (Must match training architecture)
        self.model = MobileNET_v2(num_classes=10, in_channels=1).to(self.device)
        
        # Load Weights
        if not os.path.exists(weights_path):
            raise FileNotFoundError(f"Weights file not found at {weights_path}")
            
        checkpoint = torch.load(weights_path, map_location=self.device)
        
        # Handle dictionary vs state_dict saving formats
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            self.model.load_state_dict(checkpoint['model_state_dict'])
        else:
            self.model.load_state_dict(checkpoint)
            
        self.model.eval() 
        print(f"✅ Model loaded on {self.device}")

    def preprocess_image(self, image_path):
        """
        Converts a raw image file into a tensor compatible with MNIST training.
        """
        img = Image.open(image_path).convert('L') # Convert to Grayscale

        # Invert colors if necessary (MNIST is white on black)
        # We assume the drawing canvas sends black text on white background (or transparent)
        # So we usually need to invert it.
        # But wait! Your JS logic might already be handling this.
        # Let's assume standard "Black ink on White paper" needs inversion.
        # Simple check: If average pixel > 127, it's mostly white => Invert.
        stat = ImageOps.grayscale(img).getextrema()
        # If the image is mostly white (background), invert it to match MNIST (black bg)
        # This is a heuristic. For robust canvas data, usually Invert is needed.
        img = ImageOps.invert(img) 

        # Transform
        transform = transforms.Compose([
            transforms.Resize((28, 28)),
            transforms.ToTensor(),
            transforms.Normalize((0.1307,), (0.3081,))
        ])
        
        img_tensor = transform(img)
        img_tensor = img_tensor.unsqueeze(0).to(self.device) # Add batch dimension
        
        return img_tensor

    def predict_image(self, image_path):
        tensor = self.preprocess_image(image_path)
        
        with torch.no_grad():
            outputs = self.model(tensor)
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
            confidence, predicted = torch.max(probabilities, 1)
            
            digit = predicted.item()
            conf = confidence.item()
            
        return digit, conf

# For testing this module directly
if __name__ == "__main__":
    path = "model/weights/mnist_best_model.pth"
    if os.path.exists(path):
        ocr = OCR_Engine(path)
        print("Engine initialized successfully.")
    else:
        print("Could not find weights for testing.")