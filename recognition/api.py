import cv2
import json
import numpy as np

from pathlib import Path
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .face_engine import FaceEngine


# --------------------------------------------------
# Paths
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
PEOPLE_DIR = BASE_DIR.parent / "data" / "people"


# --------------------------------------------------
# Configuration
# --------------------------------------------------

COSINE_THRESHOLD = 0.363


# --------------------------------------------------
# FastAPI
# --------------------------------------------------

app = FastAPI(
    title="DemiCare Recognition API",
    version="1.0.0",
)


# React runs on localhost:5173 during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# Face engine
# --------------------------------------------------

print("Initializing DemiCare recognition service...")

engine = FaceEngine()


# --------------------------------------------------
# Load registered people
# --------------------------------------------------

def load_known_people():
    people = []

    if not PEOPLE_DIR.exists():
        return people

    for person_dir in sorted(PEOPLE_DIR.iterdir()):

        if not person_dir.is_dir():
            continue

        face_data_path = person_dir / "face_data.json"

        if not face_data_path.exists():
            continue

        try:
            with open(
                face_data_path,
                "r",
                encoding="utf-8"
            ) as file:
                data = json.load(file)

            feature = np.array(
                data["feature"],
                dtype=np.float32
            ).reshape(1, -1)

            people.append({
                "name": data["name"],
                "relationship": data["relationship"],
                "feature": feature,
            })

        except Exception as error:
            print(
                f"Could not load {person_dir.name}: {error}"
            )

    return people


known_people = load_known_people()

print("Registered people:")

for person in known_people:
    print(
        f"  - {person['name']} "
        f"({person['relationship']})"
    )


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "service": "DemiCare Recognition API",
        "status": "running",
        "registered_people": len(known_people),
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "registered_people": len(known_people),
    }


# --------------------------------------------------
# Recognition
# --------------------------------------------------

@app.post("/recognize")
async def recognize(file: UploadFile = File(...)):

    try:
        image_bytes = await file.read()

        image_array = np.frombuffer(
            image_bytes,
            dtype=np.uint8
        )

        frame = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR
        )

        if frame is None:
            return {
                "recognized": False,
                "name": None,
                "relationship": None,
                "confidence": 0,
                "error": "Invalid image",
            }

        faces = engine.detect_faces(frame)

        if faces is None or len(faces) == 0:
            return {
                "recognized": False,
                "name": None,
                "relationship": None,
                "confidence": 0,
            }

        # Use the largest detected face.
        face = max(
            faces,
            key=lambda item: item[2] * item[3]
        )

        feature = engine.get_feature(
            frame,
            face
        )

        best_person = None
        best_score = -1

        for person in known_people:

            score = engine.compare(
                feature,
                person["feature"]
            )

            if score > best_score:
                best_score = score
                best_person = person

        if (
            best_person is not None
            and best_score >= COSINE_THRESHOLD
        ):

            return {
                "recognized": True,
                "name": best_person["name"],
                "relationship": best_person["relationship"],
                "confidence": round(
                    float(best_score),
                    3
                ),
            }

        return {
            "recognized": False,
            "name": None,
            "relationship": None,
            "confidence": round(
                float(best_score),
                3
            ),
        }

    except Exception as error:

        print(
            f"Recognition error: {error}"
        )

        return {
            "recognized": False,
            "name": None,
            "relationship": None,
            "confidence": 0,
            "error": "Recognition failed",
        }
    