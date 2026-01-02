// Firebase Configuration - React Native Firebase v22 Modular API
// Uses google-services.json automatically

import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';

// Get the default app (auto-initialized from google-services.json)
const app = getApp();
const auth = getAuth(app);
const firestore = getFirestore(app);

// Export Firebase services
export { auth, firestore };
