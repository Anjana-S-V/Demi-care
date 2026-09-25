import cv2
import json
import numpy as np
from pathlib import Path

from face_engine import FaceEngine


BASE_DIR = Path(__file__).resolve().parent
PEOPLE_DIR = BASE_DIR.parent / "data" / "people"

# Start with OpenCV's documented cosine-similarity threshold.
# We'll tune this using our actual demo images.
COSINE_THRESHOLD = 0.363


def load_known_people():
    people = []

    for person_dir in sorted(PEOPLE_DIR.iterdir()):
        if not person_dir.is_dir():
            continue

        face_data_path = person_dir / "face_data.json"

        if not face_data_path.exists():
            continue

        with open(face_data_path, "r", encoding="utf-8") as file:
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

    return people


def recognize_face(engine, frame, known_people):
    faces = engine.detect_faces(frame)

    if faces is None or len(faces) == 0:
        return None

    # For our demo, use the largest detected face.
    largest_face = max(
        faces,
        key=lambda face: face[2] * face[3]
    )

    feature = engine.get_feature(
        frame,
        largest_face
    )

    best_match = None
    best_score = -1

    for person in known_people:
        score = engine.compare(
            feature,
            person["feature"]
        )

        if score > best_score:
            best_score = score
            best_match = person

    if best_score >= COSINE_THRESHOLD:
        return {
            "name": best_match["name"],
            "relationship": best_match["relationship"],
            "score": best_score,
            "box": largest_face,
        }

    return {
        "name": "Unknown",
        "relationship": "",
        "score": best_score,
        "box": largest_face,
    }


def main():
    print("===================================")
    print("       DemiCare Live Recognition")
    print("===================================")

    engine = FaceEngine()

    known_people = load_known_people()

    if not known_people:
        print("ERROR: No registered people found.")
        print("Run register_people.py first.")
        return

    print("\nRegistered people:")

    for person in known_people:
        print(
            f"  - {person['name']} "
            f"({person['relationship']})"
        )

    camera = cv2.VideoCapture(0)

    if not camera.isOpened():
        print("ERROR: Could not open webcam.")
        return

    print("\nCamera started.")
    print("Press Q to quit.")

    last_name = None

    while True:
        success, frame = camera.read()

        if not success:
            print("ERROR: Could not read camera frame.")
            break

        result = recognize_face(
            engine,
            frame,
            known_people
        )

        if result:
            x, y, w, h = [
                int(value)
                for value in result["box"][:4]
            ]

            name = result["name"]
            relationship = result["relationship"]
            score = result["score"]

            if name == "Unknown":
                label = "Unknown"
            else:
                label = f"{name} - {relationship}"

            cv2.rectangle(
                frame,
                (x, y),
                (x + w, y + h),
                (0, 255, 0),
                2,
            )

            cv2.putText(
                frame,
                label,
                (x, max(y - 10, 25)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 0),
                2,
            )

            cv2.putText(
                frame,
                f"Similarity: {score:.3f}",
                (x, y + h + 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                2,
            )

            if name != last_name:
                print(
                    f"Detected: {label} "
                    f"(similarity: {score:.3f})"
                )
                last_name = name

        else:
            last_name = None

        cv2.imshow(
            "DemiCare - Live Recognition",
            frame
        )

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()