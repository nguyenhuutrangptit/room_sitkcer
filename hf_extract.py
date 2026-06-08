from gradio_client import Client, handle_file
import shutil
import cv2
import numpy as np
import os

def process_and_extract():
    print("Calling HuggingFace Space 'not-lain/background-removal'...")
    try:
        client = Client("not-lain/background-removal")
        
        # Send image to the API
        result_path = client.predict(
                f=handle_file("d:/room_sitkcer/assets/stickers.png"),
                api_name="/png"
        )
        
        print(f"Model returned image at: {result_path}")
        
        # Save the output
        bg_removed_path = "d:/room_sitkcer/assets/stickers_nobg_hf.png"
        shutil.copy(result_path, bg_removed_path)
        print(f"Saved background-removed image to {bg_removed_path}")
        
        # Now extract the individual stickers using OpenCV
        print("Extracting individual stickers...")
        img = cv2.imread(bg_removed_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            print("Error reading the background-removed image.")
            return
            
        # The background should be transparent, so alpha channel is 0.
        if len(img.shape) < 3 or img.shape[2] != 4:
            print("Image does not have an alpha channel!")
            return
            
        alpha = img[:, :, 3]
        _, thresh = cv2.threshold(alpha, 10, 255, cv2.THRESH_BINARY)
        
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Sort from top to bottom, left to right
        contours = sorted(contours, key=lambda c: (cv2.boundingRect(c)[1] // 100, cv2.boundingRect(c)[0]))
        
        print(f"Found {len(contours)} contours.")
        
        output_dir = r"d:\room_sitkcer\assets\hf_stickers"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        count = 1
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w < 40 or h < 40:
                continue
                
            sticker = img[y:y+h, x:x+w].copy()
            
            output_path = os.path.join(output_dir, f"sticker_hf_{count}.png")
            cv2.imwrite(output_path, sticker)
            count += 1
            
        print(f"Successfully extracted {count-1} stickers using HF model!")
        
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    process_and_extract()
