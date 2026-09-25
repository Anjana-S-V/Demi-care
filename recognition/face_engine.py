import cv2
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"

DETECTION_MODEL = MODEL_DIR / "face_detection_yunet_2026may.onnx"
RECOGNITION_MODEL = MODEL_DIR / "face_recognition_sface_2021dec.onnx"


class FaceEngine:
    def __init__(self):
        print("Loading YuNet face detector...")

        self.detector = cv2.FaceDetectorYN.create(
            str(DETECTION_MODEL),
            "",
            (320, 320),
            0.6,
            0.3,
            5000,
        )

        print("Loading SFace recognition model...")

        self.recognizer = cv2.FaceRecognizerSF.create(
            str(RECOGNITION_MODEL),
            "",
        )

        print("Face engine ready.")

    def detect_faces(self, image):
        """
        Detect faces in a BGR OpenCV image.

        Returns:
            numpy array containing detected faces,
            or None if no face was detected.
        """

        height, width = image.shape[:2]

        self.detector.setInputSize((width, height))

        _, faces = self.detector.detect(image)

        return faces

    def get_feature(self, image, face):
        """
        Align a detected face and extract its SFace feature.
        """

        aligned_face = self.recognizer.alignCrop(
            image,
            face,
        )

        feature = self.recognizer.feature(
            aligned_face
        )

        return feature

    def compare(self, feature1, feature2):
        """
        Compare two face features using cosine similarity.
        """

        return self.recognizer.match(
            feature1,
            feature2,
            cv2.FaceRecognizerSF_FR_COSINE,
        )


def main():
    print("Initializing DemiCare Face Engine...")

    engine = FaceEngine()

    print("Testing model initialization successful.")

    test_image = cv2.imread(
        str(BASE_DIR.parent / "data" / "people" / "person1" / "reference.jpg")
    )

    if test_image is None:
        print()
        print("No reference image found.")
        print(
            "Expected: data/people/person1/reference.jpg"
        )
        return

    print("Reference image loaded.")

    faces = engine.detect_faces(test_image)

    if faces is None:
        print("No face detected in reference image.")
        return

    print(f"Detected {len(faces)} face(s).")

    feature = engine.get_feature(
        test_image,
        faces[0],
    )

    print(
        "Face feature extracted successfully."
    )

    print(
        f"Feature shape: {feature.shape}"
    )


if __name__ == "__main__":
    main()