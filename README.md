# App Name 🍀 - Complete Setup Guide

Welcome! This guide is designed for **non-technical users** to help you set up the entire system from scratch. Follow these steps carefully, and you'll have the app running in no time.

---

## 📖 Table of Contents
1. [What is This App?](#-what-is-this-app)
2. [Phase 1: Preparing Your Computer](#-phase-1-preparing-your-computer)
3. [Phase 2: Setting Up the Firebase "Brain"](#-phase-2-setting-up-the-firebase-brain)
4. [Phase 3: Connecting the App to Firebase](#-phase-3-connecting-the-app-to-firebase)
5. [Phase 4: Setting Up the Database (Firestore)](#-phase-4-setting-up-the-database-firestore)
6. [Phase 5: Setting Up Notifications (Cloud Functions)](#-phase-5-setting-up-notifications-cloud-functions)
7. [Phase 6: Running the App](#-phase-6-running-the-app)
8. [Phase 7: Creating a Real App File (EAS Build)](#-phase-7-creating-a-real-app-file-eas-build)
9. [🆘 Troubleshooting](#-troubleshooting)

---

## 🎯 What is This App?

This is a platform that connects **Seniors**, **Family Members**, and **Caregivers**. It helps track health, manage daily routines, and send emergency alerts.

---

## 💻 Phase 1: Preparing Your Computer

You need to install a few "tools" so your computer can build the app.

1.  **Node.js (The Engine)**: [Download the "LTS" version here](https://nodejs.org/). This runs the app's code.
2.  **Git (The Downloader)**: [Download here](https://git-scm.com/). This downloads the code from GitHub.
3.  **Android Studio (For Android)**: [Download here](https://developer.android.com/studio). 
    *   **Installation**: Run the installer and choose "Standard" setup.
    *   **SDK Setup**: Once installed, open it. It will ask to download "SDK Components". Let it finish.
    *   **Environment Variables**: (Important) You need to tell your computer where Android is. 
        *   *Windows*: Search for "Edit the system environment variables" → Environment Variables → Add `ANDROID_HOME` pointing to your Android SDK folder (usually `C:\Users\YourName\AppData\Local\Android\Sdk`).
4.  **Java (JDK 17)**: [Download here](https://adoptium.net/). Android needs this to work.
    *   *Tip*: After installing, open your terminal and type `java -version`. It should say version 17.
5.  **Visual Studio Code (The Editor)**: [Download here](https://code.visualstudio.com/). This is where you will see the code.

---

## 🧠 Phase 2: Setting Up the Firebase "Brain"

Firebase is a service by Google that handles your users, data, and notifications.

### 2.1 Create Your Project
1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Click the large **"+ Add Project"** button.
3.  **Step 1 of 3**: Type your desired project name (e.g., `My App Name`). Check the boxes to agree to terms and click **Continue**.
   > **📝 Note**: Remember this name - you'll reference it later in the setup.
4.  **Step 2 of 3**: (Optional) You can turn off Google Analytics for this project to make it faster. Click **Create Project**.
5.  Wait for the "Your new project is ready" message and click **Continue**.

### 2.2 Enable Phone Login (Authentication)
1.  In the left-hand sidebar, click on the **Build** menu.
2.  Click on **Authentication**.
3.  Click the **Get Started** button.
4.  Under the **Sign-in method** tab, you will see a list of providers. Click on **Phone**.
5.  Toggle the **Enable** switch to the right (it will turn blue).
6.  Click the **Save** button at the bottom.

### 2.3 Enable the Database (Firestore)
1.  In the left-hand sidebar, click on **Build** → **Firestore Database**.
2.  Click the **Create database** button.
3.  **Step 1: Database setup**: Select **"Start in test mode"**. This allows the app to read/write data without complex security rules during setup. Click **Next**.
4.  **Step 2: Location**: Choose a location closest to you (e.g., `nam5 (us-central)` or `asia-south1`). 
5.  Click **Enable**. Wait a few seconds for the database to be "provisioned".

### 2.4 Enable Notifications (Cloud Messaging)
1.  Look at the top left of the screen, next to "Project Overview". Click the **Gear icon (⚙️)** and select **Project settings**.
2.  Click on the **Cloud Messaging** tab at the top.
3.  Look for **Firebase Cloud Messaging API (V1)**. It should say "Enabled". 
4.  *Note: If you see "Cloud Messaging API (Legacy)", you can ignore it. We use the modern V1 API.*

---

## 🔌 Phase 3: Connecting the App to Firebase

Now we need to tell the app which Firebase project to use.

### 3.1 For Android
1.  In Firebase, on the left side click on the gear icon which is **Project Settings** → **General**.
2.  Under "Your apps", click the **Android icon**.
3.  **Package Name**: Enter `com.yourcompany.appname` (e.g., `com.mycompany.appname`).
   > **⚠️ CRITICAL**: This package name **MUST exactly match** the `android.package` field in your `frontend/app.json` file. Any mismatch will cause Firebase connection to fail.
4.  Click **Register App** and download the `google-services.json` file.
5.  **Generate Android native folders** (first-time setup):
    ```bash
    cd frontend
    npx expo prebuild --platform android
    ```
    This will create the `android/` folder structure (it's gitignored, so you need to generate it locally).
6.  **Crucial Step**: Copy the downloaded `google-services.json` file into these TWO locations:
    *   `frontend/google-services.json`
    *   `frontend/android/app/google-services.json`

### 3.2 For iOS (Mac Users Only)
1.  Click **Add App** → **iOS icon**.
2.  **Bundle ID**: Enter `com.yourcompany.appname` (e.g., `com.mycompany.eldercare`).
   > **⚠️ CRITICAL**: This bundle ID **MUST exactly match** the `ios.bundleIdentifier` field in your `frontend/app.json` file.
3.  Download `GoogleService-Info.plist` and put it in the `frontend/` folder.

---

## 🗄️ Phase 4: Setting Up the Database (Firestore)

For the app to search data quickly (like finding a senior's health logs or checking pending tasks), we need to create **Composite Indexes**. Without these, the app will show an error when trying to load data.

### 4.1 How to Create an Index Manually
1.  Go to your [Firebase Console](https://console.firebase.google.com/).
2.  In the left sidebar, click **Build** → **Firestore Database**.
3.  Click on the **Indexes** tab at the top of the page.
4.  Click the **"+ Create Index"** button.
5.  For each row in the table below, follow these steps:
    *   **Collection ID**: Type the name exactly (e.g., `healthLogs`).
    *   **Fields to index**: Add the fields one by one.
    *   **Query scope**: Leave it as **"Collection"**.
    *   Click **Create Index**.

### 4.2 The Index Table
Add these **6 indexes** exactly as shown:

| Collection ID | Field 1 | Field 2 |
| :--- | :--- | :--- |
| `users` | `linkedFamily` (Arrays) | `role` (Ascending) |
| `healthLogs` | `seniorId` (Ascending) | `createdAt` (Descending) |
| `alerts` | `seniorId` (Ascending) | `createdAt` (Descending) |
| `reminders` | `userId` (Ascending) | `status` (Ascending) |
| `carerTasks` | `userId` (Ascending) | `status` (Ascending) |
| `serviceRequests` | `userId` (Ascending) | `status` (Ascending) |

### 4.3 The "Easy Way" (Automatic Creation)
If you run the app and it crashes or fails to load data:
1.  Look at the **Terminal** (the black window where you ran the app).
2.  You will see a long error message starting with `The query requires an index...`.
3.  Inside that message, there is a **blue link** starting with `https://console.firebase.google.com/...`.
4.  **Click that link**. It will take you directly to the Firebase Console with all the fields already filled in!
5.  Just click **Create Index** and wait for it to finish.

### 4.4 Security Rules (Crucial for Privacy)
By default, Firestore is open to everyone. You must add security rules to protect senior data.

1.  Go to **Firestore Database** → **Rules** tab.
2.  Delete everything there and copy the entire content from the `frontend/firestore.rules` file in your project folder.
3.  Click **Publish**.

**What these rules do:**
*   **Seniors**: Can only see their own data and alerts.
*   **Family**: Can only see data for seniors they are linked to via the `linkedFamily` array.
*   **Care Managers**: Can only see data for seniors assigned to them via the `careManagerId` field.
*   **Admins**: Have full access to manage the entire system.

**Important Notes:**
*   After publishing the rules, **you must wait 1-2 minutes** for them to take effect globally.
*   If you get a "Permission Denied" error in the app after setting up rules:
    1.  Check that your user profile has the correct `role` field (`senior`, `family`, or `caremanager`).
    2.  For family members, ensure the senior's `linkedFamily` array contains your user ID.
    3.  For care managers, ensure the senior's `careManagerId` field matches your user ID.

*Note: Indexes take about 2-5 minutes to "Build". You can see the progress bar in the Indexes tab.*

---

## 🔔 Phase 5: Setting Up Notifications (Cloud Functions)

This part makes sure family members get a notification when a senior presses the Panic Button.

1.  **Install Firebase Tools**: Open your terminal and type:
    ```bash
    npm install -g firebase-tools
    ```
2.  **Login**: Type `firebase login` and follow the steps in your browser.
3.  **Initialize**: Go to the root folder of the project in your terminal and type:
    ```bash
    firebase init functions
    ```
    *   Choose **"Use an existing project"**.
    *   Select your Firebase project (the one you created in Phase 2).
    *   When asked about language, choose **JavaScript**.
4.  **Deploy**: Type this command to send the notification code to Google:
    ```bash
    firebase deploy --only functions
    ```

---

## 🎮 Phase 6: Running the App

Now for the exciting part!

1.  **Open Terminal** in the `frontend` folder.
2.  **Install Packages**:
    ```bash
    npm install --legacy-peer-deps
    ```
3.  **Run on Android**:
    #### 📱 Step A: Setup your Virtual Phone (Emulator)
    If you don't have a physical Android phone, you need a virtual one:
    1.  Open **Android Studio**.
    2.  On the Welcome screen (or under the "More Actions" menu), click **Virtual Device Manager** (or Device Manager).
    3.  Click **Create Device**.
    4.  Select a phone (e.g., **Pixel 7**) and click **Next**.
    5.  Choose a "System Image" (the Android version). Look for **"Tiramisu" (Android 13)** or **"UpsideDownCake" (Android 14)**. Click the download icon next to it if it's not downloaded.
    6.  Once downloaded, select it and click **Next**.
    7.  Give it a name (like "My Test Phone") and click **Finish**.
    8.  Now, click the **Play button (triangle)** next to your new device to start the phone!

    #### 🚀 Step B: Launch the App
    1.  Once the virtual phone is fully "turned on" and showing the home screen:
    2.  Go back to your terminal (in the `frontend` folder).
    3.  Type: `npx expo run:android`
    4.  Wait for about 2-5 minutes (the first time takes a while). The app will automatically install and open on the virtual phone.

4.  **Run on iPhone (Mac Only)**:
    *   Type: `npx expo run:ios`

---

## 📦 Phase 7: Creating a Real App File (EAS Build)

If you want to create an `.apk` or `.aab` file to install on a real phone or upload to the Play Store, we use **EAS Build**.

### 7.1 Install EAS Tools
Open your terminal and type:
```bash
npm install -g eas-cli
```

### 7.2 Login to Expo
You need an Expo account. [Create one here](https://expo.dev/signup) if you don't have one.
```bash
eas login
```

### 7.3 Configure the Build
In the `frontend` folder, run:
```bash
eas build:configure
```
*   When asked "Which platforms would you like to configure?", choose **All**.

### 7.4 Customizing Your App (app.json & eas.json)
If you want to change the app's name, icon, or build settings, you need to edit these two files in the `frontend` folder:

#### 1. `app.json` (The Identity)
This file controls how your app looks and is identified.
```json
{
  "expo": {
    "name": "My App Name",
    "slug": "myappname",
    "version": "1.0.0",
    "icon": "./assets/logo.png",
    "android": {
      "package": "com.yourcompany.appname",
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "bundleIdentifier": "com.yourcompany.appname"
    }
  }
}
```
*   **`name`**: Change this to change the name shown on the phone's home screen (e.g., "Elder Care").
*   **`slug`**: This is the internal name for Expo (no spaces, lowercase recommended).
*   **`version`**: Change this (e.g., `1.0.1`) when you release an update.
*   **`icon`**: Point this to a new image file in the `assets` folder to change the app icon.
*   **`package`** (Android): **MUST exactly match** the Package Name you entered in Firebase (Phase 3.1).
*   **`bundleIdentifier`** (iOS): **MUST exactly match** the Bundle ID you entered in Firebase (Phase 3.2).

> **⚠️ CRITICAL MATCHING REQUIREMENT**: The `android.package` and `ios.bundleIdentifier` values here MUST be identical to what you registered in Firebase. If they don't match, your app won't connect to Firebase and authentication/database will fail.

#### 2. `eas.json` (The Build Rules)
This file tells Expo *how* to build your app.
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```
*   **`development`**: Used for testing while you code.
*   **`preview`**: Used to create an **APK** file that you can send to friends to test.
*   **`production`**: Used when you are ready to upload to the Google Play Store or Apple App Store.

### 7.5 Start the Build
To create an Android app file (APK) that you can send to your phone:
```bash
eas build --platform android --profile preview
```
*   **Note**: This will upload your code to Expo's servers and build it there. It can take 10-20 minutes.
*   Once finished, it will give you a **Download Link** or a **QR Code** to install the app on your phone!

### 7.6 Add SHA Keys to Firebase (Important for Phone authentication)
After your EAS build completes, you need to add the **SHA-1 and SHA-256 fingerprints** to Firebase. These are security keys that prove the app is legitimate.

#### Step A: Get the SHA Keys from Your Build
1.  After your EAS build completes, go to [Expo EAS Build Dashboard](https://expo.dev/builds)
2.  Find your completed build and click on it
3.  Look for the **Projects settings -> "Credentials"** section
4.  You should see the **SHA-1** and **SHA-256** fingerprints displayed
5.  Copy both values

#### Step B: Add Keys to Firebase
1.  Go to [Firebase Console](https://console.firebase.google.com/)
2.  Select your project
3.  Go to **Project Settings** → **General**
4.  Scroll down to **"Your apps"** section
5.  Click on your **Android app**
6.  Scroll down to **"SHA certificate fingerprints"**
7.  Click **"Add fingerprint"**
8.  Paste your **SHA-1** fingerprint and click **Save**
9.  Click **"Add fingerprint"** again
10. Paste your **SHA-256** fingerprint and click **Save**

> **Important**: Without adding these SHA keys, **Phone authentication will fail** in your production app. The app will open but authentication won't work.

---

## 🆘 Troubleshooting

### 1. "google-services.json is missing"
*   **Fix**: You forgot to put the file in `frontend/android/app/google-services.json`. Go back to Phase 3.

### 2. "Build Failed" or "Gradle Error"
*   **Fix**: This usually happens if Java is not installed correctly. Type `java -version` in your terminal to check. It should say version 17 or higher.

### 3. "App opens but I can't log in"
*   **Fix**: Make sure you enabled **Phone Authentication** in the Firebase Console (Phase 2).

### 4. "Notifications aren't working"
*   **Fix**: Ensure you successfully ran `firebase deploy --only functions` in Phase 5.

### 5. "Permission Denied" after adding security rules
*   **Fix**: Wait 1-2 minutes for the rules to propagate. Then check:
    *   Your user profile in Firestore has a `role` field (`senior`, `family`, or `caremanager`).
    *   If you're a family member, the senior's profile has your user ID in the `linkedFamily` array.
    *   If you're a care manager, the senior's profile has your user ID in the `careManagerId` field.

### 6. "Index Required" error
*   **Fix**: Click the blue link in the terminal error message. It will take you directly to Firebase to create the missing index automatically.