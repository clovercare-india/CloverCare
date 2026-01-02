# 🍀 Clover Care Admin CMS - Complete Setup Guide

A professional admin panel built with **FireCMS** for managing the Clover Care eldercare system. This web application provides administrators with a comprehensive interface to manage seniors, families, care managers, tasks, routines, reminders, and system alerts in real-time.

---

## 📖 Table of Contents
1. [What is This Admin CMS?](#-what-is-this-admin-cms)
2. [Key Features](#-key-features)
3. [Prerequisites](#-prerequisites)
4. [Phase 1: Setting Up Your Development Environment](#-phase-1-setting-up-your-development-environment)
5. [Phase 2: Configuring Firebase](#-phase-2-configuring-firebase)
6. [Phase 3: Installing Dependencies](#-phase-3-installing-dependencies)
7. [Phase 4: Setting Up Environment Variables](#-phase-4-setting-up-environment-variables)
8. [Phase 5: Creating Admin Users](#-phase-5-creating-admin-users)
9. [Phase 6: Running the Application](#-phase-6-running-the-application)
10. [Phase 7: Building for Production](#-phase-7-building-for-production)
11. [Phase 8: Deployment Options](#-phase-8-deployment-options)
12. [Troubleshooting](#-troubleshooting)

---

## 🎯 What is This Admin CMS?

The Clover Care Admin CMS is a secure web dashboard that allows administrators to:
- **Manage Users**: View and edit seniors, family members, and care managers
- **Monitor Alerts**: Track panic button alerts, health alerts, and emergency notifications in real-time
- **Organize Care**: Manage daily routines, tasks, reminders, and check-ins
- **Oversee Operations**: Access comprehensive analytics and user activity logs
- **Maintain Security**: Role-based access control ensures only authorized admins can access the system

This is built using **FireCMS v3**, **React 18**, **TypeScript**, and **Firebase**.

---

## ✨ Key Features

### 🔐 Authentication & Security
- **Google OAuth 2.0**: Secure single sign-on using Google accounts
- **Role-Based Access Control**: Only users with `admin` role in Firestore can access the panel
- **Session Management**: Automatic session handling with Firebase Authentication

### 📊 Collections Management

#### 1. **All Users Collection**
- Unified view of all users (seniors, families, care managers, admins)
- Role filtering and search capabilities
- Status tracking (active, inactive, suspended)

#### 2. **Seniors Management**
- Comprehensive profile management with health information
- Care manager assignments and family linkages
- Medical conditions, medications, and emergency contacts
- Profile images and document uploads

#### 3. **Family Members Management**
- Family account management and senior relationships
- Notification preferences and contact information
- Access permissions and relationship tracking

#### 4. **Care Managers Management**
- Professional profiles with certifications
- Senior assignment tracking
- Work schedules, availability, and performance metrics
- Onboarding status and documentation

#### 5. **Alerts Management**
- Real-time monitoring of all system alerts
- Panic button, health, medication, and routine alerts
- Response time tracking and resolution logs
- Action history and escalation management

#### 6. **Tasks & Routines**
- Create and manage care tasks for seniors
- Daily, weekly, and custom routine schedules
- Task assignment and completion tracking
- Automated reminders and notifications

#### 7. **Reminders Management**
- Medication reminders with dosage tracking
- Appointment reminders
- Activity reminders and notifications
- Recurring reminder scheduling

### 🎨 Custom Dashboard Views
- **Welcome Dashboard**: Quick stats and recent activity overview
- **Senior Profiles**: Detailed individual senior information
- **Care Manager Profiles**: Professional information and assignments
- **Family Profiles**: Relationship mapping and contact details
- **Admin Management**: Create and manage other admin users

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your system:

1. **Node.js** (v20 or later): [Download LTS version](https://nodejs.org/)
   - Verify installation: `node --version`
   - Should show v20.x.x or higher

2. **npm** (comes with Node.js) or **yarn**:
   - npm verify: `npm --version`
   - yarn install (optional): `npm install -g yarn`

3. **Git**: [Download here](https://git-scm.com/)
   - Verify: `git --version`

4. **Visual Studio Code** (recommended): [Download here](https://code.visualstudio.com/)
   - Or any code editor of your choice

5. **A Google Account**: Required for Firebase and admin authentication

6. **Firebase Project**: Must be the same project used by your Clover Care mobile app

---

## 💻 Phase 1: Setting Up Your Development Environment

### Step 1.1: Clone the Repository

```bash
# Navigate to your desired directory
cd ~/Desktop/coding/labs

# Clone the repository (if not already cloned)
git clone https://github.com/your-org/eldercare.git

# Navigate to the admin-cms directory
cd eldercare/admin-cms
```

### Step 1.2: Open in Your Code Editor

```bash
# If using VS Code
code .
```

---

## 🧠 Phase 2: Configuring Firebase

### Step 2.1: Access Your Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your existing **Clover Care** project (the same one used by the mobile app)

> **⚠️ Important**: The Admin CMS must use the **same Firebase project** as your mobile app to access the same data.

### Step 2.2: Enable Google Sign-In (Authentication)

1. In the Firebase Console, click **Build** → **Authentication**
2. Go to the **Sign-in method** tab
3. Find **Google** in the list of providers
4. Click on **Google** and toggle **Enable**
5. **Add Authorized Domain** (if deploying):
   - Add your domain (e.g., `admin.clovercare.com` or `localhost` for local dev)
6. Click **Save**

### Step 2.3: Get Firebase Configuration

1. In Firebase Console, click the **⚙️ (gear icon)** → **Project settings**
2. Scroll down to **Your apps** section
3. If you don't have a web app registered:
   - Click **Add app** → **Web icon (</>)**
   - Give it a nickname (e.g., "Clover Care Admin CMS")
   - Click **Register app**
4. Copy the Firebase configuration values - you'll need:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
   - `measurementId` (if Analytics enabled)

### Step 2.4: Verify Firestore Database

1. In Firebase Console, click **Build** → **Firestore Database**
2. Ensure your database is already set up with collections:
   - `users`
   - `seniors`
   - `families`
   - `careManagers`
   - `alerts`
   - `tasks`
   - `routines`
   - `reminders`

> **Note**: These should already exist if you've been using the mobile app. If not, they will be created automatically when data is added.

---

## 📦 Phase 3: Installing Dependencies

### Step 3.1: Install Node Modules

```bash
# Using npm
npm install

# OR using yarn (if you prefer)
yarn install
```

This will install all required packages including:
- `@firecms/core` - Core FireCMS framework
- `@firecms/firebase` - Firebase integration
- `firebase` - Firebase SDK
- `react` & `react-dom` - React framework
- `@mui/material` - Material-UI components
- And other dependencies

**Installation time**: 2-5 minutes depending on your internet speed

---

## 🔑 Phase 4: Setting Up Environment Variables

### Step 4.1: Create Environment File

```bash
# Copy the example file
cp .env.example .env
```

### Step 4.2: Edit the .env File

Open the `.env` file in your editor and fill in your Firebase configuration:

```bash
# Vite Environment Variables (for client-side)
VITE_FIREBASE_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
VITE_FIREBASE_MEASUREMENT_ID=G-ABCDEFGHIJ

# Node.js Environment Variables (for server-side scripts like create-admin.js)
FIREBASE_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
FIREBASE_MEASUREMENT_ID=G-ABCDEFGHIJ
```

**Replace** the placeholder values with your actual Firebase configuration from Phase 2.3.

> **🔒 Security Note**: Never commit the `.env` file to version control. It's already in `.gitignore`.

---

## 👤 Phase 5: Creating Admin Users

To access the Admin CMS, you need at least one user with `role: "admin"` in your Firestore `users` collection.

### Method A: Using the Automated Script (Recommended)

We provide a convenient Node.js script that creates admin users automatically.

#### Step 5.1: Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **⚙️ (gear icon)** → **Project settings**
3. Go to the **Service Accounts** tab
4. Click **Generate New Private Key**
5. A JSON file will download - **save it as `serviceAccountKey.json`**
6. Move this file to the `admin-cms` directory

```bash
# Example: Move the downloaded file
mv ~/Downloads/your-project-firebase-adminsdk-xxxxx.json ./serviceAccountKey.json
```

> **🔒 Security Warning**: This file contains sensitive credentials. **Never commit it to Git**. It's already in `.gitignore`.

#### Step 5.2: Run the Admin Creation Script

**Interactive Mode** (Recommended for first-time users):
```bash
node create-admin.js
```

The script will prompt you for:
- Email address (must be a valid Google account)
- Full name
- Phone number (optional)

**Command-Line Mode** (Quick setup):
```bash
node create-admin.js admin@example.com "John Doe" "+1234567890"
```

#### Step 5.3: Verify Admin User

1. Go to Firebase Console → **Firestore Database**
2. Open the `users` collection
3. Find your user document - it should have:
   ```json
   {
     "email": "admin@example.com",
     "name": "John Doe",
     "phone": "+1234567890",
     "role": "admin",
     "status": "active",
     "userId": "auto-generated-id",
     "createdAt": "timestamp",
     "updatedAt": "timestamp"
   }
   ```

### Method B: Manual Creation in Firestore

If you prefer to create admin users manually:

1. Go to Firebase Console → **Firestore Database**
2. Open the `users` collection (create if it doesn't exist)
3. Click **Add document**
4. Use **Auto-ID** for document ID
5. Add these fields:
   - `email` (string): `admin@example.com`
   - `name` (string): `Admin Name`
   - `role` (string): `admin`
   - `status` (string): `active`
   - `userId` (string): Same as document ID
   - `createdAt` (timestamp): Current time
   - `updatedAt` (timestamp): Current time
6. Click **Save**

> **⚠️ Critical**: The email must exactly match the Google account you'll use to sign in.

---

## 🚀 Phase 6: Running the Application

### Step 6.1: Start Development Server

```bash
# Using npm
npm run dev

# OR using yarn
yarn dev
```

You should see output like:
```
  VITE v5.x.x  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Step 6.2: Open in Browser

1. Open your browser and go to: **http://localhost:5173**
2. You should see the Clover Care Admin CMS login page

### Step 6.3: Sign In

1. Click **"Sign in with Google"**
2. Choose your Google account (the one you used when creating the admin user)
3. Grant necessary permissions
4. If your account has `role: "admin"` in Firestore, you'll be redirected to the dashboard
5. If not, you'll see an "Access Denied" message

### Step 6.4: Explore the Dashboard

Once logged in, you can:
- View the **Welcome Dashboard** with system statistics
- Navigate to **All Users**, **Seniors**, **Families**, **Care Managers**
- Monitor **Alerts** in real-time
- Manage **Tasks**, **Routines**, and **Reminders**
- Access individual user profiles for detailed information

---

## 🏗️ Phase 7: Building for Production

### Step 7.1: Create Production Build

```bash
# Using npm
npm run build

# OR using yarn
yarn build
```

This will:
1. Compile TypeScript to JavaScript
2. Bundle and optimize React code
3. Minify CSS and assets
4. Generate static files in the `build/` directory

**Build time**: 30 seconds to 2 minutes

### Step 7.2: Preview Production Build Locally

```bash
npm run preview
# or
yarn preview
```

This serves the production build at `http://localhost:4173` for testing.

## 🆘 Troubleshooting

### Issue 1: "Access Denied" After Signing In

**Cause**: Your user doesn't have `role: "admin"` in Firestore.

**Solution**:
1. Go to Firebase Console → Firestore Database → `users` collection
2. Find your user by email
3. Edit the document and add/change: `role: "admin"`
4. Sign out and sign in again

### Issue 2: Firebase Configuration Error

**Symptom**: "Firebase: No Firebase App '[DEFAULT]' has been created"

**Solution**:
1. Check that `.env` file exists in `admin-cms/` directory
2. Verify all `VITE_FIREBASE_*` variables are set correctly
3. Restart the dev server: `npm run dev`

### Issue 3: "Module not found" Errors

**Cause**: Dependencies not installed properly.

**Solution**:
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue 4: Build Fails with TypeScript Errors

**Solution**:
```bash
# Skip TypeScript checking during build (emergency)
SKIP_TSC=true npm run build

# Or fix TypeScript errors (recommended)
npm run build
# Read the errors and fix them in the source code
```

### Issue 5: Can't Create Admin User (Script Fails)

**Symptom**: "Firebase Admin SDK credentials not found!"

**Solution**:
1. Ensure `serviceAccountKey.json` exists in `admin-cms/` directory
2. Verify the file is valid JSON (open it in a text editor)
3. Make sure `.env` has correct Firebase config for the Node.js variables

### Issue 6: Port 5173 Already in Use

**Solution**:
```bash
# Kill the process using port 5173
lsof -ti:5173 | xargs kill -9

# Or use a different port
npm run dev -- --port 3000
```

### Issue 7: Firebase Hosting Deploy Fails

**Symptom**: "HTTP Error: 404, Could not find site"

**Solution**:
1. Check that `firebase.json` has the correct `site` field
2. Run `firebase use --add` to select the correct project
3. Verify project ID matches: `firebase projects:list`

---

## 📁 Project Structure

```
admin-cms/
├── public/                   # Static assets
│   ├── 404.html             # 404 error page
│   ├── manifest.json        # PWA manifest
│   └── robots.txt           # SEO robots file
├── src/
│   ├── collections/         # Firestore collection schemas
│   │   ├── allUsers.tsx     # All users (unified view)
│   │   ├── seniors.tsx      # Seniors management
│   │   ├── families.tsx     # Family members
│   │   ├── careManagers.tsx # Care managers
│   │   ├── alerts.tsx       # System alerts
│   │   ├── carerTasks.tsx   # Care tasks
│   │   ├── routines.tsx     # Daily routines
│   │   └── reminders.tsx    # Reminders
│   ├── components/
│   │   ├── admin/           # Custom admin views
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Alerts.tsx
│   │   │   ├── Seniors.tsx
│   │   │   ├── SeniorProfile.tsx
│   │   │   ├── CareManagers.tsx
│   │   │   ├── CareManagerProfile.tsx
│   │   │   ├── Family.tsx
│   │   │   ├── FamilyProfile.tsx
│   │   │   ├── Admins.tsx
│   │   │   ├── AdminProfile.tsx
│   │   │   └── CMSWelcome.tsx
│   │   └── common/          # Shared components
│   ├── contexts/
│   │   └── FilterContext.tsx # Global filter state
│   ├── utils/
│   │   ├── logger.ts        # Logging utility
│   │   └── validation.ts    # Form validation
│   ├── App.tsx              # Main application component
│   ├── firebase_config.ts   # Firebase configuration
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
├── create-admin.js          # Admin user creation script
├── Dockerfile               # Docker configuration
├── firebase.json.example    # Firebase hosting config template
├── nginx.conf               # Nginx configuration (for Docker)
├── package.json             # Dependencies and scripts
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite bundler configuration
└── README.md                # This file
```

---

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start dev server (http://localhost:5173)

# Production
npm run build            # Build for production (outputs to build/)
npm run preview          # Preview production build locally

# Deployment
npm run deploy           # Build + deploy to Firebase Hosting

# Admin Management
node create-admin.js     # Create admin users interactively
```

---

## 🛡️ Security Best Practices

1. **Environment Variables**: Never commit `.env` or `serviceAccountKey.json`
2. **Admin Role**: Only grant `admin` role to trusted users
3. **Firestore Rules**: Ensure your Firestore security rules restrict admin operations
4. **HTTPS Only**: Always use HTTPS in production (Firebase Hosting does this automatically)
5. **Regular Audits**: Review admin user list regularly and remove inactive admins

Example Firestore Security Rule for `users` collection:
```javascript
match /users/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && 
                  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

---

## 📊 Technology Stack

- **Framework**: React 18.3 + TypeScript 5.7
- **UI Library**: FireCMS 3.0 (Community Edition)
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Styling**: Material-UI 7.3 + Tailwind CSS 3.4
- **Build Tool**: Vite 5.x
- **Deployment**: Firebase Hosting / Docker + Nginx
- **State Management**: React Context API
- **Icons**: Lucide React + Material Icons

---

## 🤝 Support & Resources

- **FireCMS Documentation**: [https://firecms.co/docs](https://firecms.co/docs)
- **Firebase Documentation**: [https://firebase.google.com/docs](https://firebase.google.com/docs)
- **React Documentation**: [https://react.dev](https://react.dev)
- **FireCMS Discord Community**: [https://discord.gg/fxy7xsQm3m](https://discord.gg/fxy7xsQm3m)

---

## 📝 Version History

- **v1.0.0** (Current)
  - Initial release with FireCMS v3
  - Google OAuth authentication with role-based access
  - Complete CRUD operations for all collections
  - Custom dashboard views and analytics
  - Docker support for containerized deployment

---

## 📄 License

This project is part of the Clover Care eldercare management system.

---

**Built with ❤️ for Clover Care using FireCMS Community Edition**
