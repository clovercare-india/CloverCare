// Shared Firestore Service - React Native Firebase v22 Modular API
// Common database operations used by multiple roles

import { doc, getDoc, updateDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { firestore } from '../config/firebase';
import logger from '../utils/logger';

// ============================================
// USERS
// ============================================

export const getUserProfile = async (userId) => {
  if (!userId) return null;
  try {
    const docRef = doc(firestore, 'users', userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists ? docSnap.data() : null;
  } catch (error) {
    logger.error('firestore', 'Error getting user profile', error);
    throw error;
  }
};

/**
 * Get user's display name by UID
 * Resolves the current name from the user profile
 * Used for displaying resolver names in alerts
 */
export const getUserName = async (userId) => {
  if (!userId) return 'Unknown User';
  try {
    const docRef = doc(firestore, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Check for name fields in priority order
      return data.name || data.fullName || data.displayName || 'Unknown User';
    }
    return 'Unknown User';
  } catch (error) {
    logger.error('sharedFirestore', `Error fetching user name for ${userId}`, error);
    return 'Unknown User';
  }
};

export const updateUserProfile = async (userId, data) => {
  try {
    const docRef = doc(firestore, 'users', userId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    logger.error('firestore', 'Error updating user profile', error);
    return { success: false, error: error.message };
  }
};