# Firebase setup for Chronos
Native Android alarm notifications work without Firebase. Cloud sync is enabled only when all Firebase web app configuration values are provided at build time.

1. Create a Firebase project at https://console.firebase.google.com/ and add a Web app.
2. In Firebase Authentication → Sign-in method, enable Anonymous.
3. Create a Firestore database and publish the rules in `firestore.rules`.
4. In GitHub repository Settings → Secrets and variables → Actions → Variables, add these variables from the Firebase web app config: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
5. Run the Build Chronos Android APK workflow. If these variables are absent, the app uses local storage instead of cloud sync.

These are client web configuration values. Never put a Firebase Admin SDK service-account private key in the app.
