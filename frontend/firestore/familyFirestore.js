// Family Firestore Service
// Database operations specific to family members

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  updateDoc, 
  query, 
  where, 
  orderBy,
  limit,
  serverTimestamp,
  arrayRemove
} from '@react-native-firebase/firestore';
import { firestore } from '../config/firebase';
import logger from '../utils/logger';

// Note: Migrated to React Native Firebase v22 modular API

// ============================================
// RELATIONS
// ============================================
// ============================================

export const getFamilyMembers = async (familyIds) => {
  try {
    if (!familyIds || familyIds.length === 0) {
      return { success: true, familyMembers: [] };
    }

    // Fetch each family member by ID
    const familyPromises = familyIds.map(id => {
      const docRef = doc(firestore, 'users', id);
      return getDoc(docRef);
    });
    const familyDocs = await Promise.all(familyPromises);

    const familyMembers = familyDocs
      .filter(docSnap => docSnap.exists)
      .map(docSnap => docSnap.data());

    return { success: true, familyMembers };
  } catch (error) {
    logger.error('firestore', 'Error getting family members', error);
    return { success: false, error: error.message, familyMembers: [] };
  }
};

export const removeSeniorLink = async (familyUserId, seniorUserId) => {
  try {
    // Remove family member from senior's linkedFamily array
    const seniorDocRef = doc(firestore, 'users', seniorUserId);
    await updateDoc(seniorDocRef, {
      linkedFamily: arrayRemove(familyUserId),
      updatedAt: serverTimestamp()
    });

    // Remove senior from family member's linkedSeniors array
    const familyDocRef = doc(firestore, 'users', familyUserId);
    await updateDoc(familyDocRef, {
      linkedSeniors: arrayRemove(seniorUserId),
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    logger.error('firestore', 'Error removing senior link', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// FAMILY DASHBOARD FUNCTIONS
// ============================================

export const getLinkedSeniorsWithDetails = async (familyUserId) => {
  try {
    // Query users where linkedFamily array contains this family member's ID
    const q = query(
      collection(firestore, 'users'),
      where('linkedFamily', 'array-contains', familyUserId),
      where('role', '==', 'senior')
    );

    const snapshot = await getDocs(q);
    const seniors = snapshot.docs.map(doc => ({ ...doc.data(), userId: doc.id }));

    return { success: true, data: seniors };
  } catch (error) {
    logger.error('firestore', 'Error fetching linked seniors', error);
    return { success: false, error: error.message, data: [] };
  }
};

export const getLatestCheckIn = async (seniorUserId) => {
  try {
    const q = query(
      collection(firestore, 'logs'),
      where('userId', '==', seniorUserId),
      where('logType', '==', 'checkin')
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: true, data: null };
    }

    // Sort by createdAt and get the latest one
    const checkIns = snapshot.docs.map(doc => doc.data());
    checkIns.sort((a, b) => {
      const timeA = a.createdAt?.toDate?.() || new Date(0);
      const timeB = b.createdAt?.toDate?.() || new Date(0);
      return timeB - timeA; // Newest first
    });

    // Check if latest check-in is from today
    const latestCheckIn = checkIns[0];
    const checkInDate = latestCheckIn.createdAt?.toDate?.();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isToday = checkInDate && checkInDate >= today;

    return { success: true, data: isToday ? latestCheckIn : null };
  } catch (error) {
    logger.error('firestore', 'Error fetching check-in', error);
    return { success: false, error: error.message, data: null };
  }
};

export const getPendingTasksCount = async (seniorUserId) => {
  try {
    const q = query(
      collection(firestore, 'carerTasks'),
      where('userId', '==', seniorUserId),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(q);
    const count = snapshot.size;

    return { success: true, data: count };
  } catch (error) {
    logger.error('firestore', 'Error counting tasks', error);
    return { success: false, error: error.message, data: 0 };
  }
};

export const getPendingRemindersCount = async (seniorUserId) => {
  try {
    const q = query(
      collection(firestore, 'reminders'),
      where('userId', '==', seniorUserId),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(q);
    const count = snapshot.size;

    return { success: true, data: count };
  } catch (error) {
    logger.error('firestore', 'Error counting reminders', error);
    return { success: false, error: error.message, data: 0 };
  }
};

// ============================================
// HEALTH LOGS
// ============================================

export const getHealthLogsForLinkedSenior = async (seniorUserId) => {
  try {
    const q = query(
      collection(firestore, 'healthLogs'),
      where('seniorId', '==', seniorUserId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    let logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Fetch care manager names for logs
    const careManagerIds = [...new Set(logs.map(log => log.careManagerId).filter(Boolean))];
    const careManagerNames = {};
    
    for (const cmId of careManagerIds) {
      try {
        const cmDoc = await getDoc(doc(firestore, 'users', cmId));
        if (cmDoc.exists()) {
          const cmData = cmDoc.data();
          careManagerNames[cmId] = cmData.name || cmData.fullName || 'Care Manager';
        }
      } catch (error) {
        logger.error('firestore', 'Error fetching care manager name', error);
        careManagerNames[cmId] = 'Care Manager';
      }
    }

    // Add care manager names to logs
    logs = logs.map(log => ({
      ...log,
      loggedBy: log.careManagerId ? careManagerNames[log.careManagerId] : 'Unknown'
    }));

    // Logs are already sorted by createdAt desc from Firestore query
    return { success: true, logs };
  } catch (error) {
    logger.error('firestore', 'Error fetching health logs', error);
    return { success: false, error: error.message, logs: [] };
  }
};

// Get health logs for routines page with day filter
export const getHealthLogsForRoutines = async (seniorUserId, daysToFetch = 7) => {
  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToFetch);
    
    const q = query(
      collection(firestore, 'healthLogs'),
      where('seniorId', '==', seniorUserId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    let logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Fetch care manager names for logs
    const careManagerIds = [...new Set(logs.map(log => log.careManagerId).filter(Boolean))];
    const careManagerNames = {};
    
    for (const cmId of careManagerIds) {
      try {
        const cmDoc = await getDoc(doc(firestore, 'users', cmId));
        if (cmDoc.exists()) {
          const cmData = cmDoc.data();
          careManagerNames[cmId] = cmData.name || cmData.fullName || 'Care Manager';
        }
      } catch (error) {
        logger.error('firestore', 'Error fetching care manager name', error);
        careManagerNames[cmId] = 'Care Manager';
      }
    }

    // Add care manager names to logs
    logs = logs.map(log => ({
      ...log,
      loggedBy: log.careManagerId ? careManagerNames[log.careManagerId] : 'Unknown'
    }));

    // Client-side filtering by date - properly handle Firestore Timestamps
    logs = logs.filter(log => {
      if (!log.createdAt) return false;
      
      // Convert Firestore Timestamp to JavaScript Date
      let logDate;
      if (log.createdAt.toDate && typeof log.createdAt.toDate === 'function') {
        logDate = log.createdAt.toDate();
      } else if (log.createdAt instanceof Date) {
        logDate = log.createdAt;
      } else if (typeof log.createdAt === 'number') {
        logDate = new Date(log.createdAt);
      } else {
        return false;
      }
      
      return logDate >= startDate && logDate <= endDate;
    });

    // Logs are already sorted by createdAt desc from Firestore query
    return { success: true, logs };
  } catch (error) {
    logger.error('firestore', 'Error fetching health logs', error);
    return { success: false, error: error.message, logs: [] };
  }
};

// Get latest health log summary for dashboard
export const getLatestHealthLogSummary = async (seniorUserId) => {
  try {
    const q = query(
      collection(firestore, 'healthLogs'),
      where('seniorId', '==', seniorUserId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { success: true, data: null };
    }

    const log = snapshot.docs[0].data();
    
    // Format the display text (e.g., "120/80" for BP or "95 mg/dL" for sugar)
    let displayText = 'N/A';
    if (log.vitals?.bloodPressure) {
      displayText = log.vitals.bloodPressure;
    } else if (log.vitals?.bloodSugar) {
      displayText = `${log.vitals.bloodSugar}`;
    }

    return { success: true, data: displayText };
  } catch (error) {
    logger.error('firestore', 'Error fetching latest health log', error);
    return { success: true, data: null };
  }
};