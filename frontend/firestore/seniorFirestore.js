// Senior Firestore Service
// Database operations specific to senior users
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  updateDoc, 
  addDoc,
  query, 
  where, 
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp
} from '@react-native-firebase/firestore';
import { firestore } from '../config/firebase';
import logger from '../utils/logger';

// ============================================
// HELPER FUNCTIONS
// ============================================

const getTodayRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
};

const getTimestamp = (value) => value?.toDate?.() || new Date(value);

const sortByDate = (items, descending = false) => {
  return items.sort((a, b) => {
    const timeA = getTimestamp(a.scheduledTime || a.createdAt);
    const timeB = getTimestamp(b.scheduledTime || b.createdAt);
    return descending ? timeB - timeA : timeA - timeB;
  });
};

const isActiveStatus = (status) => status !== 'deleted' && status !== 'completed';

// ============================================
// REMINDERS
// ============================================

export const createReminder = async (data) => {
  try {
    const reminderData = {
      ...data,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const colRef = collection(firestore, 'reminders');
    const docRef = await addDoc(colRef, reminderData);
    await updateDoc(docRef, { reminderId: docRef.id });

    return { success: true, reminderId: docRef.id };
  } catch (error) {
    logger.error('firestore', 'Error creating reminder', error);
    return { success: false, error: error.message };
  }
};

export const getRemindersForSenior = async (userId, todayOnly = true) => {
  try {
    const q = query(
      collection(firestore, 'reminders'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    let reminders = snapshot.docs.map(doc => doc.data());

    const { today, tomorrow } = getTodayRange();
    reminders = reminders.filter(r => {
      const reminderDate = getTimestamp(r.scheduledTime);
      return reminderDate >= today && reminderDate < tomorrow;
    });

    reminders = reminders.filter(r => isActiveStatus(r.status));
    return { success: true, reminders: sortByDate(reminders) };
  } catch (error) {
    logger.error('firestore', 'Error getting reminders', error);
    return { success: false, error: error.message, reminders: [] };
  }
};

export const getAllRemindersForSenior = async (userId) => {
  try {
    const q = query(
      collection(firestore, 'reminders'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    let reminders = snapshot.docs.map(doc => doc.data());
    
    // fetch all other reminders including old completed/missed ones
    reminders = reminders.filter(r => r.status !== 'deleted');
    
    return { success: true, reminders: sortByDate(reminders, true) };
  } catch (error) {
    logger.error('firestore', 'Error getting all reminders', error);
    return { success: false, error: error.message, reminders: [] };
  }
};

export const updateReminderStatus = async (reminderId, status) => {
  try {
    const updateData = {
      status,
      updatedAt: serverTimestamp()
    };

    if (status === 'completed') {
      updateData.completedAt = serverTimestamp();
    }

    const docRef = doc(firestore, 'reminders', reminderId);
    await updateDoc(docRef, updateData);

    return { success: true };
  } catch (error) {
    logger.error('firestore', 'Error updating reminder status', error);
    return { success: false, error: error.message };
  }
};

export const updateReminder = async (reminderId, data) => {
  try {
    const docRef = doc(firestore, 'reminders', reminderId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    logger.error('firestore', 'Error updating reminder', error);
    return { success: false, error: error.message };
  }
};

export const deleteReminder = async (reminderId) => {
  try {
    if (!reminderId) {
      return { success: false, error: 'Reminder ID is required' };
    }

    const reminderRef = doc(firestore, 'reminders', reminderId);
    const reminderSnap = await getDoc(reminderRef);

    if (!reminderSnap.exists) {
      return { success: false, error: 'Reminder not found' };
    }

    await updateDoc(reminderRef, {
      status: 'deleted',
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    logger.error('firestore', 'Error deleting reminder', error);
    return { success: false, error: error.message };
  }
};

export const listenToRemindersForSenior = (userId, callback) => {
  if (!userId) {
    logger.error('firestore', 'Cannot setup reminder listener: userId is undefined');
    return () => {};
  }

  const q = query(
    collection(firestore, 'reminders'),
    where('userId', '==', userId)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const allReminders = snapshot.docs.map(doc => ({
      ...doc.data(),
      reminderId: doc.data().reminderId || doc.id
    }));

    const { today, tomorrow } = getTodayRange();
    const todaysReminders = allReminders.filter(reminder => {
      const reminderDate = getTimestamp(reminder.scheduledTime);
      return reminderDate >= today && reminderDate < tomorrow;
    });

    const activeReminders = todaysReminders.filter(r => isActiveStatus(r.status));
    callback(sortByDate(activeReminders));
  });

  return unsubscribe;
};

// ============================================
// ROUTINES
// ============================================

export const createRoutine = async (data) => {
  try {
    const docRef = doc(collection(firestore, 'routines'));
    const routineId = docRef.id;

    const routineData = {
      ...data,
      routineId: routineId,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(docRef, routineData);
    return { success: true, routineId: routineId };
  } catch (error) {
    logger.error('firestore', 'Error creating routine', error);
    return { success: false, error: error.message };
  }
};

export const updateRoutine = async (routineId, data) => {
  try {
    const docRef = doc(firestore, 'routines', routineId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    logger.error('firestore', 'Error updating routine', error);
    return { success: false, error: error.message };
  }
};

export const deleteRoutine = async (routineId) => {
  try {
    if (!routineId) return { success: false, error: 'Routine ID is required' };

    const routineRef = doc(firestore, 'routines', routineId);
    const routineSnap = await getDoc(routineRef);

    if (!routineSnap.exists) return { success: false, error: 'Routine not found' };

    await updateDoc(routineRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    logger.error('firestore', 'Error deleting routine', error);
    return { success: false, error: error.message };
  }
};

const fetchRoutineLogs = async (routineIds, todayString) => {
  const logsMap = {};
  if (routineIds.length === 0) return logsMap;

  try {
    const chunkSize = 10;
    for (let i = 0; i < routineIds.length; i += chunkSize) {
      const chunk = routineIds.slice(i, i + chunkSize);
      const logsSnapshot = await getDocs(
        query(
          collection(firestore, 'logs'),
          where('routineId', 'in', chunk),
          where('date', '==', todayString),
          where('logType', '==', 'routine')
        )
      );

      logsSnapshot.forEach(doc => {
        const logData = doc.data();
        if (logData.routineId) {
          logsMap[logData.routineId] = logData;
        }
      });
    }
  } catch (error) {
    logger.error('firestore', 'Error fetching routine logs', error);
  }
  return logsMap;
};

// Helper function to check if routine should be shown today based on frequency
const shouldShowRoutineToday = (routine) => {
  if (!routine) return false;
  
  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  
  // If frequency is 'daily' string, show every day
  if (routine.frequency === 'daily') {
    return true;
  }
  
  // Parse frequency if it's a JSON string
  let frequencyArray = routine.frequency;
  if (typeof routine.frequency === 'string' && routine.frequency.startsWith('[')) {
    try {
      frequencyArray = JSON.parse(routine.frequency);
    } catch (e) {
      // If parsing fails, treat as no filter
      return true;
    }
  }
  
  // If frequency is an array (or parsed array), it contains the days
  if (Array.isArray(frequencyArray)) {
    const shouldShow = frequencyArray.some(day => day.toLowerCase() === dayOfWeek);
    return shouldShow;
  }
  
  // Check the days field as fallback
  if (routine.days && Array.isArray(routine.days)) {
    const shouldShow = routine.days.some(day => day.toLowerCase() === dayOfWeek);
    return shouldShow;
  }
  
  // Default: show the routine if no frequency specified
  return true;
};

export const getRoutinesForSenior = async (userId, forceServerFetch = false) => {
  try {
    const q = query(
      collection(firestore, 'routines'),
      where('userId', '==', userId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const allRoutines = snapshot.docs.map(doc => ({
      ...doc.data(),
      routineId: doc.data().routineId || doc.id
    }));

    // Filter routines based on today's day of week
    const routines = allRoutines.filter(routine => shouldShowRoutineToday(routine));

    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    const routineIds = routines.filter(r => r.routineId).map(r => r.routineId);
    const logsMap = await fetchRoutineLogs(routineIds, todayString);

    const routinesWithStatus = routines.map((routine) => ({
      ...routine,
      status: logsMap[routine.routineId]?.status || 'pending'
    }));

    return { success: true, routines: sortByDate(routinesWithStatus) };
  } catch (error) {
    logger.error('firestore', 'Error getting routines', error);
    return { success: false, error: error.message, routines: [] };
  }
};

export const listenToRoutinesForSenior = (userId, callback) => {
  if (!userId) {
    logger.error('firestore', 'Cannot setup listener: userId is undefined');
    return () => {};
  }

  const q = query(
    collection(firestore, 'routines'),
    where('userId', '==', userId),
    where('isActive', '==', true)
  );

  const unsubscribe = onSnapshot(q, async (snapshot) => {
    const allRoutines = snapshot.docs.map(doc => ({
      ...doc.data(),
      routineId: doc.data().routineId || doc.id
    }));

    // Filter routines based on today's day of week
    const routines = allRoutines.filter(routine => shouldShowRoutineToday(routine));

    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    const routineIds = routines.filter(r => r.routineId).map(r => r.routineId);
    const logsMap = await fetchRoutineLogs(routineIds, todayString);

    const routinesWithStatus = routines.map((routine) => ({
      ...routine,
      status: logsMap[routine.routineId]?.status || 'pending'
    }));

    callback(sortByDate(routinesWithStatus));
  });

  return unsubscribe;
};

// ============================================
// LOGS (Check-ins, Health, Routine Completion)
// ============================================

export const createCheckInLog = async (userId, mood, scheduledTime = null, source = 'app_dashboard') => {
  try {
    const logData = {
      logType: 'checkin',
      userId,
      mood,
      scheduledTime, // Track which scheduled time this check-in is for
      source,
      loggedBy: userId,
      createdAt: serverTimestamp()
    };

    const colRef = collection(firestore, 'logs');
    const docRef = await addDoc(colRef, logData);
    await updateDoc(docRef, { logId: docRef.id });

    return { success: true, logId: docRef.id };
  } catch (error) {
    logger.error('firestore', 'Error creating check-in log', error);
    return { success: false, error: error.message };
  }
};

export const getTodayCheckIn = async (userId) => {
  try {
    const { today, tomorrow } = getTodayRange();
    const q = query(
      collection(firestore, 'logs'),
      where('userId', '==', userId),
      where('logType', '==', 'checkin')
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return { success: true, checkIns: [] };

    const allCheckIns = snapshot.docs.map(doc => doc.data());
    const todayCheckIns = allCheckIns.filter(checkIn => {
      const checkInDate = getTimestamp(checkIn.createdAt);
      return checkInDate >= today && checkInDate < tomorrow;
    });

    return { success: true, checkIns: sortByDate(todayCheckIns, true) };
  } catch (error) {
    logger.error('firestore', 'Error getting today check-ins', error);
    return { success: false, error: error.message, checkIns: [] };
  }
};

export const createRoutineLog = async (userId, routineId, status) => {
  try {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];

    const logData = {
      logType: 'routine',
      userId,
      routineId,
      date: dateString,
      status,
      loggedBy: userId,
      createdAt: serverTimestamp()
    };

    const colRef = collection(firestore, 'logs');
    const docRef = await addDoc(colRef, logData);
    await updateDoc(docRef, { logId: docRef.id });

    const routineRef = doc(firestore, 'routines', routineId);
    await updateDoc(routineRef, {
      status: status,
      updatedAt: serverTimestamp()
    });

    return { success: true, logId: docRef.id };
  } catch (error) {
    logger.error('firestore', 'Error creating routine log', error);
    return { success: false, error: error.message };
  }
};

export const getRoutineLogs = async (userId, date) => {
  try {
    const q = query(
      collection(firestore, 'logs'),
      where('userId', '==', userId),
      where('logType', '==', 'routine'),
      where('date', '==', date)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    logger.error('firestore', 'Error getting routine logs', error);
    throw error;
  }
};

export const createHealthLog = async (data) => {
  try {
    const logData = {
      logType: 'health',
      ...data,
      createdAt: serverTimestamp()
    };

    const colRef = collection(firestore, 'logs');
    const docRef = await addDoc(colRef, logData);
    await updateDoc(docRef, { logId: docRef.id });

    return docRef.id;
  } catch (error) {
    logger.error('firestore', 'Error creating health log', error);
    throw error;
  }
};

export const getHealthLogsForSenior = async (userId, daysToFetch = 7) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToFetch);

    const q = query(
      collection(firestore, 'logs'),
      where('userId', '==', userId),
      where('logType', '==', 'health')
    );

    const snapshot = await getDocs(q);
    let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    logs = logs.filter(log => {
      const logDate = log.createdAt?.toDate?.() || new Date(log.createdAt);
      return logDate >= startDate && logDate <= endDate;
    });

    logs.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return dateB - dateA;
    });

    return { success: true, logs };
  } catch (error) {
    logger.error('firestore', 'Error fetching health logs', error);
    return { success: false, error: error.message, logs: [] };
  }
};

// ============================================
// TASKS (Service Requests)
// ============================================


export const createTask = async (data) => {
  try {
    // Determine seniorId: prefer explicit seniorId, fall back to userId
    let finalSeniorId = data.seniorId || data.userId;

    // STRICT Validation: Ensure seniorId is present and valid (required for filtering tasks)
    if (!finalSeniorId || typeof finalSeniorId !== 'string' || finalSeniorId.trim() === '') {
      return { success: false, error: 'Senior ID is required and must be a non-empty string to create a task' };
    }

    finalSeniorId = finalSeniorId.trim();

    const taskData = {
      ...data,
      seniorId: finalSeniorId,
      userId: finalSeniorId, // Ensure consistency between seniorId and userId
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const colRef = collection(firestore, 'carerTasks');
    const docRef = await addDoc(colRef, taskData);
    await updateDoc(docRef, { taskId: docRef.id });

    return { success: true, data: { taskId: docRef.id } };
  } catch (error) {
    logger.error('firestore', 'Error creating task', error);
    return { success: false, error: error.message };
  }
};

export const getTasksForSenior = async (userId, statusFilter = null, limitCount = 20, lastDoc = null) => {
  try {
    let q = query(
      collection(firestore, 'carerTasks'),
      Array.isArray(userId) ? where('seniorId', 'in', userId) : where('seniorId', '==', userId)
    );

    if (statusFilter) {
      if (Array.isArray(statusFilter)) {
        q = query(q, where('status', 'in', statusFilter));
      } else {
        q = query(q, where('status', '==', statusFilter));
      }
    }

    // Note: Removed orderBy('createdAt') to avoid index requirement.
    // Sorting is now handled client-side below.

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    if (limitCount) {
      q = query(q, limit(limitCount));
    }

    const snapshot = await getDocs(q);
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      taskId: doc.id,
      ...doc.data()
    }));

    // Sort client-side to avoid index requirement
    tasks.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    return { 
      success: true, 
      data: tasks,
      lastDoc: snapshot.docs[snapshot.docs.length - 1]
    };
  } catch (error) {
    logger.error('firestore', 'Error getting tasks', error);
    return { success: false, error: error?.message || 'Unknown error', data: [] };
  }
};

export const updateTaskStatus = async (taskId, status) => {
  try {
    const updateData = {
      status,
      updatedAt: serverTimestamp()
    };

    if (status === 'completed') {
      updateData.completedAt = serverTimestamp();
    } else if (status === 'cancelled') {
      updateData.cancelledAt = serverTimestamp();
    }

    const docRef = doc(firestore, 'carerTasks', taskId);
    await updateDoc(docRef, updateData);
    return { success: true };
  } catch (error) {
    logger.error('firestore', 'Error updating task status', error);
    throw error;
  }
};

// ============================================
// ALERTS
// ============================================

export const createPanicAlert = async (userId, reason = 'Panic button pressed', careManagerId = null, seniorName = null) => {
  try {
    let finalSeniorName = seniorName;
    if (!finalSeniorName) {
      try {
        const userDocRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists) {
          const userData = userDoc.data();
          finalSeniorName = userData.name || userData.displayName || 'Senior';
        }
      } catch (err) {
        logger.error('firestore', 'Could not fetch senior name', err);
        finalSeniorName = 'Senior';
      }
    }

    const alertData = {
      userId,
      seniorId: userId,
      seniorName: finalSeniorName,
      type: 'panic_button',
      reason,
      message: reason,
      severity: 'critical',
      status: 'active',
      triggeredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (careManagerId) {
      alertData.assignedTo = careManagerId;
      alertData.careManagerId = careManagerId;
    }

    const colRef = collection(firestore, 'alerts');
    const docRef = await addDoc(colRef, alertData);
    await updateDoc(docRef, { alertId: docRef.id });

    return { success: true, alertId: docRef.id };
  } catch (error) {
    logger.error('firestore', 'Error creating panic alert', error);
    return { success: false, error: error.message };
  }
};

export const getAlertsForSenior = async (userId) => {
  try {
    const q = query(
      collection(firestore, 'alerts'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    const alerts = snapshot.docs.map(doc => doc.data());

    alerts.sort((a, b) => {
      const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return timeB - timeA;
    });

    return alerts;
  } catch (error) {
    logger.error('firestore', 'Error getting alerts', error);
    throw error;
  }
};

export const getAlertsWithPagination = async (userIds, statusFilter = null, limitCount = 10, lastDoc = null) => {
  try {
    // Fetch alerts for each senior without orderBy (no index needed)
    const alertPromises = Array.isArray(userIds)
      ? userIds.map(userId => {
          const q = query(
            collection(firestore, 'alerts'),
            where('userId', '==', userId)
          );
          return getDocs(q);
        })
      : [query(
          collection(firestore, 'alerts'),
          where('userId', '==', userIds)
        )].map(q => getDocs(q));

    const snapshots = await Promise.all(alertPromises);
    
    // Combine all alerts from all seniors
    let allAlerts = [];
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        allAlerts.push({
          alertId: doc.id,
          id: doc.id,
          ...doc.data()
        });
      });
    });

    // Sort by createdAt descending (client-side)
    allAlerts.sort((a, b) => {
      const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return timeB - timeA;
    });

    // Apply status filter
    if (statusFilter) {
      if (Array.isArray(statusFilter)) {
        allAlerts = allAlerts.filter(alert => statusFilter.includes(alert.status));
      } else {
        allAlerts = allAlerts.filter(alert => alert.status === statusFilter);
      }
    }

    // Handle pagination - simple client-side pagination
    let startIndex = 0;
    if (lastDoc) {
      // Find the index of lastDoc in the sorted array
      startIndex = allAlerts.findIndex(alert => alert.id === lastDoc.id) + 1;
    }

    const paginatedAlerts = allAlerts.slice(startIndex, startIndex + limitCount);
    const nextLastDoc = paginatedAlerts.length > 0 ? paginatedAlerts[paginatedAlerts.length - 1] : null;

    return {
      success: true,
      data: paginatedAlerts,
      lastDoc: nextLastDoc
    };
  } catch (error) {
    logger.error('firestore', 'Error getting alerts with pagination', error);
    return { success: false, error: error?.message || 'Unknown error', data: [] };
  }
};

export const updateAlertStatus = async (alertId, status, resolvedByUID = null, resolutionNote = null, resolverName = null) => {
  try {
    const updateData = {
      status,
      updatedAt: serverTimestamp()
    };

    if (status === 'resolved' && resolvedByUID) {
      updateData.resolvedBy = resolvedByUID;
      updateData.resolvedAt = serverTimestamp();
      
      // Store resolver name for backward compatibility and quick display
      if (resolverName) {
        updateData.resolverName = resolverName;
      }
      
      if (resolutionNote) {
        updateData.resolutionNote = resolutionNote;
      }
    }

    const docRef = doc(firestore, 'alerts', alertId);
    await updateDoc(docRef, updateData);

    return { success: true };
  } catch (error) {
    logger.error('firestore', 'Error updating alert status', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// SCHEDULED CHECK-IN (Senior App)
// ============================================

/**
 * Configure scheduled check-in time for a senior (MULTI-TIME SUPPORT)
 */
export const configureScheduledCheckIn = async (seniorId, careManagerId, configData) => {
  try {
    const q = query(
      collection(firestore, 'scheduledCheckIns'),
      where('seniorId', '==', seniorId)
    );

    const snapshot = await getDocs(q);

    const checkInConfig = {
      seniorId,
      careManagerId,
      checkInTimes: configData.checkInTimes || [],
      checkInOptions: configData.checkInOptions || [],
      isActive: true,
      updatedAt: serverTimestamp()
    };

    if (!snapshot.empty) {
      const docId = snapshot.docs[0].id;
      await updateDoc(doc(firestore, 'scheduledCheckIns', docId), checkInConfig);
      return { success: true, configId: docId, updated: true };
    }

    checkInConfig.createdAt = serverTimestamp();
    const docRef = await addDoc(collection(firestore, 'scheduledCheckIns'), checkInConfig);
    await updateDoc(docRef, { configId: docRef.id });

    return { success: true, configId: docRef.id, updated: false };
  } catch (error) {
    logger.error('firestore', 'Error configuring scheduled check-in', error);
    return { success: false, error: error.message };
  }
};

export const getMyScheduledCheckIn = async (seniorId) => {
  try {
    const q = query(
      collection(firestore, 'scheduledCheckIns'),
      where('seniorId', '==', seniorId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return { success: true, config: null };

    return {
      success: true,
      config: {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      }
    };
  } catch (error) {
    logger.error('firestore', 'Error fetching scheduled check-in', error);
    return { success: false, error: error.message };
  }
};

export const getScheduledCheckInsForCareManager = async (careManagerId) => {
  try {
    const q = query(
      collection(firestore, 'scheduledCheckIns'),
      where('careManagerId', '==', careManagerId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    const configs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { success: true, configs };
  } catch (error) {
    logger.error('firestore', 'Error fetching CM schedules', error);
    return { success: false, error: error.message, configs: [] };
  }
};

export const disableScheduledCheckIn = async (seniorId) => {
  try {
    const q = query(
      collection(firestore, 'scheduledCheckIns'),
      where('seniorId', '==', seniorId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return { success: true, message: 'No schedule found' };

    const docId = snapshot.docs[0].id;

    await updateDoc(doc(firestore, 'scheduledCheckIns', docId), {
      isActive: false,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    logger.error('firestore', 'Error disabling scheduled check-in', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// MERGED FEATURE: CARE MANAGER TASK LISTENER
// ============================================

/**
 * Listen to tasks created by care manager for this senior
 * Real-time listener for carerTasks collection
 * Note: Adapted to use @react-native-firebase/firestore
 */
export const listenToCareManagerTasks = (seniorId, callback) => {
  if (!seniorId) {
    logger.error('firestore', 'Cannot setup CM Task listener: seniorId is undefined');
    return () => {};
  }

  try {
    const q = query(
      collection(firestore, 'carerTasks'),
      where('seniorId', '==', seniorId)
    );

    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        taskId: doc.id,
        ...doc.data()
      })).filter(task => {
        // Extra validation: ensure task seniorId matches
        if (!task.seniorId || task.seniorId !== seniorId) {
          return false;
        }
        return true;
      });

      // Optional: Sort them if needed (newest first)
      tasks.sort((a, b) => {
         const dateA = a.createdAt?.toDate?.() || new Date(0);
         const dateB = b.createdAt?.toDate?.() || new Date(0);
         return dateB - dateA;
      });

      callback(tasks);
    }, (error) => {
      logger.error('firestore', 'Care manager tasks error', error);
      callback([]);
    });
  } catch (error) {
    logger.error('firestore', 'Care manager tasks setup error', error);
    callback([]);
    return () => {};
  }
};

/**
 * Get paginated tasks created by care manager for a senior
 * Returns tasks with pagination support
 */
export const getCareManagerTasksPaginated = async (seniorId, pageSize = 5, lastDoc = null) => {
  try {
    // Simplified query without orderBy to avoid index requirement
    const q = query(
      collection(firestore, 'carerTasks'),
      where('seniorId', '==', seniorId)
    );

    const snapshot = await getDocs(q);
    let tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      taskId: doc.id,
      ...doc.data()
    })).filter(task => {
      // Extra validation: ensure task seniorId matches
      if (!task.seniorId || task.seniorId !== seniorId) {
        return false;
      }
      return true;
    });

    // Sort tasks by createdAt in descending order (newest first)
    tasks.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return dateB - dateA;
    });

    // Simple pagination: return first pageSize items
    const paginatedTasks = tasks.slice(0, pageSize);
    const hasMore = tasks.length > pageSize;

    return { success: true, tasks: paginatedTasks, hasMore, lastDocument: null };
  } catch (error) {
    return { success: false, error: error.message, tasks: [], hasMore: false };
  }
};

// ============================================
// HISTORY FUNCTIONS (for Senior Role)
// ============================================

export const getRoutineLogsHistory = async (userId, daysBack = 7) => {
  try {
    // Calculate date 7 days ago
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - daysBack);
    const pastDateString = pastDate.toISOString().split('T')[0];

    // Query routine logs - simplified to avoid composite index requirement
    const q = query(
      collection(firestore, 'logs'),
      where('userId', '==', userId),
      where('logType', '==', 'routine')
    );

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => doc.data());

    // Filter by date and status in memory
    const filteredLogs = logs.filter(log => {
      const isCorrectStatus = log.status === 'completed' || log.status === 'missed';
      const isWithinDateRange = log.date >= pastDateString;
      return isCorrectStatus && isWithinDateRange;
    });

    // Get routine details for each log
    const routineIds = [...new Set(filteredLogs.map(log => log.routineId))];
    const routineDetailsMap = {};

    // Batch fetch routine details to avoid N+1 queries
    const CHUNK_SIZE = 30; // Firestore 'in' query supports up to 30 items
    for (let i = 0; i < routineIds.length; i += CHUNK_SIZE) {
      const chunk = routineIds.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 0) continue;

      try {
        const routinesQuery = query(
          collection(firestore, 'routines'),
          where('routineId', 'in', chunk)
        );
        const routinesSnapshot = await getDocs(routinesQuery);
        routinesSnapshot.forEach(routineDoc => {
          const data = routineDoc.data();
          const routineId = data.routineId || routineDoc.id;
          routineDetailsMap[routineId] = data;
        });
      } catch (error) {
        logger.error('firestore', `Error fetching routine chunk`, error);
      }
    }

    // Combine logs with routine details
    const historyWithDetails = filteredLogs.map(log => {
      const routine = routineDetailsMap[log.routineId] || {};
      return {
        ...log,
        title: routine.title || 'Routine',
        type: routine.type || 'custom',
        scheduledTime: routine.scheduledTime,
        completedAt: log.createdAt
      };
    });

    // Sort by completion time (newest first)
    historyWithDetails.sort((a, b) => {
      const dateA = a.completedAt?.toDate?.() || new Date(a.completedAt);
      const dateB = b.completedAt?.toDate?.() || new Date(b.completedAt);
      return dateB - dateA;
    });

    return { success: true, data: historyWithDetails };
  } catch (error) {
    logger.error('firestore', 'Error getting routine history', error);
    return { success: false, error: error.message, data: [] };
  }
};

export const getReminderHistory = async (userId, daysBack = 7) => {
  try {
    // Calculate date 7 days ago
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - daysBack);

    // Query reminders with completed/missed status
    const q = query(
      collection(firestore, 'reminders'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    const reminders = snapshot.docs.map(doc => doc.data());

    // Filter completed/missed from last 7 days
    const filteredReminders = reminders.filter(reminder => {
      if (reminder.status !== 'completed' && reminder.status !== 'missed') {
        return false;
      }
      
      // Check if updatedAt is within last 7 days
      const updatedAt = reminder.updatedAt?.toDate?.() || new Date(reminder.updatedAt);
      return updatedAt >= pastDate;
    });

    // Sort by completion time (newest first)
    filteredReminders.sort((a, b) => {
      const dateA = a.updatedAt?.toDate?.() || new Date(a.updatedAt);
      const dateB = b.updatedAt?.toDate?.() || new Date(b.updatedAt);
      return dateB - dateA;
    });

    // Format for display
    const historyData = filteredReminders.map(reminder => ({
      ...reminder,
      completedAt: reminder.updatedAt
    }));

    return { success: true, data: historyData };
  } catch (error) {
    logger.error('firestore', 'Error getting reminder history', error);
    return { success: false, error: error.message, data: [] };
  }
};