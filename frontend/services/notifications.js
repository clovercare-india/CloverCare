// Notification Service - Simple FCM Implementation
import { getMessaging, requestPermission, getToken, onTokenRefresh, AuthorizationStatus } from '@react-native-firebase/messaging';
import { doc, arrayUnion, arrayRemove, getDoc, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { firestore } from '../config/firebase';
import logger from '../utils/logger';

export const requestNotificationPermission = async () => {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Notification Permission',
          message: 'Clover Care needs notification permission to send you important alerts about your seniors.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );
      
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        logger.warn('notifications', 'Android notification permission denied');
        Alert.alert(
          'Notifications Disabled',
          'You will not receive important alerts. You can enable notifications in Settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    
    const authStatus = await requestPermission(getMessaging());
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;
    
    return enabled;
  } catch (error) {
    logger.error('notifications', 'Failed to request permission', error);
    return false;
  }
};

export const getFCMToken = async () => {
  try {
    const token = await getToken(getMessaging());
    return token;
  } catch (error) {
    logger.error('notifications', 'Failed to get FCM token', error);
    return null;
  }
};

export const saveTokenToFirestore = async (userId, token) => {
  try {
    if (!userId || !token) return false;
    
    const userRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    // Allow saving token even if profile is just being created
    // Just check if the user document exists (even if minimal)
    if (!userDoc.exists) {
      logger.warn('notifications', `User document does not exist for ${userId}`);
      return false;
    }
    
    const userData = userDoc.data() || {};
    const existingTokens = userData.deviceTokens || [];
    
    // Avoid duplicate tokens
    if (!existingTokens.includes(token)) {
      await setDoc(userRef, {
        deviceTokens: arrayUnion(token),
        lastTokenUpdate: new Date()
      }, { merge: true });
      logger.info('notifications', `Token saved successfully for user ${userId}`);
    } else {
      logger.info('notifications', `Token already exists for user ${userId}`);
    }
    return true;
  } catch (error) {
    logger.error('notifications', 'Failed to save token to Firestore', error);
    return false;
  }
};

/**
 * Remove FCM token from user's Firestore document
 * Used during logout to stop receiving notifications on this device
 */
export const removeTokenFromFirestore = async (userId) => {
  try {
    if (!userId) return false;
    
    const token = await getFCMToken();
    if (!token) return false;
    
    const userRef = doc(firestore, 'users', userId);
    
    // Check if user document exists before updating
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists) {
      logger.warn('notifications', `User document not found for ${userId}`);
      return false;
    }
    
    await updateDoc(userRef, {
      deviceTokens: arrayRemove(token)
    });
    
    logger.info('notifications', `Removed token for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('notifications', 'Failed to remove token from Firestore', error);
    return false;
  }
};

// Track registered token refresh listeners to prevent duplicates
const tokenRefreshListeners = new Map();

/**
 * Initialize notifications with retry logic
 * Handles new users and prevents duplicate listener registration
 */
export const initializeNotifications = async (userId) => {
  try {
    if (!userId) return false;
    
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return false;
    
    const token = await getFCMToken();
    if (!token) return false;
    
    // Retry logic: Try up to 3 times with exponential backoff
    let retries = 3;
    let tokenSaved = false;
    
    while (retries > 0 && !tokenSaved) {
      tokenSaved = await saveTokenToFirestore(userId, token);
      if (!tokenSaved) {
        retries--;
        if (retries > 0) {
          // Exponential backoff: 500ms, 1000ms
          const waitTime = (4 - retries) * 500;
          logger.info('notifications', `Token save failed, retrying in ${waitTime}ms... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    if (!tokenSaved) {
      logger.warn('notifications', `Failed to save token after 3 retries for user ${userId}`);
      // Continue anyway - user might still receive notifications
    }
    
    // Prevent duplicate listeners for the same user
    if (tokenRefreshListeners.has(userId)) {
      logger.info('notifications', `Token refresh listener already registered for user ${userId}`);
      return true;
    }
    
    // Register token refresh listener (only once per user)
    const unsubscribe = onTokenRefresh(getMessaging(), async (newToken) => {
      logger.info('notifications', `Token refreshed for user ${userId}`);
      await saveTokenToFirestore(userId, newToken);
    });
    
    // Store unsubscribe function for cleanup
    tokenRefreshListeners.set(userId, unsubscribe);
    
    return true;
  } catch (error) {
    logger.error('notifications', 'Failed to initialize notifications', error);
    return false;
  }
};

/**
 * Cleanup token refresh listener when user logs out
 */
export const cleanupTokenRefreshListener = (userId) => {
  if (tokenRefreshListeners.has(userId)) {
    const unsubscribe = tokenRefreshListeners.get(userId);
    unsubscribe();
    tokenRefreshListeners.delete(userId);
    logger.info('notifications', `Cleaned up token refresh listener for user ${userId}`);
  }
};
