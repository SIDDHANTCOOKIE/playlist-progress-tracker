# PlaylistTrack 🎧📚

PlaylistTrack is a focused YouTube playlist tracker built for learners. Create multiple playlists, import YouTube playlists, track progress video by video, write notes, and maintain a daily learning streak. Everything is stored locally in your browser, no login required.

---

## ✨ Features

- Multi playlist dashboard with progress cards  
- Import YouTube playlists including title, videos, duration, and thumbnail  
- Track progress per playlist and per video  
- Write notes for each video with download support  
- Daily streak tracking with best streak tooltip  
- Responsive YouTube player with sidebar and stats  
- Theme selector for personalization  
- Fully local storage based, no backend required  

---

## 🛠 Tech Stack

- React  
- Tailwind CSS  
- YouTube Data API v3  
- YouTube IFrame Player API  
- LocalStorage  

---

## 🚀 Local Setup

Follow these steps to run the project locally.

---

### 1. Install prerequisites

Make sure you have the following installed:

- Node.js 18 or higher  
- Git  

Check versions:

```bash
node -v
npm -v
git --version
 ```
---

### 2. Clone the repository

Clone the repository using Git:

```bash
git clone https://github.com/YOURUSERNAME/playlist-progress-tracker/settings
cd playlist-progress-tracker
```

### 3. Install dependencies
npm install

### 4. Set up YouTube API key

You need a YouTube Data API v3 key to import playlists.

Option A: Using .env file (recommended)

Create a file named .env in the project root and add:

REACT_APP_YOUTUBE_API_KEY=your_api_key_here


Restart the development server after adding the key.

### 5. Start the development server
npm start


The app will run at:

http://localhost:3000

