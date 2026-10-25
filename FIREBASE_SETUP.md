# Firebase setup for Chronos

The native Android alarm notifications work without Firebase. Cloud sync is enabled only when all Firebase web app configuration values are provided at build time.

## 1. Create/configure Firebase
1. Create a Firebase project at https://console.firebase.google.com/.
2. Add a Web app and copy its Firebase configuration.
3. In **Authentication → Sign-in method**, enable **Anonymous**.
4. In **Firestore Database**, create a database.
5. Publish the rules in `firestore.rules`.

## 2. Add GitHub Actions repository variables
Open the repository **Settings → Secrets and variables → Actions → Variables** and add these repository variables from the Firebase web app configuration:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

These are Firebase web-app client configuration values, not Admin SDK credentials. Never put a Firebase service-account private key in the app.

## 3. Build APK
Run the **Build Chronos Android APK** workflow from GitHub Actions. When all variables are set, the build embeds the Firebase configuration. If they are absent, the app keeps its data locally instead of cloud syncing.
