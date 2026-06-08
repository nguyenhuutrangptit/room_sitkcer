import cv2
import numpy as np
import os

def extract_stickers_contours(image_path, output_dir):
    print(f"Loading image from {image_path}")
    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print("Error: Could not load image")
        return
        
    if len(img.shape) == 3 and img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
        
    # Find white pixels (the outline and internal white)
    # White is near 255 in all channels
    lower_white = np.array([230, 230, 230, 0])
    upper_white = np.array([255, 255, 255, 255])
    
    if img.shape[2] == 3:
        lower_white = lower_white[:3]
        upper_white = upper_white[:3]
        
    white_mask = cv2.inRange(img, lower_white, upper_white)
    
    # Dilate slightly to ensure the white outline is fully connected
    kernel = np.ones((3,3), np.uint8)
    white_mask = cv2.dilate(white_mask, kernel, iterations=1)
    
    # Find contours
    contours, _ = cv2.findContours(white_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Sort contours from top to bottom, left to right
    contours = sorted(contours, key=lambda c: (cv2.boundingRect(c)[1] // 100, cv2.boundingRect(c)[0]))
    
    print(f"Found {len(contours)} raw contours.")
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    count = 1
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        
        # Filter out noise
        if w < 40 or h < 40:
            continue
            
        print(f"Processing sticker {count} at x:{x}, y:{y}, w:{w}, h:{h}")
        
        # Create a mask for this single object
        obj_mask = np.zeros(img.shape[:2], dtype=np.uint8)
        cv2.drawContours(obj_mask, [contour], -1, 255, thickness=cv2.FILLED)
        
        # Smooth the mask to remove jagged edges from dilation
        obj_mask = cv2.erode(obj_mask, kernel, iterations=1)
        
        # Crop the sticker and the mask
        sticker = img[y:y+h, x:x+w].copy()
        sticker_mask = obj_mask[y:y+h, x:x+w]
        
        # Apply mask to alpha channel
        sticker[:, :, 3] = sticker_mask
        
        output_path = os.path.join(output_dir, f"sticker_{count}.png")
        cv2.imwrite(output_path, sticker)
        count += 1
        
    print(f"Successfully extracted {count-1} stickers to {output_dir}")

if __name__ == "__main__":
    image_path = r"d:\room_sitkcer\assets\stickers.png"
    output_dir = r"d:\room_sitkcer\assets"
    extract_stickers_contours(image_path, output_dir)
