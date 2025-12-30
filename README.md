# 🛡️ ProctorAI - Secure Online Examination Platform

ProctorAI is a cloud-native, AI-powered examination system designed to ensure academic integrity in remote assessments. It features strict anti-cheat proctoring, AI-assisted question generation, and automated grading using Google Gemini.

use pre existing credentials:

Teacher login: teacher@test.com 

                pass:admin123
                
Student login: student@test.com

               pass: 123456
[Proctor-AI Preview](https://proctor-ai-virid.vercel.app/)
## 🚀 Key Features

### 🤖 Artificial Intelligence (Google Gemini)
*   **AI Question Generator**: Instructors can generate full exams (MCQ + Short Answer) just by typing a topic (e.g., "Quantum Physics").
*   **Auto-Grading**: Subjective short-answer questions are analyzed and graded by AI, providing instant score breakdown and feedback.

### 🔒 Anti-Cheat & Proctoring
*   **Fullscreen Enforcement**: Students must enter and stay in Fullscreen mode. Exiting triggers a violation.
*   **Tab-Switch Detection**: Monitors focus loss and tab visibility changes.
*   **Violation Threshold**: Automatically submits the exam with a score of **0** if violations exceed the limit (Default: 4).
*   **Webcam Monitoring**: Live video feed of the student during the exam.
*   **Copy/Paste Protection**: Right-click and clipboard shortcuts are disabled.
*   **Session Locking**: Logout is disabled during active exams.

### 👥 Role-Based Access Control
*   **Administrator**: Manages user credentials (creates Students and Instructors).
*   **Instructor**: Creates/Edits exams, manages publication status, views class analytics and individual student attempts.
*   **Student**: Joins sections via Instructor ID, takes exams, and views detailed results.

### ☁️ Cloud Architecture
*   **Serverless**: Built on **Google Firebase** (Firestore) for real-time data and authentication.
*   **Deployment**: Optimized for **Vercel** with Vite.

---

## 🛠️ Tech Stack

*   **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
*   **Database**: Google Firebase (Firestore)
*   **AI Engine**: Google Gemini API (`@google/genai`)
*   **Routing**: React Router DOM
*   **Icons/UI**: Phosphor Icons / Tailwind

---

## ⚙️ Installation & Local Setup

### Prerequisites
*   Node.js (v18 or higher)
*   A Google Cloud Project with **Firebase** enabled.
*   A **Google Gemini API Key** (from AI Studio).

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/proctor-ai.git
cd proctor-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory and add your keys:

```ini
# Google Gemini AI Key
API_KEY=your_gemini_api_key_here

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

### 4. Run the Application
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 📖 User Guide

### 🔑 First-Time Setup (Admin)
Since the app uses a custom auth system on Firestore, you must manually create the first Admin user in the Firebase Console:
1. Go to **Firestore Database** > `users` collection.
2. Add Document:
   * `id`: `admin-01`
   * `email`: `admin@proctor.com`
   * `password`: `admin123`
   * `role`: `ADMIN`
   * `name`: `Super Admin`

### 👨‍🏫 Instructor Workflow
1. Login and go to Dashboard.
2. Click **Create Exam**.
3. Use the **AI Generator** to create questions by topic, or add them manually.
4. Click **Publish**.
5. Share your **Classroom Code** (User ID) with students.

### 👩‍🎓 Student Workflow
1. Login.
2. Enter the **Instructor's ID** in the "Find Section" box.
3. Click **Start Exam**.
4. Allow Camera and Fullscreen permissions.
5. Complete the test without switching tabs.

---

## ☁️ Deployment

This project is configured for **Vercel**.

1. Push code to GitHub.
2. Import project in Vercel.
3. **CRITICAL**: Add all variables from your `.env` file to the Vercel Environment Variables settings.
4. Deploy.

---

## 📝 License
This project is open-source and available under the MIT License.
