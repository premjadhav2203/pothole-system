from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
from PIL import Image
import io

app = FastAPI()
model = YOLO("model.pt")

def severity_from_box(box, conf, img_area):
    box_area = (box[2]-box[0]) * (box[3]-box[1])
    ratio = box_area / img_area
    if conf > 0.75 and ratio > 0.15:
        return "High"
    elif conf > 0.5:
        return "Medium"
    return "Low"

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    contents = await file.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")
    results = model(img)[0]
    img_area = img.width * img.height

    detections = []
    for box in results.boxes:
        xyxy = box.xyxy[0].tolist()
        conf = float(box.conf[0])
        detections.append({
            "box": xyxy,
            "confidence": conf,
            "severity": severity_from_box(xyxy, conf, img_area)
        })

    return {"detections": detections, "pothole_found": len(detections) > 0}