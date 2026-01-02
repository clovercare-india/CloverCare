// Auth Context - Global Authentication State - React Native Firebase v22 Modular API
// Simple context for managing user authentication across the app

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import { Alert } from 'react-native';
import { getMessaging, onMessage } from '@react-native-firebase/messaging';
import { router } from 'expo-router';
import { getUserProfile } from '../services/auth';
import { auth } from '../config/firebase';
import { initializeNotifications, removeTokenFromFirestore, cleanupTokenRefreshListener } from '../services/notifications';
import logger from '../utils/logger';

// Create context
const AuthContext = createContext({});

// ============================================
// AUTH PROVIDER - Wraps the entire app
// ============================================
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Firebase auth user
  const [userProfile, setUserProfile] = useState(null); // Firestore user profile
  const [loading, setLoading] = useState(true); // Loading state

  // Listen to authentication state changes and setup foreground message handler
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const profileResult = await getUserProfile(firebaseUser.uid);

        if (profileResult.success && profileResult.exists) {
          setUserProfile(profileResult.profile);
          initializeNotifications(firebaseUser.uid).catch(err => {
            logger.error('AuthContext', 'Failed to initialize notifications', err);
          });
        } else {
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setTimeout(() => {
          router.replace('/');
        }, 100);
      }

      setLoading(false);
    });

    // Setup foreground message handler - shows alerts when app is open
    const unsubscribeMessage = onMessage(getMessaging(), async (remoteMessage) => {
      logger.info('AuthContext', 'Foreground notification received', {
        title: remoteMessage.notification?.title,
        body: remoteMessage.notification?.body,
        type: remoteMessage.data?.type,
        userRole: userProfile?.role
      });

      // Skip panic alert popups ONLY for SENIORS
      // Using data payload type field which is always present and reliable
      const isPanicAlert = remoteMessage.data?.type === 'panic_alert';
      
      // Only skip for seniors (when we know the role)
      if (isPanicAlert && userProfile?.role === 'senior') {
        logger.info('AuthContext', 'Skipping panic alert popup for senior');
        return; // Don't show popup for seniors
      }
      
      // For panic alerts when role isn't loaded yet, show the popup anyway
      // (safer to show it than to hide it for family/care managers)
      // The senior won't see it because they're the one who pressed the button

      // Show notification alert to user (for all other cases)
      Alert.alert(
        remoteMessage.notification?.title || 'Notification',
        remoteMessage.notification?.body || 'You have received a notification',
        [
          {
            text: 'OK',
            onPress: () => {
              // Optional: Navigate to alerts screen if data indicates so
              if (remoteMessage.data?.screen === 'alerts') {
                const role = remoteMessage.data?.role || userProfile?.role || 'family';
                router.push(`/${role}/alerts`);
              }
            }
          },
          {
            text: 'Dismiss',
            onPress: () => {
              // Dismiss without action
            }
          }
        ]
      );
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribe();
      unsubscribeMessage();
    };
  }, []);

  // Logout function
  const logout = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Remove notification token and cleanup listeners before signing out
        try {
          await removeTokenFromFirestore(currentUser.uid);
          cleanupTokenRefreshListener(currentUser.uid);
        } catch (err) {
          logger.error('AuthContext', 'Failed to cleanup notifications during logout', err);
        }
        await firebaseSignOut(auth);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      return { success: true };
    } catch (error) {
      logger.error('AuthContext', 'Error logging out', error);
      setUser(null);
      setUserProfile(null);
      return { success: true };
    }
  };

  // Refresh profile function - manually reload from Firestore
  const refreshProfile = async () => {
    if (!user?.uid) {
      return { success: false, error: 'No user logged in' };
    }

    try {
      const profileResult = await getUserProfile(user.uid);

      if (profileResult.success && profileResult.exists) {
        setUserProfile(profileResult.profile);
        return { success: true, profile: profileResult.profile };
      } else {
        setUserProfile(null);
        return { success: false, error: 'Profile not found' };
      }
    } catch (error) {
      logger.error('AuthContext', 'Error refreshing profile', error);
      return { success: false, error: error.message };
    }
  };

  // Context value
  const value = {
    user,
    userProfile,
    loading,
    logout,
    setUserProfile, // Allow manual profile updates
    refreshProfile, // Reload profile from Firestore
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ============================================
// CUSTOM HOOK - Use auth context easily
// ============================================
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  
  return context;
};

export default AuthContext;