import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

// --------------------------------------------------
// RECOGNITION SETTINGS
// --------------------------------------------------

const REQUIRED_MATCHES = 3;
const ANNOUNCEMENT_COOLDOWN = 30000;

// --------------------------------------------------
// REMINDER SETTINGS
// Change these times for the demo.
// Format: "HH:MM" using 24-hour time.
// --------------------------------------------------

const reminders = [
  {
    id: "medication",
    icon: "💊",
    title: "Medication",
    message: "It is time to take your medicine.",
    malayalamMessage: "മരുന്ന് കഴിക്കാനുള്ള സമയമായി.",
    time: "08:32",
  },
  {
    id: "food",
    icon: "🍽️",
    title: "Food",
    message: "It is time for your meal.",
    malayalamMessage: "ഭക്ഷണം കഴിക്കാനുള്ള സമയമായി.",
    time: "13:00",
  },
  {
    id: "exercise",
    icon: "🚶",
    title: "Exercise",
    message: "It is time for your walk.",
    malayalamMessage: "നടക്കാനുള്ള സമയമായി.",
    time: "17:00",
  },
];

// --------------------------------------------------
// VOICE SETTINGS
// --------------------------------------------------

const languages = {
  en: {
    label: "English",
    locale: "en-US",
  },
  ml: {
    label: "മലയാളം",
    locale: "ml-IN",
  },
};

function App() {
  // ------------------------------------------------
  // CAMERA
  // ------------------------------------------------

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // ------------------------------------------------
  // RECOGNITION
  // ------------------------------------------------

  const recognitionBusyRef = useRef(false);
  const recognitionHistoryRef = useRef([]);
  const confirmedPersonRef = useRef(null);
  const lastAnnouncementRef = useRef(null);

  // ------------------------------------------------
  // REMINDERS
  // ------------------------------------------------

  const announcedRemindersRef = useRef({});

  // ------------------------------------------------
  // STATE
  // ------------------------------------------------

  const [cameraStatus, setCameraStatus] =
    useState("Starting camera...");

  const [activeReminder, setActiveReminder] =
    useState(null);

  const [recognition, setRecognition] = useState({
    status: "waiting",
    name: null,
    relationship: null,
  });

  const [currentTime, setCurrentTime] =
    useState(new Date());

  const [language, setLanguage] = useState("en");

  // ------------------------------------------------
  // START CAMERA
  // ------------------------------------------------

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

  // ------------------------------------------------
  // RECOGNITION LOOP
  // ------------------------------------------------

  useEffect(() => {
    const interval = setInterval(() => {
      recognizeCurrentFrame();
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  // ------------------------------------------------
  // CLOCK + REMINDER LOOP
  // ------------------------------------------------

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      checkScheduledReminders();
    }, 1000);

    return () => clearInterval(interval);
  }, [language]);

  // ------------------------------------------------
  // START CAMERA
  // ------------------------------------------------

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

  // ------------------------------------------------
  // RECOGNIZE CURRENT CAMERA FRAME
  // ------------------------------------------------

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

      // ----------------------------------------------
      // RECOGNIZED PERSON
      // ----------------------------------------------

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
          });

          if (isNewPerson) {
            announcePerson(
              result.name,
              result.relationship
            );
          }
        }
      }

      // ----------------------------------------------
      // UNKNOWN PERSON
      // ----------------------------------------------

      else {
        recognitionHistoryRef.current = [];

        setRecognition(
          (previous) => {
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

  // ------------------------------------------------
  // GET SELECTED VOICE
  // ------------------------------------------------

  const getSelectedVoice = () => {
    if (!("speechSynthesis" in window)) {
      return null;
    }

    const voices =
      window.speechSynthesis.getVoices();

    if (language === "ml") {
      return (
        voices.find(
          (voice) =>
            voice.lang
              ?.toLowerCase()
              .startsWith("ml")
        ) || null
      );
    }

    return (
      voices.find(
        (voice) =>
          voice.lang
            ?.toLowerCase()
            .startsWith("en")
      ) || null
    );
  };

  // ------------------------------------------------
  // PERSON VOICE ANNOUNCEMENT
  // ------------------------------------------------

  const announcePerson = (
    name,
    relationship
  ) => {
    if (
      !("speechSynthesis" in window)
    ) {
      return;
    }

    let announcement;

    if (language === "ml") {
      announcement =
        `${name}, നിങ്ങളുടെ ${getMalayalamRelationship(
          relationship
        )} ഇവിടെ എത്തിയിരിക്കുന്നു.`;
    } else {
      announcement =
        `${name}, your ${relationship}, is here.`;
    }

    const now = Date.now();

    const previous =
      lastAnnouncementRef.current;

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

    speech.lang =
      languages[language].locale;

    const selectedVoice =
      getSelectedVoice();

    if (selectedVoice) {
      speech.voice = selectedVoice;
    }

    speech.rate = 0.85;
    speech.pitch = 1;
    speech.volume = 1;

    window.speechSynthesis.speak(
      speech
    );
  };

  // ------------------------------------------------
  // MALAYALAM RELATIONSHIP
  // ------------------------------------------------

  const getMalayalamRelationship = (
    relationship
  ) => {
    const relationshipMap = {
      Son: "മകൻ",
      Daughter: "മകൾ",
      Father: "അച്ഛൻ",
      Mother: "അമ്മ",
      Husband: "ഭർത്താവ്",
      Wife: "ഭാര്യ",
      Brother: "സഹോദരൻ",
      Sister: "സഹോദരി",
      Grandson: "കൊച്ചുമകൻ",
      Granddaughter: "കൊച്ചുമകൾ",
    };

    return (
      relationshipMap[relationship] ||
      relationship
    );
  };

  // ------------------------------------------------
  // GENERIC VOICE ANNOUNCEMENT
  // ------------------------------------------------

  const speakReminder = (reminder) => {
    if (
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const message =
      language === "ml"
        ? reminder.malayalamMessage
        : reminder.message;

    const speech =
      new SpeechSynthesisUtterance(
        message
      );

    speech.lang =
      languages[language].locale;

    const selectedVoice =
      getSelectedVoice();

    if (selectedVoice) {
      speech.voice = selectedVoice;
    }

    speech.rate = 0.85;
    speech.pitch = 1;
    speech.volume = 1;

    window.speechSynthesis.speak(
      speech
    );
  };

  // ------------------------------------------------
  // GET CURRENT REMINDER STATUS
  // ------------------------------------------------

  const getReminderStatus = (reminder) => {
    const now = new Date();

    const currentMinutes =
      now.getHours() * 60 +
      now.getMinutes();

    const [hours, minutes] =
      reminder.time.split(":");

    const reminderMinutes =
      Number(hours) * 60 +
      Number(minutes);

    if (
      currentMinutes ===
      reminderMinutes
    ) {
      return "due";
    }

    if (
      currentMinutes <
      reminderMinutes
    ) {
      return "upcoming";
    }

    return "past";
  };

  // ------------------------------------------------
  // MANUAL REMINDER BUTTON
  // ------------------------------------------------

  const triggerReminder = (
    reminder
  ) => {
    const status =
      getReminderStatus(reminder);

    // ----------------------------------------------
    // IT IS CURRENTLY THE SCHEDULED TIME
    // ----------------------------------------------

    if (status === "due") {
      setActiveReminder(reminder);

      speakReminder(reminder);

      return;
    }

    // ----------------------------------------------
    // BEFORE SCHEDULED TIME
    // ----------------------------------------------

    if (status === "upcoming") {
      const message =
        language === "ml"
          ? `${getMalayalamTitle(
              reminder.id
            )} ${formatReminderTime(
              reminder.time
            )}-ന് നിശ്ചയിച്ചിരിക്കുന്നു. ഇപ്പോൾ സമയമായിട്ടില്ല.`
          : `${reminder.title} is scheduled for ${formatReminderTime(
              reminder.time
            )}. It is not time yet.`;

      setActiveReminder({
        ...reminder,
        manualMessage: message,
        manualStatus: "upcoming",
      });

      speakCustomMessage(message);

      return;
    }

    // ----------------------------------------------
    // AFTER SCHEDULED TIME
    // ----------------------------------------------

    const message =
      language === "ml"
        ? `${getMalayalamTitle(
            reminder.id
          )} ${formatReminderTime(
            reminder.time
          )}-നാണ് നിശ്ചയിച്ചിരുന്നത്. ഇപ്പോൾ ${getMalayalamTitle(
            reminder.id
          )} ചെയ്യാനുള്ള സമയമല്ല.`
        : `${reminder.title} was scheduled for ${formatReminderTime(
            reminder.time
          )}. It is not time for ${reminder.title.toLowerCase()} right now.`;

    setActiveReminder({
      ...reminder,
      manualMessage: message,
      manualStatus: "past",
    });

    speakCustomMessage(message);
  };

  // ------------------------------------------------
  // MALAYALAM REMINDER TITLES
  // ------------------------------------------------

  const getMalayalamTitle = (id) => {
    const titles = {
      medication: "മരുന്ന് കഴിക്കൽ",
      food: "ഭക്ഷണം",
      exercise: "വ്യായാമം",
    };

    return titles[id] || "";
  };

  // ------------------------------------------------
  // CUSTOM VOICE MESSAGE
  // ------------------------------------------------

  const speakCustomMessage = (
    message
  ) => {
    if (
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const speech =
      new SpeechSynthesisUtterance(
        message
      );

    speech.lang =
      languages[language].locale;

    const selectedVoice =
      getSelectedVoice();

    if (selectedVoice) {
      speech.voice = selectedVoice;
    }

    speech.rate = 0.85;
    speech.pitch = 1;
    speech.volume = 1;

    window.speechSynthesis.speak(
      speech
    );
  };

  // ------------------------------------------------
  // SCHEDULED REMINDERS
  // ------------------------------------------------

  const checkScheduledReminders = () => {
    const now = new Date();

    const hours =
      String(now.getHours()).padStart(
        2,
        "0"
      );

    const minutes =
      String(now.getMinutes()).padStart(
        2,
        "0"
      );

    const currentTimeString =
      `${hours}:${minutes}`;

    const today =
      `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    reminders.forEach((reminder) => {
      const reminderKey =
        `${today}-${reminder.id}`;

      if (
        reminder.time ===
          currentTimeString &&
        !announcedRemindersRef.current[
          reminderKey
        ]
      ) {
        announcedRemindersRef.current[
          reminderKey
        ] = true;

        setActiveReminder(reminder);

        speakReminder(reminder);
      }
    });
  };

  // ------------------------------------------------
  // FORMAT CURRENT TIME
  // ------------------------------------------------

  const formattedCurrentTime =
    currentTime.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );

  // ------------------------------------------------
  // FORMAT REMINDER TIME
  // ------------------------------------------------

  const formatReminderTime = (
    time
  ) => {
    const [hours, minutes] =
      time.split(":");

    const date = new Date();

    date.setHours(
      Number(hours),
      Number(minutes),
      0,
      0
    );

    return date.toLocaleTimeString(
      [],
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  };

  // ------------------------------------------------
  // RECOGNITION DISPLAY
  // ------------------------------------------------

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
        return `Your ${recognition.relationship}`;
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

  // ------------------------------------------------
  // UI
  // ------------------------------------------------

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
                Voice reminders
              </p>

            </div>

            <div className="current-time">
              {formattedCurrentTime}
            </div>

          </div>

          {/* LANGUAGE SELECTOR */}

          <div
            className="language-selector"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Voice:
            </span>

            <button
              type="button"
              onClick={() => {
                setLanguage("en");
                window.speechSynthesis?.cancel();
              }}
              className={
                language === "en"
                  ? "language-button active"
                  : "language-button"
              }
            >
              English
            </button>

            <button
              type="button"
              onClick={() => {
                setLanguage("ml");
                window.speechSynthesis?.cancel();
              }}
              className={
                language === "ml"
                  ? "language-button active"
                  : "language-button"
              }
            >
              മലയാളം
            </button>
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

                  <small>
                    {formatReminderTime(
                      reminder.time
                    )}
                  </small>

                </button>
              )
            )}

          </div>

          {/* ACTIVE / MANUAL REMINDER */}

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
                  {activeReminder.manualMessage ||
                    (
                      language === "ml"
                        ? activeReminder.malayalamMessage
                        : activeReminder.message
                    )}
                </p>

              </div>

            </div>
          )}

          {/* SCHEDULED REMINDERS */}

          <div className="scheduled-reminders">

            <h3>
              Scheduled reminders
            </h3>

            <div className="schedule-list">

              {reminders.map(
                (reminder) => (
                  <div
                    className="schedule-item"
                    key={reminder.id}
                  >

                    <span>
                      {reminder.icon}
                    </span>

                    <div>

                      <strong>
                        {reminder.title}
                      </strong>

                      <small>
                        {formatReminderTime(
                          reminder.time
                        )}
                      </small>

                    </div>

                  </div>
                )
              )}

            </div>

          </div>

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