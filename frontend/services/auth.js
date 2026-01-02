// Authentication Service
// React Native Firebase Phone Authentication for Clover Care

import { 
  signInWithPhoneNumber, 
  PhoneAuthProvider, 
  signInWithCredential,
  signOut as firebaseSignOut 
} from '@react-native-firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from '@react-native-firebase/firestore';
import { auth, firestore } from '../config/firebase';
import logger from '../utils/logger';
import { getTempData, clearTempData } from '../utils/tempStorage';
import { removeTokenFromFirestore } from './notifications';

// ============================================
// 1. SEND OTP - Send verification code to phone
// ============================================
export const sendOTP = async (phoneNumber) => {
  try {
    if (!phoneNumber) {
      return {
        success: false,
        error: 'Phone number is required'
      };
    }

    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber);

    return {
      success: true,
      confirmationResult: confirmationResult,
      message: 'OTP sent successfully'
    };

  } catch (error) {
    logger.error('auth', `Failed to send OTP to ${phoneNumber}`, error);
    return {
      success: false,
      error: error?.message || 'Unknown error',
      errorCode: error?.code
    };
  }
};

// ============================================
// 2. VERIFY OTP - Verify the code entered by user
// ============================================
export const verifyOTP = async (confirmationResult, otp) => {
  try {
    if (!otp || otp.length !== 6) {
      return {
        success: false,
        error: 'OTP must be 6 digits'
      };
    }

    const result = await confirmationResult.confirm(otp);

    return {
      success: true,
      user: result.user,
      userId: result.user.uid,
      phoneNumber: result.user.phoneNumber
    };

  } catch (error) {
    let errorMessage = error?.message || 'Verification failed';
    if (error?.code === 'auth/invalid-verification-code') {
      errorMessage = 'Invalid OTP. Please check and try again.';
    } else if (error?.code === 'auth/code-expired') {
      errorMessage = 'OTP has expired. Please request a new one.';
    }
    
    logger.error('auth', 'Failed to verify OTP', error);
    return {
      success: false,
      error: errorMessage,
      errorCode: error?.code
    };
  }
};

// ============================================
// 3. GET USER PROFILE - Check if user exists in Firestore
// ============================================
export const getUserProfile = async (userId) => {
  try {
    const userDocRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists) {
      const userData = userDoc.data();
      const hasProfileFields = userData && (
        userData.name ||
        userData.role ||
        userData.phone ||
        userData.userId
      );

      if (hasProfileFields) {
        return {
          success: true,
          exists: true,
          profile: userData
        };
      }
    }

    return {
      success: true,
      exists: false,
      profile: null
    };

  } catch (error) {
    logger.error('auth', `Failed to get user profile: ${userId}`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================
// 3.5 CHECK USER ROLE BY PHONE - Check if user exists and their role
// ============================================
export const checkUserRoleByPhone = async (fullPhone) => {
  try {
    const usersRef = collection(firestore, 'users');
    
    // Check common formats: "+919876543210", "+91 9876543210", and "9876543210"
    const tenDigit = fullPhone.slice(-10);
    const withSpace = fullPhone.replace(/(\+\d+)(\d{10})/, '$1 $2');
    const withoutSpace = fullPhone.replace(/\s/g, '');

    const q = query(usersRef, where('phone', 'in', [tenDigit, withSpace, withoutSpace]));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      return {
        success: true,
        exists: true,
        role: userData.role,
        userId: userData.userId
      };
    }

    return { success: true, exists: false };
  } catch (error) {
    logger.error('auth', `Failed to check user role: ${fullPhone}`, error);
    return { success: false, error: error.message };
  }
};

// ============================================
// 4. CREATE USER PROFILE - Save new user to Firestore
// ============================================
export const createUserProfile = async (userId, userData) => {
  try {
    const profileData = {
      userId: userId,
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'active'
    };

    const userDocRef = doc(firestore, 'users', userId);
    await setDoc(userDocRef, profileData);

    return {
      success: true,
      profile: profileData
    };

  } catch (error) {
    logger.error('auth', `Failed to create user profile: ${userId}`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================
// 5. UPDATE USER PROFILE - Update existing user
// ============================================
export const updateUserProfile = async (userId, updates) => {
  try {
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    const userDocRef = doc(firestore, 'users', userId);
    await setDoc(userDocRef, updateData, { merge: true });

    return {
      success: true
    };

  } catch (error) {
    logger.error('auth', `Failed to update user profile: ${userId}`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================
// 6. SIGN OUT - Log out user
// ============================================
export const signOut = async () => {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      // Remove notification token before signing out
      try {
        await removeTokenFromFirestore(currentUser.uid);
      } catch (err) {
        logger.error('auth', 'Failed to remove notification token during sign out', err);
      }
    }
    await firebaseSignOut(auth);
    return {
      success: true
    };

  } catch (error) {
    logger.error('auth', 'Failed to sign out user', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================
// 7. GENERATE LINKING CODE (6 characters: ABC123)
// ============================================
export const generateLinkingCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

// ============================================
// 8. VERIFY SENIOR OTP & CREATE PROFILE
// ============================================
export const verifySeniorOTPAndCreateProfile = async (
  confirmationResult, 
  otp, 
  seniorData, 
  familyMemberUID
) => {
  try {
    // Validate familyMemberUID
    if (!familyMemberUID) {
      throw new Error('Family member UID is required to register senior');
    }

    // Get family auth credentials BEFORE verifying senior OTP
    const storedFamilyPhone = getTempData('familyAuthPhone');
    const storedFamilyVerificationId = getTempData('familyAuthVerificationId');
    const storedFamilyOtp = getTempData('familyAuthOtp');

    // Verify OTP (this will automatically sign in the senior - unavoidable with Firebase Client SDK)
    const result = await confirmationResult.confirm(otp);
    const seniorAuthUID = result.user.uid;

    // Generate linking code for senior
    const linkingCode = generateLinkingCode();

    // Create senior profile (filter out undefined values)
    const seniorProfile = {
      userId: seniorAuthUID,
      phone: seniorData.phone,
      role: 'senior',
      name: seniorData.name,
      age: seniorData.age || 0,
      gender: seniorData.gender || 'other',
      language: seniorData.language || seniorData.preferredLanguage || 'en',
      linkedFamily: [familyMemberUID],
      linkingCode: linkingCode,
      linkingCodeUsed: false,
      registeredBy: familyMemberUID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'active'
    };

    // Add optional fields only if they exist and are not null/undefined
    if (seniorData.addressLine1 && seniorData.addressLine1 !== null) {
      seniorProfile.addressLine1 = seniorData.addressLine1;
    }
    if (seniorData.addressArea && seniorData.addressArea !== null) {
      seniorProfile.addressArea = seniorData.addressArea;
    }
    if (seniorData.addressCity && seniorData.addressCity !== null) {
      seniorProfile.addressCity = seniorData.addressCity;
    }
    if (seniorData.addressState && seniorData.addressState !== null) {
      seniorProfile.addressState = seniorData.addressState;
    }
    if (seniorData.addressCountry && seniorData.addressCountry !== null) {
      seniorProfile.addressCountry = seniorData.addressCountry;
    }
    if (seniorData.addressPincode && seniorData.addressPincode !== null) {
      seniorProfile.addressPincode = seniorData.addressPincode;
    }
    if (seniorData.employmentStatus && seniorData.employmentStatus !== null) {
      seniorProfile.employmentStatus = seniorData.employmentStatus;
    }
    if (seniorData.livingStatus && seniorData.livingStatus !== null) {
      seniorProfile.livingStatus = seniorData.livingStatus;
    }
    if (seniorData.preferredLanguage && seniorData.preferredLanguage !== null) {
      seniorProfile.preferredLanguage = seniorData.preferredLanguage;
    }

    // Helper function to remove undefined values (Firestore doesn't accept them)
    const removeUndefined = (obj) => {
      const cleaned = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value !== undefined) {
          // Handle nested objects and arrays
          if (Array.isArray(value)) {
            cleaned[key] = value.filter(item => item !== undefined);
          } else if (value !== null && typeof value === 'object' && !value.toDate) {
            // Don't process Firestore Timestamp objects
            cleaned[key] = removeUndefined(value);
          } else {
            cleaned[key] = value;
          }
        }
      });
      return cleaned;
    };

    const cleanedProfile = removeUndefined(seniorProfile);

    const seniorDocRef = doc(firestore, 'users', seniorAuthUID);
    await setDoc(seniorDocRef, cleanedProfile);

    // Update family member's linkedSeniors
    const familyDocRef = doc(firestore, 'users', familyMemberUID);
    await updateDoc(familyDocRef, {
      linkedSeniors: arrayUnion(seniorAuthUID),
      updatedAt: serverTimestamp()
    });

    // Get family member's phone number for potential re-auth
    const familyDoc = await getDoc(familyDocRef);
    const familyPhone = familyDoc.exists ? familyDoc.data().phone : null;

    // Sign out the senior
    await firebaseSignOut(auth);

    // Re-authenticate family member if we have credentials (retrieved earlier)
    if (storedFamilyPhone && storedFamilyVerificationId && storedFamilyOtp) {
      try {
        const credential = PhoneAuthProvider.credential(storedFamilyVerificationId, storedFamilyOtp);
        await signInWithCredential(auth, credential);
        
        // Clear stored credentials after successful re-auth
        clearTempData('familyAuthPhone');
        clearTempData('familyAuthVerificationId');
        clearTempData('familyAuthOtp');

        return {
          success: true,
          seniorUID: seniorAuthUID,
          linkingCode: linkingCode,
          seniorProfile: cleanedProfile,
          familyReAuthenticated: true
        };
      } catch (reAuthError) {
        logger.error('auth', 'Failed to re-authenticate family member', reAuthError);
        // Fall through to return with requiresFamilyReAuth flag
      }
    }

    // If re-auth failed or no credentials, family needs to log in manually
    return {
      success: true,
      seniorUID: seniorAuthUID,
      linkingCode: linkingCode,
      seniorProfile: cleanedProfile,
      familyPhone: familyPhone,
      requiresFamilyReAuth: true
    };

  } catch (error) {
    logger.error('auth', 'Failed to verify senior OTP and create profile', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// 9. LINK SENIOR BY CODE
// ============================================
export const linkSeniorByCode = async (familyUID, linkingCode) => {
  try {
    // Find senior with this code
    const usersRef = collection(firestore, 'users');
    const q = query(
      usersRef,
      where('linkingCode', '==', linkingCode.toUpperCase()),
      where('role', '==', 'senior')
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { success: false, error: 'Invalid linking code' };
    }
    
    const seniorDoc = snapshot.docs[0];
    const seniorData = seniorDoc.data();
    const seniorUID = seniorData.userId;
    
    // Check if already linked
    if (seniorData.linkedFamily?.includes(familyUID)) {
      return { success: false, error: 'Already linked to this senior' };
    }
    
    // Link the profiles
    const seniorDocRef = doc(firestore, 'users', seniorUID);
    await updateDoc(seniorDocRef, {
      linkedFamily: arrayUnion(familyUID),
      updatedAt: serverTimestamp()
    });
    
    const familyDocRef = doc(firestore, 'users', familyUID);
    await updateDoc(familyDocRef, {
      linkedSeniors: arrayUnion(seniorUID),
      updatedAt: serverTimestamp()
    });
    
    return { 
      success: true, 
      senior: seniorData,
      seniorUID 
    };
    
  } catch (error) {
    logger.error('auth', 'Failed to link senior by code', error);
    return { success: false, error: error.message };
  }
};