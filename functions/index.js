/**
 * Clover Care Push Notifications - Cloud Functions
 * Simple Firestore triggers only (no IAM complexity)
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const logger = require("./logger");

admin.initializeApp();

/**
 * FUNCTION 1: Send panic alert notification
 * Triggers on both creation and forward (onWrite)
 */
exports.sendPanicAlert = functions.firestore
    .document("alerts/{alertId}")
    .onWrite(async (change, context) => {
      try {
        // Skip if document was deleted
        if (!change.after.exists) {
          return null;
        }

        const alert = change.after.data();
        const beforeAlert = change.before.exists ? change.before.data() : null;

        // Check if this is a forward (forwardedAt was just added/updated)
        const isForward = alert.forwardedAt && (!beforeAlert || !beforeAlert.forwardedAt);
        const isNewAlert = !change.before.exists;

        // Only process if it's a new alert OR a forward
        if (!isNewAlert && !isForward) {
          return null;
        }

        // Only handle panic button alerts
        if (alert.type !== "panic_button") {
          return null;
        }

        // Get senior details
        const seniorDoc = await admin.firestore()
            .collection("users")
            .doc(alert.userId)
            .get();

        if (!seniorDoc.exists) {
          logger.error("sendPanicAlert", `Senior not found: ${alert.userId}`);
          return null;
        }

        const senior = seniorDoc.data();
        const tokens = [];

        // Get care manager tokens
        if (senior.careManagerId) {
          const cm = await admin.firestore()
              .collection("users")
              .doc(senior.careManagerId)
              .get();
          if (cm.exists && cm.data().deviceTokens) {
            tokens.push(...cm.data().deviceTokens);
          }
        }

        // Get family tokens
        if (senior.linkedFamily) {
          for (const familyId of senior.linkedFamily) {
            const family = await admin.firestore()
                .collection("users")
                .doc(familyId)
                .get();
            if (family.exists && family.data().deviceTokens) {
              tokens.push(...family.data().deviceTokens);
            }
          }
        }

        if (tokens.length === 0) {
          return null;
        }

        // Remove duplicate tokens
        const uniqueTokens = [...new Set(tokens)];

        // Send notification
        await admin.messaging().sendEachForMulticast({
          notification: {
            title: "Emergency Alert",
            body: `${senior.name || "A senior"} pressed the panic button!`,
          },
          data: {
            type: "panic_alert",
            alertId: context.params.alertId,
            seniorId: alert.userId,
            screen: "alerts",
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId: "critical",
              color: "#13a4ec",
            },
          },
          tokens: uniqueTokens,
        });

        return null;
      } catch (error) {
        logger.error("sendPanicAlert", "Failed to send panic alert", error);
        return null;
      }
    });

/**
 * FUNCTION 2: Send check-in reminder (MULTI-TIME SUPPORT)
 * Scheduled to run every 5 minutes - checks all configured times
 */
exports.sendCheckInReminder = functions.pubsub
    .schedule("every 5 minutes")
    .timeZone("Asia/Kolkata")
    .onRun(async (context) => {
      try {
        const now = new Date();
        const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);
        const in20Minutes = new Date(now.getTime() + 20 * 60 * 1000);

        // Get all active scheduled check-ins
        const schedulesSnapshot = await admin.firestore()
            .collection("scheduledCheckIns")
            .where("isActive", "==", true)
            .get();

        if (schedulesSnapshot.empty) {
          return null;
        }

        for (const scheduleDoc of schedulesSnapshot.docs) {
          const schedule = scheduleDoc.data();
          const checkInTimes = schedule.checkInTimes || [];

          if (checkInTimes.length === 0) {
            continue;
          }

          // Check each configured check-in time
          for (const timeStr of checkInTimes) {
            const [h, m] = timeStr.split(":");
            const scheduledTime = new Date();
            scheduledTime.setHours(parseInt(h), parseInt(m), 0, 0);

            // Check if this time is in our 15-20 minute window
            if (scheduledTime >= in15Minutes && scheduledTime <= in20Minutes) {
              // Check if we already sent reminder today for this time
              const todayDate = now.toISOString().split("T")[0];
              const reminderKey = `checkin_${schedule.seniorId}_${timeStr}_${todayDate}`;

              const sentDoc = await admin.firestore()
                  .collection("notificationsSent")
                  .doc(reminderKey)
                  .get();

              if (sentDoc.exists) {
                continue;
              }

              // Check if already checked in for this time slot today
              const checkInWindowStart = new Date();
              checkInWindowStart.setHours(parseInt(h), parseInt(m), 0, 0);

              const logs = await admin.firestore()
                  .collection("logs")
                  .where("userId", "==", schedule.seniorId)
                  .where("logType", "==", "checkin")
                  .where("createdAt", ">=", checkInWindowStart)
                  .limit(1)
                  .get();

              if (!logs.empty) {
                continue;
              }

              // Get senior's device tokens
              const senior = await admin.firestore()
                  .collection("users")
                  .doc(schedule.seniorId)
                  .get();

              if (!senior.exists || !senior.data().deviceTokens) {
                continue;
              }

              const tokens = senior.data().deviceTokens;
              const uniqueTokens = [...new Set(tokens)];

              // Send reminder
              await admin.messaging().sendEachForMulticast({
                notification: {
                  title: "Daily Check-In Reminder",
                  body: `Time for your check-in at ${timeStr}!`,
                },
                android: {
                  notification: {
                    color: "#13a4ec",
                  },
                },
                data: {
                  type: "checkin_reminder",
                  seniorId: schedule.seniorId,
                  checkInTime: timeStr,
                  screen: "dashboard",
                },
                tokens: uniqueTokens,
              });

              // Mark as sent
              await admin.firestore()
                  .collection("notificationsSent")
                  .doc(reminderKey)
                  .set({
                    seniorId: schedule.seniorId,
                    checkInTime: timeStr,
                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                    type: "checkin_reminder",
                  });

              const logMsg = `Check-in reminder sent to ${schedule.seniorId} for ${timeStr} ` +
                  `(${uniqueTokens.length} devices)`;
              logger.info("sendCheckInReminder", logMsg);
            }
          }
        }

        return null;
      } catch (error) {
        logger.error("sendCheckInReminder", "Failed to send check-in reminder", error);
        return null;
      }
    });

/**
 * FUNCTION 3: Auto-mark missed check-ins (proactive detection)
 * Scheduled to run every 10 minutes - marks check-ins 90+ minutes past scheduled time
 */
exports.autoMarkMissedCheckIns = functions.pubsub
    .schedule("every 10 minutes")
    .timeZone("Asia/Kolkata")
    .onRun(async (context) => {
      try {
        const now = new Date();
        const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000);

        // Get all active scheduled check-ins
        const schedulesSnapshot = await admin.firestore()
            .collection("scheduledCheckIns")
            .where("isActive", "==", true)
            .get();

        if (schedulesSnapshot.empty) {
          return null;
        }

        for (const scheduleDoc of schedulesSnapshot.docs) {
          const schedule = scheduleDoc.data();
          const checkInTimes = schedule.checkInTimes || [];

          if (checkInTimes.length === 0) {
            continue;
          }
          // Check each configured check-in time
          for (const timeStr of checkInTimes) {
            const [h, m] = timeStr.split(":");
            const scheduledTime = new Date();
            scheduledTime.setHours(parseInt(h), parseInt(m), 0, 0);

            // If this time was 90+ minutes ago
            if (scheduledTime <= ninetyMinutesAgo) {
              // Check if senior already has a check-in for this time today
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);

              const existingCheckIns = await admin.firestore()
                  .collection("logs")
                  .where("userId", "==", schedule.seniorId)
                  .where("logType", "==", "checkin")
                  .where("scheduledTime", "==", timeStr)
                  .where("createdAt", ">=", today)
                  .where("createdAt", "<", tomorrow)
                  .limit(1)
                  .get();

              if (!existingCheckIns.empty) {
                continue;
              }

              // Check if we already marked this as missed today
              const todayDate = now.toISOString().split("T")[0];
              const missedKey = `missed_${schedule.seniorId}_${timeStr}_${todayDate}`;

              const missedDoc = await admin.firestore()
                  .collection("notificationsSent")
                  .doc(missedKey)
                  .get();

              if (missedDoc.exists) {
                continue;
              }

              // Create a missed check-in log entry
              const logData = {
                logType: "checkin",
                userId: schedule.seniorId,
                status: "missed",
                scheduledTime: timeStr,
                source: "system_auto_marked",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                markedMissedAt: admin.firestore.FieldValue.serverTimestamp(),
              };

              await admin.firestore()
                  .collection("logs")
                  .add(logData);

              // Track that we marked this as missed
              await admin.firestore()
                  .collection("notificationsSent")
                  .doc(missedKey)
                  .set({
                    seniorId: schedule.seniorId,
                    checkInTime: timeStr,
                    markedMissedAt: admin.firestore.FieldValue.serverTimestamp(),
                    type: "auto_missed_detection",
                  });
            }
          }
        }

        return null;
      } catch (error) {
        logger.error("autoMarkMissedCheckIns", "Failed to check missed check-ins", error);
        return null;
      }
    });

/**
 * FUNCTION 4: Send task assignment notification (bidirectional)
 * Triggers when a new task is created in carerTasks collection
 */
exports.sendTaskAssignmentNotification = functions.firestore
    .document("carerTasks/{taskId}")
    .onCreate(async (snap, context) => {
      try {
        const task = snap.data();
        // Determine direction: senior created OR family/CM created
        const seniorCreated = task.createdBy === task.userId;
        const tokens = [];
        let notificationTitle = "";
        let notificationBody = "";

        if (seniorCreated) {
          // Senior created task → notify Care Manager + Family

          // Get senior details
          const seniorDoc = await admin.firestore()
              .collection("users")
              .doc(task.userId)
              .get();

          if (!seniorDoc.exists) {
            logger.error("sendTaskAssignmentNotification", `Senior not found: ${task.userId}`);
            return null;
          }
          const senior = seniorDoc.data();

          // Get care manager tokens
          if (senior.careManagerId) {
            const cm = await admin.firestore()
                .collection("users")
                .doc(senior.careManagerId)
                .get();
            if (cm.exists && cm.data().deviceTokens) {
              tokens.push(...cm.data().deviceTokens);
            } else {
              // no cm tokens
            }
          }

          // Get family tokens
          if (senior.linkedFamily) {
            for (const familyId of senior.linkedFamily) {
              const family = await admin.firestore()
                  .collection("users")
                  .doc(familyId)
                  .get();
              if (family.exists && family.data().deviceTokens) {
                tokens.push(...family.data().deviceTokens);
              } else {
                logger.warn("Notification", `Family member has no tokens: ${familyId}`);
              }
            }
          } else {
            logger.warn("Notification", "Senior has no linkedFamily");
          }

          notificationTitle = "New Task Request";
          notificationBody = `${senior.name || "Senior"} created a task: ${task.title}`;
        } else {
          // Family/CM created task → notify Senior

          const seniorDoc = await admin.firestore()
              .collection("users")
              .doc(task.userId)
              .get();

          if (seniorDoc.exists) {
            const seniorData = seniorDoc.data();
            if (seniorData.deviceTokens) {
              tokens.push(...seniorData.deviceTokens);
            }
          }

          notificationTitle = "New Task Assigned";
          notificationBody = `You have a new task: ${task.title}`;
        }


        if (tokens.length === 0) {
          return null;
        }

        // Remove duplicate tokens
        const uniqueTokens = [...new Set(tokens)];

        // Send notification
        await admin.messaging().sendEachForMulticast({
          notification: {
            title: notificationTitle,
            body: notificationBody,
          },
          data: {
            type: "task_assigned",
            taskId: context.params.taskId,
            seniorId: task.userId,
            screen: "dashboard",
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              color: "#13a4ec",
            },
          },
          tokens: uniqueTokens,
        });

        return null;
      } catch (error) {
        logger.error("sendTaskAssignmentNotification", "Failed to send task notification", error);
        return null;
      }
    });

/**
 * FUNCTION 5: Send health update notification to family members
 * Triggers when a health log is created in the healthLogs collection
 */
exports.sendHealthUpdateNotification = functions.firestore
    .document("healthLogs/{logId}")
    .onCreate(async (snap, context) => {
      try {
        const log = snap.data();

        // Get senior details
        const seniorDoc = await admin.firestore()
            .collection("users")
            .doc(log.seniorId)
            .get();

        if (!seniorDoc.exists) {
          logger.error("sendHealthUpdateNotification", `Senior not found: ${log.seniorId}`);
          return null;
        }

        const senior = seniorDoc.data();
        const tokens = [];

        // Get all family member tokens
        if (senior.linkedFamily) {
          for (const familyId of senior.linkedFamily) {
            const family = await admin.firestore()
                .collection("users")
                .doc(familyId)
                .get();
            if (family.exists) {
              const familyData = family.data();
              if (familyData.deviceTokens) {
                tokens.push(...familyData.deviceTokens);
              }
            }
          }
        }

        // Get care manager tokens as fallback
        if (senior.careManagerId) {
          const cm = await admin.firestore()
              .collection("users")
              .doc(senior.careManagerId)
              .get();
          if (cm.exists && cm.data().deviceTokens) {
            tokens.push(...cm.data().deviceTokens);
          }
        }

        if (tokens.length === 0) {
          return null;
        }

        // Remove duplicate tokens
        const uniqueTokens = [...new Set(tokens)];

        // Build notification body
        let body = `New health update for ${senior.name || "senior"}`;
        if (log.vitals && log.vitals.bloodPressure) body += ` - BP: ${log.vitals.bloodPressure}`;
        if (log.vitals && log.vitals.bloodSugar) body += ` - Sugar: ${log.vitals.bloodSugar}`;

        // Send notification
        await admin.messaging().sendEachForMulticast({
          notification: {
            title: "Health Update",
            body: body,
          },
          data: {
            type: "health_update",
            logId: context.params.logId,
            seniorId: log.seniorId,
            screen: "seniordetails",
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              color: "#13a4ec",
            },
          },
          tokens: uniqueTokens,
        });

        return null;
      } catch (error) {
        logger.error("sendHealthUpdateNotification", "Failed to send health update", error);
        return null;
      }
    });

/**
 * FUNCTION 6: Send service request status update notification
 * Triggers when task status is updated to completed/missed/cancelled
 */
exports.sendServiceRequestStatusUpdate = functions.firestore
    .document("carerTasks/{taskId}")
    .onUpdate(async (change, context) => {
      try {
        const before = change.before.data();
        const after = change.after.data();

        // Only process if status changed to completed, missed, or cancelled
        if (before.status === after.status) {
          return null;
        }

        const validStatuses = ["completed", "missed", "cancelled"];
        if (!validStatuses.includes(after.status)) {
          return null;
        }


        // Get senior details - tasks use seniorId field
        const seniorDoc = await admin.firestore()
            .collection("users")
            .doc(after.userId)
            .get();

        if (!seniorDoc.exists) {
          console.error("Senior not found");
          return null;
        }

        const senior = seniorDoc.data();
        const tokens = [];

        // Get senior tokens
        if (senior.deviceTokens) {
          tokens.push(...senior.deviceTokens);
        }

        // Get care manager tokens (bidirectional - notify CM too)
        if (senior.careManagerId) {
          const cmDoc = await admin.firestore()
              .collection("users")
              .doc(senior.careManagerId)
              .get();
          if (cmDoc.exists && cmDoc.data().deviceTokens) {
            tokens.push(...cmDoc.data().deviceTokens);
          }
        }

        // Get family tokens
        if (senior.linkedFamily) {
          for (const familyId of senior.linkedFamily) {
            const family = await admin.firestore()
                .collection("users")
                .doc(familyId)
                .get();
            if (family.exists && family.data().deviceTokens) {
              tokens.push(...family.data().deviceTokens);
            }
          }
        } else {
          // no family linked
        }


        if (tokens.length === 0) {
          return null;
        }

        // Remove duplicate tokens
        const uniqueTokens = [...new Set(tokens)];

        // Build notification message
        const statusText = after.status === "completed" ? "completed" :
                          after.status === "cancelled" ? "cancelled" : "marked as missed";

        // Send notification
        await admin.messaging().sendEachForMulticast({
          notification: {
            title: "Service Request Update",
            body: `Your request "${after.title}" has been ${statusText}`,
          },
          data: {
            type: "service_status_update",
            taskId: context.params.taskId,
            seniorId: after.userId,
            status: after.status,
            screen: "requests",
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              color: "#13a4ec",
            },
          },
          tokens: uniqueTokens,
        });

        return null;
      } catch (error) {
        logger.error("sendServiceRequestStatusUpdate", "Failed to send status update", error);
        return null;
      }
    });

/**
 * FUNCTION 7: Send care manager assignment notification
 * Triggers when a senior's careManagerId is updated
 */
exports.sendCareManagerAssignmentNotification = functions.firestore
    .document("users/{userId}")
    .onUpdate(async (change, context) => {
      try {
        const before = change.before.data();
        const after = change.after.data();

        // Only process if careManagerId changed and user is a senior
        if (before.careManagerId === after.careManagerId || after.role !== "senior") {
          return null;
        }

        // Skip if careManagerId is being removed
        if (!after.careManagerId) {
          return null;
        }


        const tokens = [];

        // Get senior tokens
        if (after.deviceTokens) {
          tokens.push(...after.deviceTokens);
        }

        // Get care manager tokens
        const cmDoc = await admin.firestore()
            .collection("users")
            .doc(after.careManagerId)
            .get();

        if (cmDoc.exists && cmDoc.data().deviceTokens) {
          tokens.push(...cmDoc.data().deviceTokens);
        }

        if (tokens.length === 0) {
          return null;
        }

        // Remove duplicate tokens
        const uniqueTokens = [...new Set(tokens)];

        const cmName = cmDoc.exists ? cmDoc.data().name || "Care Manager" : "Care Manager";

        // Send notification
        await admin.messaging().sendEachForMulticast({
          notification: {
            title: "Care Manager Assigned",
            body: `${cmName} has been assigned as your care manager`,
          },
          data: {
            type: "care_manager_assigned",
            seniorId: context.params.userId,
            careManagerId: after.careManagerId,
            screen: "settings",
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              color: "#13a4ec",
            },
          },
          tokens: uniqueTokens,
        });

        return null;
      } catch (error) {
        logger.error("sendCareManagerAssignmentNotification", "Failed to send assignment notification", error);
        return null;
      }
    });

/**
 * FUNCTION 8: Send routine reminders (15 minutes before scheduled time)
 * Scheduled to run every 5 minutes
 */
exports.sendRoutineReminders = functions.pubsub
    .schedule("every 5 minutes")
    .timeZone("Asia/Kolkata")
    .onRun(async (context) => {
      try {
        const now = new Date();
        const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);
        const in20Minutes = new Date(now.getTime() + 20 * 60 * 1000);

        // Get current time in HH:mm format for 15-20 min window
        const timeStart = in15Minutes.getHours();
        const timeStartMin = in15Minutes.getMinutes();
        const targetTimeStart = `${String(timeStart).padStart(2, "0")}:${String(timeStartMin).padStart(2, "0")}`;
        const timeEnd = in20Minutes.getHours();
        const timeEndMin = in20Minutes.getMinutes();
        const targetTimeEnd = `${String(timeEnd).padStart(2, "0")}:${String(timeEndMin).padStart(2, "0")}`;

        // Get all active routines
        const routinesSnapshot = await admin.firestore()
            .collection("routines")
            .where("isActive", "==", true)
            .get();

        if (routinesSnapshot.empty) {
          return null;
        }

        const today = now.toLocaleDateString("en-US", {weekday: "short"});

        for (const routineDoc of routinesSnapshot.docs) {
          const routine = routineDoc.data();

          // Check if routine is scheduled for today
          if (!routine.scheduledDays || !routine.scheduledDays.includes(today)) {
            continue;
          }

          // Check if routine time is in our target window
          if (routine.scheduledTime >= targetTimeStart && routine.scheduledTime <= targetTimeEnd) {
            // Check if we already sent reminder today
            const todayDate = now.toISOString().split("T")[0];
            const sentDoc = await admin.firestore()
                .collection("notificationsSent")
                .doc(`routine_${routineDoc.id}_${todayDate}`)
                .get();

            if (sentDoc.exists) {
              continue;
            }

            // Get senior tokens and family/care manager tokens
            const seniorDoc = await admin.firestore()
                .collection("users")
                .doc(routine.userId)
                .get();

            if (!seniorDoc.exists) {
              continue;
            }

            const senior = seniorDoc.data();
            const tokens = [];

            // Add senior's tokens
            if (senior.deviceTokens) {
              tokens.push(...senior.deviceTokens);
            }

            // Get care manager tokens
            if (senior.careManagerId) {
              const cm = await admin.firestore()
                  .collection("users")
                  .doc(senior.careManagerId)
                  .get();
              if (cm.exists && cm.data().deviceTokens) {
                tokens.push(...cm.data().deviceTokens);
              }
            }

            // Get family tokens
            if (senior.linkedFamily && Array.isArray(senior.linkedFamily)) {
              for (const familyId of senior.linkedFamily) {
                const family = await admin.firestore()
                    .collection("users")
                    .doc(familyId)
                    .get();
                if (family.exists && family.data().deviceTokens) {
                  tokens.push(...family.data().deviceTokens);
                }
              }
            }

            if (tokens.length === 0) {
              continue;
            }

            // Remove duplicate tokens
            const uniqueTokens = [...new Set(tokens)];

            // Send notification
            await admin.messaging().sendEachForMulticast({
              notification: {
                title: "Routine Reminder",
                body: `Coming up in 15 minutes: ${routine.activity} (${senior.name || "Senior"})`,
              },
              data: {
                type: "routine_reminder",
                routineId: routineDoc.id,
                seniorId: routine.userId,
                screen: "routines",
              },
              android: {
                notification: {
                  sound: "default",
                  color: "#13a4ec",
                },
              },
              tokens: uniqueTokens,
            });

            // Mark as sent
            await admin.firestore()
                .collection("notificationsSent")
                .doc(`routine_${routineDoc.id}_${todayDate}`)
                .set({
                  routineId: routineDoc.id,
                  userId: routine.userId,
                  sentAt: admin.firestore.FieldValue.serverTimestamp(),
                  type: "routine_reminder",
                });
          }
        }

        return null;
      } catch (error) {
        logger.error("sendRoutineReminders", "Failed to send routine reminders", error);
        return null;
      }
    });

/**
 * FUNCTION 9: Check for missed routines (30 minutes after scheduled time)
 * Scheduled to run every 10 minutes
 */
exports.checkMissedRoutines = functions.pubsub
    .schedule("every 10 minutes")
    .timeZone("Asia/Kolkata")
    .onRun(async (context) => {
      try {
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
        const fortyMinutesAgo = new Date(now.getTime() - 40 * 60 * 1000);

        // Get time window for routines that should have been completed
        const startHour = fortyMinutesAgo.getHours();
        const startMin = fortyMinutesAgo.getMinutes();
        const targetTimeStart = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
        const endHour = thirtyMinutesAgo.getHours();
        const endMin = thirtyMinutesAgo.getMinutes();
        const targetTimeEnd = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

        // Get all active routines
        const routinesSnapshot = await admin.firestore()
            .collection("routines")
            .where("isActive", "==", true)
            .get();

        if (routinesSnapshot.empty) {
          return null;
        }

        const today = now.toLocaleDateString("en-US", {weekday: "short"});
        const todayDate = now.toISOString().split("T")[0];

        for (const routineDoc of routinesSnapshot.docs) {
          const routine = routineDoc.data();

          // Check if routine was scheduled for today
          if (!routine.scheduledDays || !routine.scheduledDays.includes(today)) {
            continue;
          }

          // Check if routine time is in our target window
          if (routine.scheduledTime >= targetTimeStart && routine.scheduledTime <= targetTimeEnd) {
            // Check if already sent missed alert today
            const alertDoc = await admin.firestore()
                .collection("notificationsSent")
                .doc(`routine_missed_${routineDoc.id}_${todayDate}`)
                .get();

            if (alertDoc.exists) {
              continue;
            }

            // Check if routine was completed today
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const logsSnapshot = await admin.firestore()
                .collection("logs")
                .where("userId", "==", routine.userId)
                .where("logType", "==", "routine")
                .where("routineId", "==", routineDoc.id)
                .where("createdAt", ">=", todayStart)
                .limit(1)
                .get();

            if (!logsSnapshot.empty) {
              continue;
            }

            // Routine was missed - notify Senior, CM and Family
            const seniorDoc = await admin.firestore()
                .collection("users")
                .doc(routine.userId)
                .get();

            if (!seniorDoc.exists) {
              continue;
            }

            const senior = seniorDoc.data();
            const tokens = [];

            // Add senior's tokens
            if (senior.deviceTokens) {
              tokens.push(...senior.deviceTokens);
            }

            // Get care manager tokens
            if (senior.careManagerId) {
              const cm = await admin.firestore()
                  .collection("users")
                  .doc(senior.careManagerId)
                  .get();
              if (cm.exists && cm.data().deviceTokens) {
                tokens.push(...cm.data().deviceTokens);
              }
            }

            // Get family tokens
            if (senior.linkedFamily) {
              for (const familyId of senior.linkedFamily) {
                const family = await admin.firestore()
                    .collection("users")
                    .doc(familyId)
                    .get();
                if (family.exists && family.data().deviceTokens) {
                  tokens.push(...family.data().deviceTokens);
                }
              }
            }

            if (tokens.length === 0) {
              continue;
            }

            // Remove duplicate tokens
            const uniqueTokens = [...new Set(tokens)];

            // Send notification
            await admin.messaging().sendEachForMulticast({
              notification: {
                title: "Routine Missed",
                body: `${senior.name || "Senior"} missed: ${routine.activity} (scheduled at ${routine.scheduledTime})`,
              },
              data: {
                type: "routine_missed",
                routineId: routineDoc.id,
                seniorId: routine.userId,
                screen: "seniordetails",
              },
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                  color: "#13a4ec",
                },
              },
              tokens: uniqueTokens,
            });

            // Mark as sent
            await admin.firestore()
                .collection("notificationsSent")
                .doc(`routine_missed_${routineDoc.id}_${todayDate}`)
                .set({
                  routineId: routineDoc.id,
                  userId: routine.userId,
                  sentAt: admin.firestore.FieldValue.serverTimestamp(),
                  type: "routine_missed",
                });
          }
        }

        return null;
      } catch (error) {
        logger.error("checkMissedRoutines", "Failed to check missed routines", error);
        return null;
      }
    });

/**
 * FUNCTION 10: Send reminder notifications 10 minutes before scheduled time
 * Scheduled to run every 5 minutes
 */
exports.sendReminderNotifications = functions.pubsub
    .schedule("every 5 minutes")
    .timeZone("Asia/Kolkata")
    .onRun(async (context) => {
      try {
        const now = new Date();
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
        const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

        // Get pending reminders with scheduled time in the next 10-15 minutes
        const remindersSnapshot = await admin.firestore()
            .collection("reminders")
            .where("status", "==", "pending")
            .where("scheduledTime", ">=", tenMinutesFromNow)
            .where("scheduledTime", "<=", fifteenMinutesFromNow)
            .get();

        if (remindersSnapshot.empty) {
          return null;
        }

        for (const reminderDoc of remindersSnapshot.docs) {
          const reminder = reminderDoc.data();

          // Only send if created by family or care manager (not by senior themselves)
          if (reminder.createdBy === reminder.userId) {
            continue;
          }

          // Check if already sent
          const sentDoc = await admin.firestore()
              .collection("notificationsSent")
              .doc(`reminder_${reminderDoc.id}`)
              .get();

          if (sentDoc.exists) {
            continue;
          }

          // Get senior tokens and family/care manager tokens
          const seniorDoc = await admin.firestore()
              .collection("users")
              .doc(reminder.userId)
              .get();

          if (!seniorDoc.exists) {
            continue;
          }

          const senior = seniorDoc.data();
          const tokens = [];

          // Add senior's tokens
          if (senior.deviceTokens) {
            tokens.push(...senior.deviceTokens);
          }

          // Get care manager tokens
          if (senior.careManagerId) {
            const cm = await admin.firestore()
                .collection("users")
                .doc(senior.careManagerId)
                .get();
            if (cm.exists && cm.data().deviceTokens) {
              tokens.push(...cm.data().deviceTokens);
            }
          }

          // Get family tokens
          if (senior.linkedFamily && Array.isArray(senior.linkedFamily)) {
            for (const familyId of senior.linkedFamily) {
              const family = await admin.firestore()
                  .collection("users")
                  .doc(familyId)
                  .get();
              if (family.exists && family.data().deviceTokens) {
                tokens.push(...family.data().deviceTokens);
              }
            }
          }

          if (tokens.length === 0) {
            continue;
          }

          // Remove duplicate tokens
          const uniqueTokens = [...new Set(tokens)];

          // Send notification
          await admin.messaging().sendEachForMulticast({
            notification: {
              title: "Reminder",
              body: `Reminder in 10 minutes: ${reminder.title} (${senior.name || "Senior"})`,
            },
            data: {
              type: "reminder_notification",
              reminderId: reminderDoc.id,
              seniorId: reminder.userId,
              screen: "dashboard",
            },
            android: {
              notification: {
                sound: "default",
                color: "#13a4ec",
              },
            },
            tokens: uniqueTokens,
          });

          // Mark as sent
          await admin.firestore()
              .collection("notificationsSent")
              .doc(`reminder_${reminderDoc.id}`)
              .set({
                reminderId: reminderDoc.id,
                userId: reminder.userId,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                type: "reminder_notification",
              });
        }

        return null;
      } catch (error) {
        logger.error("sendReminderNotifications", "Failed to send reminder notifications", error);
        return null;
      }
    });

/**
 * FUNCTION 11: Check for missed reminders (30 minutes after scheduled time)
 * Scheduled to run every 10 minutes
 * Notifies senior, family, and care manager when reminder is missed
 */
exports.checkMissedReminders = functions.pubsub
    .schedule("every 10 minutes")
    .timeZone("Asia/Kolkata")
    .onRun(async (context) => {
      try {
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

        // Get pending reminders that passed their scheduled time 30+ minutes ago
        const remindersSnapshot = await admin.firestore()
            .collection("reminders")
            .where("status", "==", "pending")
            .where("scheduledTime", "<=", thirtyMinutesAgo)
            .get();

        if (remindersSnapshot.empty) {
          return null;
        }

        const todayDate = now.toISOString().split("T")[0];

        for (const reminderDoc of remindersSnapshot.docs) {
          const reminder = reminderDoc.data();

          // Check if already sent missed alert for this reminder
          const sentDoc = await admin.firestore()
              .collection("notificationsSent")
              .doc(`reminder_missed_${reminderDoc.id}_${todayDate}`)
              .get();

          if (sentDoc.exists) {
            continue;
          }

          // Update reminder status to missed
          await admin.firestore()
              .collection("reminders")
              .doc(reminderDoc.id)
              .update({
                status: "missed",
                missedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });

          // Get senior and their family/care manager info
          const seniorDoc = await admin.firestore()
              .collection("users")
              .doc(reminder.userId)
              .get();

          if (!seniorDoc.exists) {
            continue;
          }

          const senior = seniorDoc.data();
          const tokens = [];

          // Add senior's tokens
          if (senior.deviceTokens) {
            tokens.push(...senior.deviceTokens);
          }

          // Get care manager tokens
          if (senior.careManagerId) {
            const cm = await admin.firestore()
                .collection("users")
                .doc(senior.careManagerId)
                .get();
            if (cm.exists && cm.data().deviceTokens) {
              tokens.push(...cm.data().deviceTokens);
            }
          }

          // Get family tokens
          if (senior.linkedFamily && Array.isArray(senior.linkedFamily)) {
            for (const familyId of senior.linkedFamily) {
              const family = await admin.firestore()
                  .collection("users")
                  .doc(familyId)
                  .get();
              if (family.exists && family.data().deviceTokens) {
                tokens.push(...family.data().deviceTokens);
              }
            }
          }

          if (tokens.length === 0) {
            continue;
          }

          // Remove duplicate tokens
          const uniqueTokens = [...new Set(tokens)];

          // Send notification
          await admin.messaging().sendEachForMulticast({
            notification: {
              title: "Reminder Missed",
              body: `${senior.name || "Senior"} missed reminder: ${reminder.title}`,
            },
            data: {
              type: "reminder_missed",
              reminderId: reminderDoc.id,
              seniorId: reminder.userId,
              screen: "dashboard",
            },
            android: {
              priority: "high",
              notification: {
                sound: "default",
                color: "#13a4ec",
              },
            },
            tokens: uniqueTokens,
          });

          // Mark as sent
          await admin.firestore()
              .collection("notificationsSent")
              .doc(`reminder_missed_${reminderDoc.id}_${todayDate}`)
              .set({
                reminderId: reminderDoc.id,
                userId: reminder.userId,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                type: "reminder_missed",
              });
        }

        return null;
      } catch (error) {
        logger.error("checkMissedReminders", "Failed to check missed reminders", error);
        return null;
      }
    });

