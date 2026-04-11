import cv2
import numpy as np
from PIL import Image

def preprocess_for_ocr(image_path):
    # Load the image
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)

    # Increasing image contrast ans removing noise, resizing for small handwritten
    img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

    # Apply Adaptive Thresholding to get a binary image
    img = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                cv2.THRESH_BINARY, 11, 2)

    return Image.fromarray(img)