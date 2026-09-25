import cv2
import json
import numpy as np
from pathlib import Path

from .face_engine import FaceEngine


BASE_DIR = Path(__file__).resolve().parent
PEOPLE_DIR = BASE_DIR.parent / "data" / "people"


def load_profile(person_dir):
    profile_path = person_dir / "profile.json"

    with open(profile_path, "r", encoding="utf-8") as file:
        return json.load(file)


def register_person(engine, person_dir):
    image_path = person_dir / "reference.jpg"

    print(f"\nProcessing: {person_dir.name}")

    image = cv2.imread(str(image_path))

    if image is None:
        print(f"ERROR: Could not load {image_path}")
        return False

    faces = engine.detect_faces(image)

    if faces is None or len(faces) == 0:
        print("ERROR: No face detected.")
        return False

    if len(faces) > 1:
        print("ERROR: More than one face detected.")
        print("Please use a reference photo containing only one person.")
        return False

    feature = engine.get_feature(
        image,
        faces[0],
    )

    profile = load_profile(person_dir)

    output = {
        "name": profile["name"],
        "relationship": profile["relationship"],
        "feature": feature.flatten().tolist(),
    }

    output_path = person_dir / "face_data.json"

    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(output, file, indent=2)

    print(f"Registered: {profile['name']}")
    print(f"Relationship: {profile['relationship']}")
    print(f"Saved: {output_path}")

    return True


def main():
    print("===================================")
    print("      DemiCare Person Registry")
    print("===================================")

    engine = FaceEngine()

    people = sorted(
        [
            directory
            for directory in PEOPLE_DIR.iterdir()
            if directory.is_dir()
        ]
    )

    if not people:
        print("No person directories found.")
        return

    successful = 0

    for person_dir in people:
        if register_person(engine, person_dir):
            successful += 1

    print("\n===================================")
    print(f"Registered {successful}/{len(people)} people.")
    print("===================================")


if __name__ == "__main__":
    main()
