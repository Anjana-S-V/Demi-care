
import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const REQUIRED_MATCHES = 3;
const ANNOUNCEMENT_COOLDOWN = 30000;

const reminders = [
  {
    id: "medication",
    icon: "💊",
    title: "Medication",
    message: "It is time to take your medicine.",
  },
  {
    id: "food",
    icon: "🍽️",
    title: "Food",
    message: "It is time for your meal.",
  },
  {
    id: "exercise",
    icon: "🚶",
    title: "Exercise",
    message: "It is time for your walk.",
  },
];

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const recognitionBusyRef = useRef(false);
  const recognitionHistoryRef = useRef([]);
  const confirmedPersonRef = useRef(null);
  const lastAnnouncementRef = useRef(null);

  const [cameraStatus, setCameraStatus] =
    useState("Starting camera...");

  const [activeReminder, setActiveReminder] =
    useState(null);

  const [recognition, setRecognition] = useState({
    status: "waiting",
    name: null,
    relationship: null,
    confidence: 0,
  });

  // --------------------------------------------------
  // CAMERA INITIALIZATION
  // --------------------------------------------------

  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  // --------------------------------------------------
  // RECOGNITION LOOP
  // --------------------------------------------------

  useEffect(() => {
    const interval = setInterval(() => {
      recognizeCurrentFrame();
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  // --------------------------------------------------
  // START CAMERA
  // --------------------------------------------------

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus(
          "Camera is not supported by this browser."
        );
        return;
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: false,
        });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraStatus("Camera active");
    } catch (error) {
      console.error("Camera error:", error);

      if (error.name === "NotAllowedError") {
        setCameraStatus(
          "Camera permission denied."
        );
      } else if (error.name === "NotFoundError") {
        setCameraStatus("No camera found.");
      } else {
        setCameraStatus(
          "Unable to access camera."
        );
      }
    }
  };

  // --------------------------------------------------
  // SEND CAMERA FRAME TO PYTHON
  // --------------------------------------------------

  const recognizeCurrentFrame = async () => {
    if (recognitionBusyRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      return;
    }

    recognitionBusyRef.current = true;

    try {
      const width = video.videoWidth;
      const height = video.videoHeight;

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      context.drawImage(
        video,
        0,
        0,
        width,
        height
      );

      const blob = await new Promise(
        (resolve) => {
          canvas.toBlob(
            resolve,
            "image/jpeg",
            0.75
          );
        }
      );

      if (!blob) {
        return;
      }

      const formData = new FormData();

      formData.append(
        "file",
        blob,
        "camera-frame.jpg"
      );

      const response = await fetch(
        `${API_URL}/recognize`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Recognition API returned ${response.status}`
        );
      }

      const result = await response.json();

      // ------------------------------------------------
      // RECOGNIZED PERSON
      // ------------------------------------------------

      if (result.recognized) {
        const personKey =
          `${result.name}:${result.relationship}`;

        const history =
          recognitionHistoryRef.current;

        history.push(personKey);

        if (
          history.length >
          REQUIRED_MATCHES
        ) {
          history.shift();
        }

        const confirmedCount =
          history.filter(
            (person) =>
              person === personKey
          ).length;

        // Require multiple consistent detections.
        if (
          confirmedCount >=
          REQUIRED_MATCHES
        ) {
          const previousPerson =
            confirmedPersonRef.current;

          const isNewPerson =
            previousPerson !== personKey;

          confirmedPersonRef.current =
            personKey;

          setRecognition({
            status: "recognized",
            name: result.name,
            relationship:
              result.relationship,
            confidence:
              result.confidence,
          });

          if (isNewPerson) {
            announcePerson(
              result.name,
              result.relationship
            );
          }
        }
      }

      // ------------------------------------------------
      // UNKNOWN PERSON
      // ------------------------------------------------

      else {
        recognitionHistoryRef.current = [];

        setRecognition(
          (previous) => {
            // Don't immediately remove a confirmed
            // person because of one noisy frame.
            if (
              previous.status ===
              "recognized"
            ) {
              return previous;
            }

            return {
              status: "unknown",
              name: null,
              relationship: null,
              confidence:
                result.confidence,
            };
          }
        );
      }
    } catch (error) {
      console.error(
        "Recognition request failed:",
        error
      );

      setRecognition(
        (previous) => ({
          ...previous,
          status: "offline",
        })
      );
    } finally {
      recognitionBusyRef.current = false;
    }
  };

  // --------------------------------------------------
  // VOICE: PERSON RECOGNITION
  // --------------------------------------------------

  const announcePerson = (
    name,
    relationship
  ) => {
    if (
      !("speechSynthesis" in window)
    ) {
      return;
    }

    const announcement =
      `${name}, your ${relationship}, is here.`;

    const now = Date.now();

    const previous =
      lastAnnouncementRef.current;

    // Prevent repeated announcements.
    if (
      previous?.text === announcement &&
      now - previous.time <
        ANNOUNCEMENT_COOLDOWN
    ) {
      return;
    }

    lastAnnouncementRef.current = {
      text: announcement,
      time: now,
    };

    window.speechSynthesis.cancel();

    const speech =
      new SpeechSynthesisUtterance(
        announcement
      );

    speech.rate = 0.85;
    speech.pitch = 1;
    speech.volume = 1;

    window.speechSynthesis.speak(
      speech
    );
  };

  // --------------------------------------------------
  // VOICE: REMINDERS
  // --------------------------------------------------

  const triggerReminder = (
    reminder
  ) => {
    setActiveReminder(reminder);

    if (
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const speech =
      new SpeechSynthesisUtterance(
        reminder.message
      );

    speech.rate = 0.85;
    speech.pitch = 1;
    speech.volume = 1;

    window.speechSynthesis.speak(
      speech
    );
  };

  // --------------------------------------------------
  // RECOGNITION DISPLAY TEXT
  // --------------------------------------------------

  const getRecognitionTitle = () => {
    if (
      recognition.status ===
      "recognized"
    ) {
      return recognition.name;
    }

    if (
      recognition.status ===
      "unknown"
    ) {
      return "Unknown person";
    }

    if (
      recognition.status ===
      "offline"
    ) {
      return "Recognition unavailable";
    }

    return "Waiting for recognition";
  };

  const getRecognitionDescription =
    () => {
      if (
        recognition.status ===
        "recognized"
      ) {
        return recognition.relationship;
      }

      if (
        recognition.status ===
        "unknown"
      ) {
        return "This person is not registered.";
      }

      if (
        recognition.status ===
        "offline"
      ) {
        return "Please make sure the recognition service is running.";
      }

      return "Looking for a familiar person...";
    };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="app">

      {/* HEADER */}

      <header className="topbar">

        <div>
          <h1>DemiCare</h1>

          <p>
            Familiar care, made simple.
          </p>
        </div>

        <div className="voice-status">

          <span className="status-dot"></span>

          Voice Assistant On

        </div>

      </header>

      {/* MAIN DASHBOARD */}

      <main className="dashboard">

        {/* CAMERA SECTION */}

        <section className="camera-section">

          <div className="section-heading">

            <div>

              <h2>
                Familiar Person
              </h2>

              <p>
                Live camera recognition
              </p>

            </div>

            <span className="live-badge">
              ● LIVE
            </span>

          </div>

          {/* CAMERA */}

          <div className="camera-container">

            <video
              ref={videoRef}
              className="camera-video"
              autoPlay
              playsInline
              muted
            />

            {/* Hidden canvas used to capture
                frames for Python */}

            <canvas
              ref={canvasRef}
              style={{
                display: "none",
              }}
            />

            {cameraStatus !==
              "Camera active" && (
              <div className="camera-overlay">

                <div className="camera-icon">
                  📷
                </div>

                <h3>
                  {cameraStatus}
                </h3>

                <p>
                  Please allow camera access
                </p>

              </div>
            )}

          </div>

          {/* CAMERA STATUS */}

          <div className="camera-status">

            <span
              className={
                cameraStatus ===
                "Camera active"
                  ? "status-dot"
                  : "status-dot inactive"
              }
            ></span>

            {cameraStatus}

          </div>

          {/* RECOGNIZED PERSON */}

          <div className="person-card">

            <div className="person-avatar">

              {recognition.status ===
              "recognized"
                ? "👋"
                : "👤"}

            </div>

            <div className="person-info">

              <span className="recognized-label">

                {recognition.status ===
                "recognized"
                  ? "Familiar Person"
                  : "Recognition"}

              </span>

              <h3>
                {getRecognitionTitle()}
              </h3>

              <p>
                {getRecognitionDescription()}
              </p>

              {recognition.status ===
                "recognized" && (
                <small>
                  Recognition confidence:{" "}
                  {recognition.confidence}
                </small>
              )}

            </div>

          </div>

        </section>

        {/* CARE SECTION */}

        <section className="care-section">

          <div className="section-heading">

            <div>

              <h2>
                Care Assistance
              </h2>

              <p>
                Select an activity for a
                voice reminder
              </p>

            </div>

          </div>

          {/* REMINDER BUTTONS */}

          <div className="reminder-buttons">

            {reminders.map(
              (reminder) => (
                <button
                  key={reminder.id}
                  className={`reminder-button ${
                    activeReminder?.id ===
                    reminder.id
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    triggerReminder(
                      reminder
                    )
                  }
                >

                  <span className="reminder-icon">
                    {reminder.icon}
                  </span>

                  <span>
                    {reminder.title}
                  </span>

                </button>
              )
            )}

          </div>

          {/* ACTIVE REMINDER */}

          {activeReminder && (
            <div className="reminder-message">

              <span>
                {activeReminder.icon}
              </span>

              <div>

                <strong>
                  {activeReminder.title}
                </strong>

                <p>
                  {activeReminder.message}
                </p>

              </div>

            </div>
          )}

        </section>

      </main>

      {/* FOOTER */}

      <footer>
        DemiCare • Assistive dementia
        care technology
      </footer>

    </div>
  );
}

export default App;

