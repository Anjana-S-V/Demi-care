# DemiCare

**Assistive dementia care technology with local face recognition and voice reminders.**

DemiCare is a prototype designed to provide a simple, accessible interface for people living with dementia. It combines live camera-based familiar-person recognition with audio-assisted care reminders.

The patient-facing interface is intentionally designed as a **single-screen experience** with minimal controls and no required scrolling.

---

## Features

* Live camera access through the browser
* Familiar-person face recognition
* Person name and relationship display
* Unknown-person handling
* Voice announcements for recognized people
* Medication reminders
* Food reminders
* Exercise reminders
* Browser-based voice/audio reminders
* Simple single-screen patient interface
* Local-first recognition pipeline

For the prototype demonstration, two people are registered:

* James — Son
* Jacquline — Daughter

Reference photographs are stored locally and are intentionally excluded from the Git repository.

---

## Technology Stack

### Frontend

* React
* Vite
* JavaScript
* CSS
* Browser MediaDevices API
* Browser Speech Synthesis API

### Backend

* Python
* FastAPI
* Uvicorn

### Computer Vision

* OpenCV
* YuNet face detector
* SFace face recognition model

### Development

* Git
* GitHub
* Python virtual environment
* npm

---

## System Architecture

```text
                    DemiCare
                       │
             ┌─────────┴─────────┐
             │                   │
       React Frontend       FastAPI Backend
             │                   │
       Browser Camera        Face Engine
             │              ┌────┴────┐
             │              │         │
             │            YuNet     SFace
             │              │         │
             │              └────┬────┘
             │                   │
             └──────────── Recognition
                                  │
                         Local Reference Data
```

The frontend handles the patient-facing interface, camera access, reminder controls, and voice feedback.

The FastAPI service exposes the recognition functionality to the frontend.

The recognition engine uses OpenCV with YuNet for face detection and SFace for face feature extraction and comparison.

---

## Recognition Pipeline

The recognition process follows these steps:

```text
Camera Frame
     ↓
Face Detection
     ↓
Face Feature Extraction
     ↓
Feature Comparison
     ↓
Similarity Evaluation
     ↓
Registered Person / Unknown
     ↓
Name + Relationship
     ↓
Voice + UI Feedback
```

The prototype uses a small locally registered set of people for demonstration purposes.

---

## Voice Reminders

DemiCare uses the browser's built-in Speech Synthesis API for audio reminders.

Examples include:

> "It is time to take your medicine."

> "It is time for your meal."

> "It is time for your walk."

This avoids requiring a paid text-to-speech API or external cloud service.

---

## Privacy

The prototype is designed around local processing.

Reference photographs used for testing are stored under:

```text
data/people/
```

These files are excluded through `.gitignore` and are **not intended to be committed to the public repository**.

No paid external face-recognition API is required by the prototype.

---

## Project Structure

```text
DemiCare/
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── ...
│
├── recognition/
│   ├── models/
│   │   ├── face_detection_yunet_2026may.onnx
│   │   └── face_recognition_sface_2021dec.onnx
│   ├── face_engine.py
│   ├── live_recognition.py
│   └── api.py
│
├── data/
│   └── people/
│       └── [local reference images]
│
├── start-demcare.bat
├── .gitignore
└── README.md
```

---

## Requirements

The current prototype was developed and tested with:

* Windows
* Node.js
* npm
* Python 3.11
* Git

The project uses a Python virtual environment for the recognition service.

---

## Running the Demo

### 1. Start DemiCare

From the project root:

```powershell
.\start-demcare.bat
```

The launcher starts:

* FastAPI recognition service on port `8000`
* React/Vite development server on port `5173`

The browser can then be opened at:

```text
http://localhost:5173
```

### 2. Allow camera access

When prompted by the browser, allow camera access.

### 3. Test recognition

Move a registered person into the camera view.

The system should display their name and relationship.

For example:

```text
Jacquline
Daughter
```

An unknown person should remain unidentified.

### 4. Test reminders

Use the three care-assistance buttons:

```text
Medication
Food
Exercise
```

Each reminder provides both visual feedback and an audio announcement.

---

## Demo Configuration

The current prototype uses two registered people for demonstration:

| Person    | Relationship |
| --------- | ------------ |
| James     | Son          |
| Jacquline | Daughter     |

Additional people can be supported by extending the local registration/configuration system.

---

## Scalability

The current prototype is intentionally small and local for demonstration purposes.

The architecture separates:

* Patient-facing frontend
* API layer
* Recognition engine
* Model files
* Local person data

This separation provides a foundation for future expansion.

A production implementation could introduce authenticated caregiver management, a secure database, centralized model management, multiple patient profiles, monitoring, audit logging, and deployment infrastructure.

These capabilities are **not part of the current prototype**.

---

## Prototype Limitations

DemiCare is a demonstration prototype and should not be treated as a clinical decision-making or medication-administration system.

The current implementation:

* Uses a limited registered-person dataset
* Performs recognition locally
* Depends on browser camera permissions
* Uses browser speech synthesis for audio
* Does not provide medical advice
* Does not independently verify whether medication was taken
* Does not replace professional or caregiver supervision

---

## Project Goal

DemiCare explores how computer vision and accessible human-computer interaction can be combined to support dementia care while keeping the patient-facing experience simple.

The primary design principle is:

> **Familiar care, made simple.**

---

## License

This project is currently a prototype developed for demonstration and educational purposes.
