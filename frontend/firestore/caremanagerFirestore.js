// Care Manager Firestore Service
// Simple database operations for care managers - easy to debug and modify

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import { firestore } from "../config/firebase";
import logger from "../utils/logger";

// NOTE: this file assumes React Native Firebase v22 modular API and that
// `firestore` is correctly initialized in ../config/firebase

// ============================================
// HELPER FUNCTIONS
// ============================================

const sortByDate = (items, descending = false) => {
  return items.sort((a, b) => {
    const timeA = a.scheduledTime?.toMillis ? a.scheduledTime.toMillis() : 0;
    const timeB = b.scheduledTime?.toMillis ? b.scheduledTime.toMillis() : 0;
    return descending ? timeB - timeA : timeA - timeB;
  });
};

const fetchRoutineLogsForCM = async (routineIds, todayString) => {
  const logsMap = {};
  if (routineIds.length === 0) return logsMap;

  try {
    const chunkSize = 10;
    for (let i = 0; i < routineIds.length; i += chunkSize) {
      const chunk = routineIds.slice(i, i + chunkSize);
      const logsSnapshot = await getDocs(
        query(
          collection(firestore, "logs"),
          where("routineId", "in", chunk),
          where("date", "==", todayString),
          where("logType", "==", "routine")
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
    logger.error("caremanagerFirestore", "Error fetching routine logs", error);
  }
  return logsMap;
};

// ============================================
// 1. USER PROFILE OPERATIONS
// ============================================

// Get care manager details
export const getCareManager = async (careManagerId) => {
  try {
    if (!careManagerId) {
      return { success: true, careManager: null };
    }

    // Handle DocumentReference-like objects (some code paths may pass one)
    let cmId = careManagerId;
    if (typeof careManagerId === "object" && careManagerId.id) {
      cmId = careManagerId.id;
    } else if (
      typeof careManagerId === "object" &&
      careManagerId.referencePath
    ) {
      cmId = careManagerId.referencePath.split("/").pop();
    }

    const docRef = doc(firestore, "users", cmId);
    const docSnap = await getDoc(docRef);

    return {
      success: true,
      careManager: docSnap.exists ? docSnap.data() : null,
    };
  } catch (error) {
    logger.error("caremanagerFirestore", "Error getting care manager", error);
    return { success: false, error: error.message };
  }
};

// Get assigned seniors for care manager
export const getCareManagerAssignedSeniors = async (careManagerId) => {
  try {
    const docRef = doc(firestore, "users", careManagerId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists) {
      return { success: false, error: "Care manager not found" };
    }

    const assignedSeniors = docSnap.data().assignedSeniorIds || [];
    return { success: true, assignedSeniors };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error getting assigned seniors",
      error
    );
    return { success: false, error: error.message };
  }
};

// Get assigned seniors with full details
export const getCareManagerAssignedSeniorsWithDetails = async (
  careManagerId
) => {
  try {
    const docRef = doc(firestore, "users", careManagerId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: "Care manager not found" };
    }

    const assignedSeniorIds = docSnap.data().assignedSeniorIds || [];
    if (assignedSeniorIds.length === 0) {
      return { success: true, seniors: [] };
    }

    // Fetch details for each senior
    const seniorsDetails = [];
    for (const seniorId of assignedSeniorIds) {
      try {
        const seniorDoc = await getDoc(doc(firestore, "users", seniorId));
        if (seniorDoc.exists()) {
          seniorsDetails.push({
            id: seniorId,
            ...seniorDoc.data(),
          });
        }
      } catch (error) {
        logger.error(
          "caremanagerFirestore",
          `Error fetching senior ${seniorId}`,
          error
        );
      }
    }
    return { success: true, seniors: seniorsDetails };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error getting assigned seniors with details",
      error
    );
    return { success: false, error: error.message };
  }
};

// Real-time listener for assigned seniors by careManagerId
// This listens to seniors collection where careManagerId matches the care manager
// Useful for real-time updates when seniors are reassigned from admin module
export const listenToAssignedSeniorIds = (careManagerId, callback) => {
  if (!careManagerId) {
    callback([]);
    return () => {};
  }

  try {
    const q = query(
      collection(firestore, "users"),
      where("role", "==", "senior"),
      where("careManagerId", "==", careManagerId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const seniorIds = snapshot.docs.map((doc) => doc.id);
        callback(seniorIds);
      },
      (error) => {
        logger.error(
          "caremanagerFirestore",
          "Error listening to assigned seniors",
          error
        );
        callback([]);
      }
    );
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error setting up assigned seniors listener",
      error
    );
    callback([]);
    return () => {};
  }
};

// ============================================
// 2. TASKS OPERATIONS
// ============================================

// Listen to tasks for assigned seniors (generic tasks collection)
export const listenToTasksForAssignedSeniors = (
  assignedSeniorIds,
  callback
) => {
  if (!assignedSeniorIds || assignedSeniorIds.length === 0) {
    callback([]);
    return () => {};
  }

  try {
    const q = query(
      collection(firestore, "tasks"),
      where("seniorId", "in", assignedSeniorIds.slice(0, 10))
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const tasks = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        callback(tasks);
      },
      (error) => {
        logger.error("caremanagerFirestore", "Error fetching senior tasks", error);
        callback([]);
      }
    );
  } catch (error) {
    logger.error("caremanagerFirestore", "Error setting up senior tasks listener", error);
    callback([]);
    return () => {};
  }
};

// Create new task (generic tasks collection) - KEEP if you use 'tasks'
export const createTask = async (data) => {
  try {
    const taskData = {
      ...data,
      status: data.status || "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const colRef = collection(firestore, "tasks");
    const docRef = await addDoc(colRef, taskData);
    await updateDoc(docRef, { taskId: docRef.id });
    return { success: true, data: { taskId: docRef.id } };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error creating task",
      error
    );
    return { success: false, error: error.message };
  }
};

// ============================================
// 3. ALERTS OPERATIONS
// ============================================

// Listen to alerts for assigned seniors (shows full history)
export const listenToAlertsForAssignedSeniors = (
  assignedSeniorIds,
  callback
) => {
  if (!assignedSeniorIds || assignedSeniorIds.length === 0) {
    callback([]);
    return () => {};
  }

  try {
    const q = query(
      collection(firestore, "alerts"),
      where("userId", "in", assignedSeniorIds.slice(0, 10))
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const alerts = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Sort by createdAt (newest first)
        alerts.sort((a, b) => {
          const timeA = a.createdAt?.toDate?.() || new Date(0);
          const timeB = b.createdAt?.toDate?.() || new Date(0);
          return timeB - timeA;
        });
        callback(alerts);
      },
      (error) => {
        logger.error("caremanagerFirestore", "Error fetching senior alerts", error);
        callback([]);
      }
    );
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error setting up senior alerts listener",
      error
    );
    callback([]);
    return () => {};
  }
};

// Resolve an alert
export const resolveAlert = async (
  alertId,
  resolvedBy = null,
  resolutionNote = null
) => {
  try {
    const docRef = doc(firestore, "alerts", alertId);
    const updateData = {
      status: "resolved",
      resolvedAt: serverTimestamp(),
    };

    if (resolvedBy) {
      updateData.resolvedBy = resolvedBy;
    }

    if (resolutionNote) {
      updateData.resolutionNote = resolutionNote;
    }

    await updateDoc(docRef, updateData);
    return { success: true };
  } catch (error) {
    logger.error("caremanagerFirestore", "Error resolving alert", error);
    return { success: false, error: error.message };
  }
};

// ============================================
// 4. HEALTH LOGS OPERATIONS
// ============================================

// Add health log for a senior
export const addHealthLog = async (
  seniorId,
  careManagerId,
  vitals,
  notes = ""
) => {
  try {
    // Fetch senior name
    const seniorDocRef = doc(firestore, "users", seniorId);
    const seniorDoc = await getDoc(seniorDocRef);
    const seniorName = seniorDoc.exists
      ? seniorDoc.data().name || seniorDoc.data().fullName
      : "Unknown Senior";

    const healthLogData = {
      seniorId,
      seniorName,
      careManagerId,
      vitals: {
        bloodPressure: vitals?.bloodPressure || "",
        bloodSugar: vitals?.bloodSugar || 0,
        temperature: vitals?.temperature || 0,
      },
      notes: notes || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const colRef = collection(firestore, "healthLogs");
    const docRef = await addDoc(colRef, healthLogData);

    // Update senior profile with lastHealthLogAt
    const seniorUpdateRef = doc(firestore, "users", seniorId);
    await updateDoc(seniorUpdateRef, {
      lastHealthLogAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    logger.error("caremanagerFirestore", "Error adding health log", error);
    return { success: false, error: error.message };
  }
};

export const updateHealthLog = async (logId, vitals, notes = "") => {
  try {
    const docRef = doc(firestore, "healthLogs", logId);
    await updateDoc(docRef, {
      vitals: {
        bloodPressure: vitals?.bloodPressure || "",
        bloodSugar: vitals?.bloodSugar || 0,
        temperature: vitals?.temperature || 0,
      },
      notes: notes || "",
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error updating health log",
      error
    );
    return { success: false, error: error.message };
  }
};

export const getHealthLogsForSenior = async (seniorId, daysToFetch = 30) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToFetch);

    const q = query(
      collection(firestore, "healthLogs"),
      where("seniorId", "==", seniorId)
    );

    const snapshot = await getDocs(q);
    let logs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Client-side date filtering
    logs = logs.filter((log) => {
      const logDate = log.createdAt?.toDate?.() || new Date(log.createdAt);
      return logDate >= startDate && logDate <= endDate;
    });

    // Sort newest first
    logs.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return dateB - dateA;
    });
    return { success: true, logs };
  } catch (error) {
    logger.error("caremanagerFirestore", "Error fetching health logs", error);
    return { success: false, error: error.message, logs: [] };
  }
};

// Paginated health logs
export const getHealthLogsPaginated = async (
  seniorId,
  pageSize = 3,
  lastDoc = null
) => {
  try {
    let q;
    if (lastDoc) {
      q = query(
        collection(firestore, "healthLogs"),
        where("seniorId", "==", seniorId),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(pageSize)
      );
    } else {
      q = query(
        collection(firestore, "healthLogs"),
        where("seniorId", "==", seniorId),
        orderBy("createdAt", "desc"),
        limit(pageSize)
      );
    }

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map((d) => ({ id: d.id, ...d.data(), _doc: d }));

    const hasMore = logs.length === pageSize;
    const lastDocument = logs.length > 0 ? logs[logs.length - 1]._doc : null;
    return { success: true, logs, hasMore, lastDocument };
  } catch (error) {
    logger.error("caremanagerFirestore", "Error fetching paginated health logs", error);
    return { success: false, error: error.message, logs: [], hasMore: false };
  }
};

// Listen to senior logs for assigned seniors
export const listenToSeniorLogsForAssignedSeniors = (
  assignedSeniorIds,
  callback
) => {
  if (!assignedSeniorIds || assignedSeniorIds.length === 0) {
    callback([]);
    return () => {};
  }

  try {
    const q = query(
      collection(firestore, "logs"),
      where("seniorId", "in", assignedSeniorIds.slice(0, 10)),
      limit(20)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const logs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(logs);
      },
      (error) => {
        logger.error("caremanagerFirestore", "Error fetching senior logs", error);
        callback([]);
      }
    );
  } catch (error) {
    logger.error("caremanagerFirestore", "Error setting up senior logs listener", error);
    callback([]);
    return () => {};
  }
};

// ============================================
// 5. CHECK-INS & REMINDERS
// ============================================

export const listenToCheckinsForAssignedSeniors = (
  assignedSeniorIds,
  callback
) => {
  if (!assignedSeniorIds || assignedSeniorIds.length === 0) {
    callback([]);
    return () => {};
  }

  try {
    const q = query(
      collection(firestore, "logs"),
      where("userId", "in", assignedSeniorIds.slice(0, 10)),
      where("logType", "==", "checkin")
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const checkins = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(checkins);
      },
      (error) => {
        logger.error("caremanagerFirestore", "Error fetching check-ins", error);
        callback([]);
      }
    );
  } catch (error) {
    logger.error("caremanagerFirestore", "Error setting up check-ins listener", error);
    callback([]);
    return () => {};
  }
};

export const listenToRemindersForAssignedSeniors = (
  assignedSeniorIds,
  callback
) => {
  if (!assignedSeniorIds || assignedSeniorIds.length === 0) {
    callback([]);
    return () => {};
  }

  try {
    const q = query(
      collection(firestore, "reminders"),
      where("userId", "in", assignedSeniorIds.slice(0, 10))
    );

    return onSnapshot(
      q,
      (snapshot) => {
        // Filter out reminders with invalid/missing userId
        const reminders = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((reminder) => {
            // Only include reminders that have a valid userId in assignedSeniorIds
            if (!reminder?.userId || typeof reminder.userId !== 'string' || reminder.userId.trim() === '') {
              logger.error(
                "caremanagerFirestore",
                `Reminder has invalid userId, filtering out: ${reminder.id}`,
                { userId: reminder?.userId }
              );
              return false;
            }
            // Double-check userId is in the assigned list
            if (!assignedSeniorIds.includes(reminder.userId)) {
              logger.error(
                "caremanagerFirestore",
                `Reminder userId not in assigned seniors list: ${reminder.id}`,
                { userId: reminder.userId, assignedCount: assignedSeniorIds.length }
              );
              return false;
            }
            return true;
          });

        // Sort by scheduledTime: latest first (newest reminders at top)
        reminders.sort((a, b) => {
          const timeA =
            a.scheduledTime?.toDate?.() || new Date(a.scheduledTime);
          const timeB =
            b.scheduledTime?.toDate?.() || new Date(b.scheduledTime);
          return timeB - timeA; // Descending order: latest first
        });
        callback(reminders);
      },
      (error) => {
        logger.error("caremanagerFirestore", "Error fetching reminders", error);
        callback([]);
      }
    );
  } catch (error) {
    logger.error("caremanagerFirestore", "Error setting up reminders listener", error);
    callback([]);
    return () => {};
  }
};

// ============================================
// 6. TASK RETRIEVAL
// ============================================

export const getTaskById = async (taskId, taskType) => {
  try {
    let taskDoc;

    if (taskType === "reminder") {
      taskDoc = await getDoc(doc(firestore, "reminders", taskId));
    } else if (taskType === "service_request" || taskType === "carer_task") {
      taskDoc = await getDoc(doc(firestore, "carerTasks", taskId));
      if (!taskDoc.exists) {
        taskDoc = await getDoc(doc(firestore, "serviceRequests", taskId));
      }
    } else {
      taskDoc = await getDoc(doc(firestore, "tasks", taskId));
    }

    if (!taskDoc.exists) {
      logger.error(
        "caremanagerFirestore",
        `Task not found: ${taskId}`,
        null
      );
      return { success: false, error: "Task not found" };
    }

    const taskData = { id: taskDoc.id, ...taskDoc.data() };
    return { success: true, task: taskData };
  } catch (error) {
    logger.error("caremanagerFirestore", "Error fetching task", error);
    return { success: false, error: error.message };
  }
};

// ============================================
// 7. SERVICE REQUESTS
// ============================================

export const listenToServiceRequestsForAssignedSeniors = (
  assignedSeniorIds,
  callback
) => {
  if (!assignedSeniorIds || assignedSeniorIds.length === 0) {
    callback([]);
    return () => {};
  }

  try {
    const q = query(
      collection(firestore, "serviceRequests"),
      where("seniorId", "in", assignedSeniorIds.slice(0, 10))
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(requests);
      },
      (error) => {
        logger.error(
          "caremanagerFirestore",
          "Error fetching service requests",
          error
        );
        callback([]);
      }
    );
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error setting up service requests listener",
      error
    );
    callback([]);
    return () => {};
  }
};

export const updateServiceRequestStatus = async (
  requestId,
  status,
  notes = ""
) => {
  try {
    const docRef = doc(firestore, "serviceRequests", requestId);
    await updateDoc(docRef, {
      status,
      notes,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error updating service request",
      error
    );
    return { success: false, error: error.message };
  }
};

// ============================================
// 7. SENIOR-SPECIFIC OPERATIONS (CARER TASKS)
// ============================================

export const listenToCarerTasksForAssignedSeniors = (
  assignedSeniorIds,
  callback
) => {
  if (!assignedSeniorIds || assignedSeniorIds.length === 0) {
    callback([]);
    return () => {};
  }

  try {
    const q = query(
      collection(firestore, "carerTasks"),
      where("seniorId", "in", assignedSeniorIds.slice(0, 10))
    );

    return onSnapshot(
      q,
      (snapshot) => {
        // Filter out tasks with invalid/missing seniorId
        const tasks = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((task) => {
            // Only include tasks that have a valid seniorId in assignedSeniorIds
            if (!task?.seniorId || typeof task.seniorId !== 'string' || task.seniorId.trim() === '') {
              logger.error(
                "caremanagerFirestore",
                `Carer task has invalid seniorId, filtering out: ${task.id}`,
                { seniorId: task?.seniorId }
              );
              return false;
            }
            // Double-check seniorId is in the assigned list
            if (!assignedSeniorIds.includes(task.seniorId)) {
              logger.error(
                "caremanagerFirestore",
                `Carer task seniorId not in assigned seniors list: ${task.id}`,
                { seniorId: task.seniorId, assignedCount: assignedSeniorIds.length }
              );
              return false;
            }
            return true;
          });
        callback(tasks);
      },
      (error) => {
        logger.error("caremanagerFirestore", "Error fetching carer tasks", error);
        callback([]);
      }
    );
  } catch (error) {
    logger.error("caremanagerFirestore", "Error setting up carer tasks listener", error);
    callback([]);
    return () => {};
  }
};

export const updateCarerTaskStatus = async (taskId, status, notes = "") => {
  try {
    const updateData = {
      status,
      notes,
      updatedAt: serverTimestamp(),
    };

    if (status === "completed") {
      updateData.completedAt = serverTimestamp();
    }

    const docRef = doc(firestore, "carerTasks", taskId);
    await updateDoc(docRef, updateData);
    return { success: true };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error updating carer task",
      error
    );
    return { success: false, error: error.message };
  }
};

// ============================================
// 8. ROUTINES OPERATIONS
// ============================================

export const listenToRoutinesForAssignedSeniors = (
  assignedSeniorIds,
  callback
) => {
  if (!assignedSeniorIds || assignedSeniorIds.length === 0) {
    callback([]);
    return () => {};
  }

  try {
    const q = query(
      collection(firestore, "routines"),
      where("userId", "in", assignedSeniorIds.slice(0, 10)),
      where("isActive", "==", true)
    );

    return onSnapshot(
      q,
      async (snapshot) => {
        const routines = snapshot.docs.map((d) => ({
          id: d.id,
          routineId: d.id,
          ...d.data(),
        }));

        const today = new Date();
        const todayString = today.toISOString().split("T")[0];

        const routineIds = routines.map(r => r.routineId);
        const logsMap = await fetchRoutineLogsForCM(routineIds, todayString);

        const routinesWithStatus = routines.map((routine) => ({
          ...routine,
          status: logsMap[routine.routineId]?.status || "pending"
        }));

        callback(sortByDate(routinesWithStatus, true));
      },
      (error) => {
        logger.error("caremanagerFirestore", "Error fetching routines", error);
        callback([]);
      }
    );
  } catch (error) {
    logger.error("caremanagerFirestore", "Error setting up routines listener", error);
    callback([]);
    return () => {};
  }
};

// ============================================
// SCHEDULED CHECK-IN CONFIGURATION (MULTI-TIME SUPPORT)
// ============================================

export const configureScheduledCheckIn = async (
  seniorId,
  careManagerId,
  configData
) => {
  try {
    const q = query(
      collection(firestore, "scheduledCheckIns"),
      where("seniorId", "==", seniorId)
    );

    const snapshot = await getDocs(q);
    const checkInConfig = {
      seniorId,
      careManagerId,
      checkInTimes: configData.checkInTimes || [],
      checkInOptions: configData.checkInOptions || [],
      isActive: true,
      updatedAt: serverTimestamp(),
    };

    if (!snapshot.empty) {
      const docId = snapshot.docs[0].id;
      await updateDoc(
        doc(firestore, "scheduledCheckIns", docId),
        checkInConfig
      );
      return { success: true, configId: docId, updated: true };
    } else {
      checkInConfig.createdAt = serverTimestamp();

      const docRef = await addDoc(
        collection(firestore, "scheduledCheckIns"),
        checkInConfig
      );
      await updateDoc(docRef, { configId: docRef.id });
      return { success: true, configId: docRef.id, updated: false };
    }
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error configuring scheduled check-in",
      error
    );
    return { success: false, error: error.message };
  }
};

export const getScheduledCheckIn = async (seniorId) => {
  try {
    const q = query(
      collection(firestore, "scheduledCheckIns"),
      where("seniorId", "==", seniorId),
      where("isActive", "==", true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: true, config: null };
    }

    const config = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    return { success: true, config };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error getting scheduled check-in",
      error
    );
    return { success: false, error: error.message };
  }
};

export const getScheduledCheckInsForCareManager = async (careManagerId) => {
  try {
    const q = query(
      collection(firestore, "scheduledCheckIns"),
      where("careManagerId", "==", careManagerId),
      where("isActive", "==", true)
    );

    const snapshot = await getDocs(q);
    const configs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { success: true, configs };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error getting scheduled check-ins",
      error
    );
    return { success: false, error: error.message, configs: [] };
  }
};

export const disableScheduledCheckIn = async (seniorId) => {
  try {
    const q = query(
      collection(firestore, "scheduledCheckIns"),
      where("seniorId", "==", seniorId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return { success: true, message: "No configuration found" };
    }

    const docId = snapshot.docs[0].id;
    await updateDoc(doc(firestore, "scheduledCheckIns", docId), {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error disabling scheduled check-in",
      error
    );
    return { success: false, error: error.message };
  }
};

// ============================================
// TASK CREATION FOR SENIORS (Merged: his functionality)
// ============================================

/**
 * Create a task for a senior (carerTasks collection)
 * This merges functionality from the other code: stores taskId and uses carerTasks.
 * IMPORTANT: seniorId is ALWAYS required - tasks without it will be filtered out by listeners
 */
export const createTaskForSenior = async (taskData) => {
  try {
    const { seniorId, careManagerId, taskDescription, type, status, scheduledAt } = taskData;

    // Log the incoming data for debugging
    logger.debug(
      "caremanagerFirestore",
      "createTaskForSenior called with data",
      { seniorId, careManagerId, taskDescription, type, scheduledAt }
    );

    // STRICT Validation: Ensure seniorId is present and valid
    if (!seniorId || typeof seniorId !== "string" || seniorId.trim() === "") {
      logger.error(
        "caremanagerFirestore",
        "Cannot create task: seniorId is missing, invalid, or empty",
        { seniorId, type: typeof seniorId, length: seniorId?.length }
      );
      return {
        success: false,
        error:
          "Senior ID is required and must be a non-empty string to create a task",
      };
    }

    // STRICT Validation: Ensure careManagerId is present and valid
    if (
      !careManagerId ||
      typeof careManagerId !== "string" ||
      careManagerId.trim() === ""
    ) {
      logger.error(
        "caremanagerFirestore",
        "Cannot create task: careManagerId is missing, invalid, or empty",
        { careManagerId }
      );
      return {
        success: false,
        error:
          "Care Manager ID is required and must be a non-empty string to create a task",
      };
    }

    // Trim and validate cleaned values
    const cleanSeniorId = seniorId.trim();
    const cleanCareManagerId = careManagerId.trim();

    if (cleanSeniorId.length === 0 || cleanCareManagerId.length === 0) {
      logger.error(
        "caremanagerFirestore",
        "IDs cannot be whitespace-only strings",
        null
      );
      return {
        success: false,
        error: "Senior ID and Care Manager ID cannot be empty",
      };
    }

    // STRICT Validation: Ensure type is present and valid
    if (!type || typeof type !== "string" || type.trim() === "") {
      logger.error(
        "caremanagerFirestore",
        "Cannot create task: type is missing, invalid, or empty",
        { type, typeOf: typeof type }
      );
      return {
        success: false,
        error: "Task type is required and must be a non-empty string",
      };
    }

    const cleanType = type.trim();

    const task = {
      seniorId: cleanSeniorId,
      careManagerId: cleanCareManagerId,
      taskDescription: taskDescription || "No description",
      type: cleanType,
      status: status || "pending",
      createdBy: cleanCareManagerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(scheduledAt && { scheduledAt: scheduledAt }),
    };

    const docRef = await addDoc(collection(firestore, "carerTasks"), task);
    await updateDoc(docRef, { taskId: docRef.id });
    return { success: true, taskId: docRef.id };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error creating task",
      error
    );
    return { success: false, error: error.message };
  }
};

/**
 * Listen to tasks created by this care manager (real-time)
 * Enriches tasks with seniorName by fetching senior profile where possible.
 */
export const listenToTasksCreatedByCareManager = (careManagerId, callback) => {
  try {
    const q = query(
      collection(firestore, "carerTasks"),
      where("careManagerId", "==", careManagerId)
    );

    return onSnapshot(
      q,
      async (snapshot) => {
        try {
          const taskPromises = snapshot.docs.map(async (docSnap) => {
            const taskData = docSnap.data();

            // Filter out tasks without seniorId or with empty seniorId
            if (!taskData?.seniorId || typeof taskData.seniorId !== 'string' || taskData.seniorId.trim() === '') {
              logger.error(
                "caremanagerFirestore",
                `Task missing or invalid seniorId, skipping: ${docSnap.id}`,
                { seniorId: taskData?.seniorId }
              );
              return null;
            }

            // Filter out tasks without type or with invalid type
            if (!taskData?.type || typeof taskData.type !== 'string' || taskData.type.trim() === '') {
              logger.error(
                "caremanagerFirestore",
                `Task missing or invalid type, skipping: ${docSnap.id}`,
                { type: taskData?.type, seniorId: taskData?.seniorId }
              );
              return null;
            }

            let seniorName = "Unknown Senior";

            try {
              const seniorDocRef = doc(firestore, "users", taskData.seniorId);
              const seniorProfile = await getDoc(seniorDocRef);
              if (seniorProfile.exists) {
                seniorName =
                  seniorProfile.data().name ||
                  seniorProfile.data().fullName ||
                  "Unknown Senior";
              }
            } catch (err) {
              logger.error(
                "caremanagerFirestore",
                `Error fetching senior name for ${taskData.seniorId}`,
                err
              );
            }

            return {
              id: docSnap.id,
              taskId: docSnap.id,
              ...taskData,
              seniorName,
            };
          });

          const allTasks = await Promise.all(taskPromises);
          // Filter out null values (tasks without valid seniorId)
          const tasks = allTasks.filter((task) => task !== null);
          callback(tasks);
        } catch (mapError) {
          logger.error(
            "caremanagerFirestore",
            "Error mapping tasks",
            mapError
          );
          callback([]);
        }
      },
      (error) => {
        logger.error(
          "caremanagerFirestore",
          "Error fetching care manager tasks",
          error
        );
        callback([]);
      }
    );
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error setting up care manager tasks listener",
      error
    );
    callback([]);
    return () => {};
  }
};

/**
 * Get paginated tasks created by care manager
 * Returns tasks with pagination support
 */
export const getTasksCreatedByCareManagerPaginated = async (
  careManagerId,
  pageSize = 10,
  lastDoc = null
) => {
  try {
    let q;
    if (lastDoc) {
      q = query(
        collection(firestore, "carerTasks"),
        where("careManagerId", "==", careManagerId),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(pageSize)
      );
    } else {
      q = query(
        collection(firestore, "carerTasks"),
        where("careManagerId", "==", careManagerId),
        orderBy("createdAt", "desc"),
        limit(pageSize)
      );
    }

    const snapshot = await getDocs(q);
    const tasks = [];

    for (const docSnap of snapshot.docs) {
      const taskData = docSnap.data();

      // Skip tasks without seniorId
      if (!taskData?.seniorId) {
        logger.error(
          "caremanagerFirestore",
          `Paginated task missing seniorId, skipping: ${docSnap.id}`,
          null
        );
        continue;
      }

      let seniorName = "Unknown Senior";

      try {
        const seniorDocRef = doc(firestore, "users", taskData.seniorId);
        const seniorProfile = await getDoc(seniorDocRef);
        if (seniorProfile.exists) {
          seniorName =
            seniorProfile.data().name ||
            seniorProfile.data().fullName ||
            "Unknown Senior";
        }
      } catch (err) {
        logger.error(
          "caremanagerFirestore",
          `Error fetching senior name for ${taskData.seniorId}`,
          err
        );
      }

      tasks.push({
        id: docSnap.id,
        taskId: docSnap.id,
        ...taskData,
        seniorName,
        _doc: docSnap, // Keep reference for pagination
      });
    }

    const hasMore = tasks.length === pageSize;
    const lastDocument = tasks.length > 0 ? tasks[tasks.length - 1]._doc : null;
    return { success: true, tasks, hasMore, lastDocument };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error getting paginated tasks",
      error
    );
    return { success: false, error: error.message, tasks: [], hasMore: false };
  }
};

/**
 * Update task status (only care managers can do this)
 */
export const updateTaskStatus = async (taskId, status, notes = "") => {
  try {
    const updateData = {
      status,
      notes,
      updatedAt: serverTimestamp(),
    };

    if (status === "completed") {
      updateData.completedAt = serverTimestamp();
    } else if (status === "cancelled") {
      updateData.cancelledAt = serverTimestamp();
    }

    const docRef = doc(firestore, "carerTasks", taskId);
    await updateDoc(docRef, updateData);
    return { success: true };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error updating task status",
      error
    );
    return { success: false, error: error.message };
  }
};

/**
 * UTILITY: Delete tasks without seniorId (for data cleanup)
 * Use this to clean up invalid tasks from the database
 * Cleans up tasks with:
 * - Missing or empty seniorId
 * - Invalid type or missing type
 * - Orphaned records
 */
export const deleteInvalidTasks = async (careManagerId) => {
  try {
    const q = query(
      collection(firestore, "carerTasks"),
      where("careManagerId", "==", careManagerId)
    );

    const snapshot = await getDocs(q);
    const invalidTasks = [];

    snapshot.docs.forEach((docSnap) => {
      const taskData = docSnap.data();
      
      // Check for missing or empty seniorId
      const hasMissingSeniorId = !taskData?.seniorId || 
                                 typeof taskData.seniorId !== 'string' ||
                                 taskData.seniorId.trim() === "";
      
      // Check for missing or invalid type
      const hasMissingType = !taskData?.type || 
                            typeof taskData.type !== 'string' ||
                            taskData.type.trim() === "";
      
      if (hasMissingSeniorId || hasMissingType) {
        invalidTasks.push({
          id: docSnap.id,
          data: taskData,
          reason: hasMissingSeniorId ? 'invalid_seniorId' : 'invalid_type'
        });
      }
    });

    if (invalidTasks.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    logger.error(
      "caremanagerFirestore",
      `Found ${invalidTasks.length} invalid tasks - cleaning up`,
      { tasks: invalidTasks.map(t => ({ id: t.id, reason: t.reason })) }
    );

    // Delete invalid tasks
    for (const task of invalidTasks) {
      await deleteDoc(doc(firestore, "carerTasks", task.id));
    }

    return {
      success: true,
      deletedCount: invalidTasks.length,
      deletedTasks: invalidTasks,
    };
  } catch (error) {
    logger.error(
      "caremanagerFirestore",
      "Error cleaning up invalid tasks",
      error
    );
    return { success: false, error: error.message };
  }
};
