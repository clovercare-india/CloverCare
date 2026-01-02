import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ScrollView, StatusBar, Text, TouchableOpacity, View, RefreshControl, BackHandler, ToastAndroid, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from 'react-native-paper';
import CareManagerBottomNav from '../../components/CareManagerBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import '../../global.css';
import { colors } from '../../theme/colors';
import { translations as translationData, loadLanguage } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { 
  listenToCarerTasksForAssignedSeniors, 
  listenToAlertsForAssignedSeniors, 
  listenToSeniorLogsForAssignedSeniors, 
  listenToCheckinsForAssignedSeniors, 
  listenToRemindersForAssignedSeniors,
  listenToRoutinesForAssignedSeniors,
  listenToAssignedSeniorIds,
  getCareManagerAssignedSeniorsWithDetails
} from '../../firestore/caremanagerFirestore';

export default function CareManagerDashboard() {
  const { user } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [refreshing, setRefreshing] = useState(false);

  const translations = translationData[currentLanguage];
  const [stats, setStats] = useState({
    tasksCompleted: 0,
    pendingTasks: 0,
    missedRoutines: 0,
    recentAlerts: 0,
  });
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [taskQueue, setTaskQueue] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [assignedRoutines, setAssignedRoutines] = useState([]);
  const [seniorLogs, setSeniorLogs] = useState([]);
  const [combinedAlerts, setCombinedAlerts] = useState([]);
  const [dailyCheckins, setDailyCheckins] = useState([]);
  const [assignedSeniorIds, setAssignedSeniorIds] = useState([]);
  const [assignedSeniors, setAssignedSeniors] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);

  // Back button handler
  const backPressCount = useRef(0);
  const backPressTimer = useRef(null);

  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  // Handle Android back button - double tap to exit
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      backPressCount.current += 1;

      if (backPressCount.current === 1) {
        // First press - show toast
        if (Platform.OS === 'android') {
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        }

        // Reset counter after 2 seconds
        backPressTimer.current = setTimeout(() => {
          backPressCount.current = 0;
        }, 2000);

        return true; // Prevent default back behavior
      } else if (backPressCount.current === 2) {
        // Second press - exit app
        BackHandler.exitApp();
        return false;
      }

      return true;
    });

    // Cleanup
    return () => {
      backHandler.remove();
      if (backPressTimer.current) {
        clearTimeout(backPressTimer.current);
      }
    };
  }, []);

  // Fetch assigned seniors with real-time listener
  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    // Listen to real-time changes in assigned seniors (when reassigned from admin)
    const unsubscribeAssignedSeniors = listenToAssignedSeniorIds(user.uid, async (seniorIds) => {
      setAssignedSeniorIds(seniorIds);
      
      // Fetch full senior details
      try {
        const detailsResult = await getCareManagerAssignedSeniorsWithDetails(user.uid);
        if (detailsResult.success) {
          setAssignedSeniors(detailsResult.seniors || []);
        }
      } catch (_error) {
        setAssignedSeniors([]);
      }
    });

    return () => {
      if (unsubscribeAssignedSeniors) unsubscribeAssignedSeniors();
    };
  }, [user?.uid]);

  // Helper function to get senior name by ID
  const getSeniorName = useCallback((seniorId) => {
    const senior = assignedSeniors.find(s => s.id === seniorId);
    return senior ? `${senior.firstName || ''} ${senior.lastName || ''}`.trim() || senior.name || `Senior ${seniorId}` : `Senior ${seniorId}`;
  }, [assignedSeniors]);

  // Helper function to safely format timestamps
  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return 'Unknown';
    
    try {
      let date;
      
      // Handle Firestore Timestamp
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } 
      // Handle timestamp objects with seconds
      else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      }
      // Handle string or number timestamps
      else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        date = new Date(timestamp);
      }
      // Handle Date objects
      else if (timestamp instanceof Date) {
        date = timestamp;
      }
      else {
        return 'Unknown';
      }
      
      // Validate the date
      if (isNaN(date.getTime())) {
        return 'Unknown';
      }
      
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (_error) {
      return 'Unknown';
    }
  }, []);

  // Listen to carer tasks (service requests and CM tasks)
  useEffect(() => {
    if (!user?.uid || assignedSeniorIds.length === 0) return;

    const unsubscribe = listenToCarerTasksForAssignedSeniors(assignedSeniorIds, (tasks) => {
      setAssignedTasks(tasks);
    });

    return () => unsubscribe();
  }, [user?.uid, assignedSeniorIds]);

  // Listen to reminders
  useEffect(() => {
    if (!user?.uid || assignedSeniorIds.length === 0) return;

    const unsubscribe = listenToRemindersForAssignedSeniors(assignedSeniorIds, (remindersList) => {
      setReminders(remindersList);
    });

    return () => unsubscribe();
  }, [user?.uid, assignedSeniorIds]);

  // Listen to routines
  useEffect(() => {
    if (!user?.uid || assignedSeniorIds.length === 0) return;

    const unsubscribe = listenToRoutinesForAssignedSeniors(assignedSeniorIds, (routinesList) => {
      setAssignedRoutines(routinesList);
    });

    return () => unsubscribe();
  }, [user?.uid, assignedSeniorIds]);

  // Merge tasks and calculate stats
  useEffect(() => {
    const mergedTasks = [
      ...assignedTasks.map(t => ({
        id: t.id || t.taskId,
        type: 'task',
        seniorId: t.seniorId || t.userId,
        seniorName: t.seniorName || getSeniorName(t.seniorId || t.userId),
        taskDescription: t.taskDescription || t.title || 'Task',
        status: t.status === 'in_progress' ? 'pending' : t.status,
        createdAt: t.createdAt,
        scheduledTime: t.createdAt
      })),
      ...reminders.map(rem => ({
        id: rem.reminderId || rem.id,
        type: 'reminder',
        seniorId: rem.userId,
        seniorName: rem.seniorName || 'Senior',
        taskDescription: `Reminder: ${rem.title}`,
        status: rem.status,
        createdAt: rem.createdAt,
        scheduledTime: rem.scheduledTime
      })),
      ...assignedRoutines.map(routine => ({
        id: routine.id,
        type: 'routine',
        seniorId: routine.userId,
        seniorName: routine.seniorName || 'Senior',
        taskDescription: `Routine: ${routine.title}`,
        status: routine.status || 'pending',
        createdAt: routine.createdAt,
        scheduledTime: routine.scheduledTime
      }))
    ];
    
    setTaskQueue(mergedTasks.slice(0, 3));
    
    // Calculate stats from merged tasks
    const completed = mergedTasks.filter(t => t.status === 'completed').length;
    const pending = mergedTasks.filter(t => t.status === 'pending').length;
    const missed = mergedTasks.filter(t => t.status === 'missed').length;
    
    setStats(prev => ({
      ...prev,
      tasksCompleted: completed,
      pendingTasks: pending,
      missedRoutines: missed
    }));
  }, [assignedTasks, reminders, assignedRoutines, getSeniorName]);

  // Listen to alerts - only count active ones
  useEffect(() => {
    if (!user?.uid || assignedSeniorIds.length === 0) return;

    const unsubscribe = listenToAlertsForAssignedSeniors(assignedSeniorIds, (alerts) => {
      // Filter to only active alerts
      const activeAlerts = alerts.filter(alert => 
        alert.status === 'active' || alert.status === 'pending' || !alert.status
      );
      
      setRecentAlerts(activeAlerts.slice(0, 2));
      setStats(prev => ({
        ...prev,
        recentAlerts: activeAlerts.length
      }));
    });

    return () => unsubscribe();
  }, [user?.uid, assignedSeniorIds]);

  // Listen to health logs
  // Listen to senior logs
  useEffect(() => {
    if (!user?.uid || assignedSeniorIds.length === 0) return;

    const unsubscribe = listenToSeniorLogsForAssignedSeniors(assignedSeniorIds, (logs) => {
      setSeniorLogs(logs);
    });

    return () => unsubscribe();
  }, [user?.uid, assignedSeniorIds]);

  // Listen to daily check-ins
  useEffect(() => {
    if (!user?.uid || assignedSeniorIds.length === 0) return;

    const unsubscribe = listenToCheckinsForAssignedSeniors(assignedSeniorIds, (checkins) => {
      setDailyCheckins(checkins);
    });

    return () => unsubscribe();
  }, [user?.uid, assignedSeniorIds]);

  // Combine alerts, senior logs, and check-ins for display
  useEffect(() => {
    const allAlerts = [...recentAlerts];
    
    const seniorLogAlerts = seniorLogs.map(log => ({
      id: log.id,
      type: log.type,
      seniorName: log.seniorName || getSeniorName(log.seniorId || log.userId),
      seniorId: log.seniorId || log.userId,
      data: log.data,
      timestamp: log.timestamp,
      createdAt: log.timestamp,
      status: 'active'
    }));
    
    const checkinAlerts = dailyCheckins.map(checkin => ({
      id: checkin.id,
      type: 'daily_checkin_new',
      seniorId: checkin.userId,
      seniorName: getSeniorName(checkin.userId),
      data: { mood: checkin.mood, status: checkin.status },
      timestamp: checkin.createdAt || checkin.timestamp,
      createdAt: checkin.createdAt || checkin.timestamp,
      status: 'active'
    }));
    
    allAlerts.push(...seniorLogAlerts, ...checkinAlerts);
    
    allAlerts.sort((a, b) => {
      const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return timeB - timeA;
    });
    
    setCombinedAlerts(allAlerts.slice(0, 4));
  }, [recentAlerts, seniorLogs, dailyCheckins, assignedSeniors, getSeniorName]);

  // Helper function to format alert data for UI
  const formatAlertForUI = (alert) => {
    if (alert.type === 'daily_checkin_new') {
      const moodData = alert.data || {};
      const statusIcon = moodData.status === 'completed' ? '✅' : moodData.status === 'missed' ? '⚠️' : '⏳';
      return {
        message: `${statusIcon} Daily check-in: ${moodData.mood || 'Completed'}`,
        icon: 'sentiment-satisfied',
        borderColor: moodData.status === 'completed' ? colors.status.success : moodData.status === 'missed' ? colors.status.error : colors.status.warning,
        bgColor: moodData.status === 'completed' ? colors.status.success + '20' : moodData.status === 'missed' ? colors.status.error + '20' : colors.status.warning + '20',
        seniorName: alert.seniorName || 'Senior',
        time: formatTimestamp(alert.createdAt)
      };
    }

    if (alert.type === 'daily_checkin') {
      const moodData = alert.data || {};
      return {
        message: `Daily check-in: ${moodData.mood || 'Mood updated'}`,
        icon: moodData.moodIcon || 'sentiment-satisfied',
        borderColor: moodData.moodColor || colors.status.success,
        bgColor: colors.status.success + '20',
        seniorName: alert.seniorName || 'Senior',
        time: formatTimestamp(alert.createdAt)
      };
    }

    const alertConfig = {
      panic_button: {
        message: translations.emergencyButtonPressed,
        icon: 'notifications-active', // Changed from 'emergency' to 'notifications-active' for better look
        borderColor: colors.status.error,
        bgColor: colors.status.error + '20',
      },
      missed_checkin: {
        message: translations.morningCheckInMissed,
        icon: 'event-busy',
        borderColor: colors.status.warning,
        bgColor: colors.status.warning + '20',
      }
    };

    const config = alertConfig[alert.type] || alertConfig.panic_button;

    return {
      ...alert,
      seniorName: alert.seniorName || 'Senior',
      message: alert.message || config.message,
      time: formatTimestamp(alert.createdAt),
      icon: config.icon,
      borderColor: config.borderColor,
      bgColor: config.bgColor,
    };
  };

  // Helper function to format task data for UI
  const formatTaskForUI = (task) => {
    const statusConfig = {
      pending: {
        statusColor: colors.status.warning + '20',
        statusTextColor: colors.status.warning, // Using theme color
        iconBg: colors.primary + '20',
      },
      completed: {
        statusColor: colors.status.success + '20',
        statusTextColor: colors.status.success,
        iconBg: colors.status.success + '20',
      },
      missed: {
        statusColor: colors.status.error + '20',
        statusTextColor: colors.status.error,
        iconBg: colors.status.error + '20',
      },
      cancelled: {
        statusColor: colors.status.error + '20',
        statusTextColor: colors.status.error,
        iconBg: colors.status.error + '20',
      }
    };

    const config = statusConfig[task.status] || statusConfig.pending;
    
    const taskTime = formatTimestamp(task.scheduledTime || task.createdAt);

    return {
      ...task,
      title: task.title || task.taskDescription || task.type || 'Task',
      seniorName: task.seniorName || 'Senior',
      time: taskTime,
      status: translations[task.status] || task.status,
      statusColor: config.statusColor,
      statusTextColor: config.statusTextColor,
      icon: task.icon || 'assignment', // Changed from 'task' to 'assignment' for better look
      iconBg: config.iconBg,
    };
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleStatPress = (statType) => {
    if (statType === 'alerts') {
      router.replace('/caremanager/alerts');
    } else if (statType === 'tasks') {
      router.replace('/caremanager/tasks');
    } else if (statType === 'seniors') {
      router.replace('/caremanager/seniors');
    } else if (statType === 'routines') {
      router.replace('/caremanager/routines');
    }
  };

  const handleAlertClick = (alert) => {
    setSelectedAlert(alert);
    setModalVisible(true);
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setTaskModalVisible(true);
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background.lighter }}>
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: colors.text.muted }}>{translations.pleaseLoginToViewDashboard || 'Please log in to view dashboard'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 flex-col" style={{ backgroundColor: colors.background.lighter }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.light} />

      {/* Header */}
      <View style={{ backgroundColor: colors.background.light }}>
        <View className="px-4 py-3 flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <CloverCareNavbar 
              showLogo={true}
              logoSize={36}
              backgroundColor="transparent"
              appName="Clover Care"
            />
          </View>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        className="flex-1"
        style={{ backgroundColor: colors.background.lighter }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        scrollEnabled={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        {/* Welcome Banner */}
        <View className="px-6 pt-6 pb-4" style={{ backgroundColor: colors.background.lighter }}>
          <View className="flex-row items-center rounded-2xl p-5 shadow-sm" style={{ backgroundColor: colors.primary }}>
            <View className="w-14 h-14 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
              <MaterialIcons name="medical-services" size={28} color={colors.text.light} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold" style={{ color: colors.text.light }}>{translations.welcomeBack || 'Welcome Back!'}</Text>
              <Text className="text-sm mt-1" style={{ color: colors.text.light, opacity: 0.95 }}>
                {assignedSeniors.length === 0 
                  ? translations.noSeniorsAssignedYet || 'No seniors assigned yet' 
                  : `Managing ${assignedSeniors.length} senior${assignedSeniors.length !== 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="px-6 pt-2 pb-2" style={{ backgroundColor: colors.background.lighter }}>
          <Text className="text-base font-bold mb-4" style={{ color: colors.text.dark }}>Overview</Text>
          <View className="flex-row flex-wrap gap-3 mb-4">
            {/* Tasks Completed */}
            <TouchableOpacity
              onPress={() => handleStatPress('tasks')}
              className="flex-1 min-w-[45%] rounded-2xl p-4 shadow-md"
              style={{ backgroundColor: colors.background.light, borderWidth: 1, borderColor: colors.border.light }}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.status.success + '20' }}>
                  <MaterialIcons name="check-circle" size={24} color={colors.status.success} />
                </View>
                <Text className="text-3xl font-bold" style={{ color: colors.text.dark }}>{stats.tasksCompleted}</Text>
              </View>
              <Text className="text-xs font-semibold" style={{ color: colors.text.muted }}>{translations.tasksCompleted || 'Completed'}</Text>
            </TouchableOpacity>

            {/* Pending Tasks */}
            <TouchableOpacity
              onPress={() => handleStatPress('tasks')}
              className="flex-1 min-w-[45%] rounded-2xl p-4 shadow-md"
              style={{ backgroundColor: colors.background.light, borderWidth: 1, borderColor: colors.border.light }}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.status.warning + '20' }}>
                  <MaterialIcons name="schedule" size={24} color={colors.status.warning} />
                </View>
                <Text className="text-3xl font-bold" style={{ color: colors.text.dark }}>{stats.pendingTasks}</Text>
              </View>
              <Text className="text-xs font-semibold" style={{ color: colors.text.muted }}>{translations.pendingTasks || 'Pending'}</Text>
            </TouchableOpacity>

            {/* Missed Routines */}
            <TouchableOpacity
              onPress={() => handleStatPress('routines')}
              className="flex-1 min-w-[45%] rounded-2xl p-4 shadow-md"
              style={{ backgroundColor: colors.background.light, borderWidth: 1, borderColor: colors.border.light }}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.status.error + '20' }}>
                  <MaterialIcons name="event-busy" size={24} color={colors.status.error} />
                </View>
                <Text className="text-3xl font-bold" style={{ color: colors.text.dark }}>{stats.missedRoutines}</Text>
              </View>
              <Text className="text-xs font-semibold" style={{ color: colors.text.muted }}>{translations.missedRoutines || 'Missed'}</Text>
            </TouchableOpacity>

            {/* Recent Alerts */}
            <TouchableOpacity
              onPress={() => handleStatPress('alerts')}
              className="flex-1 min-w-[45%] rounded-2xl p-4 shadow-md"
              style={{ backgroundColor: colors.background.light, borderWidth: 1, borderColor: colors.border.light }}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.status.error + '20' }}>
                  <MaterialIcons name="notifications-active" size={24} color={colors.status.error} />
                </View>
                <Text className="text-3xl font-bold" style={{ color: colors.text.dark }}>{stats.recentAlerts}</Text>
              </View>
              <Text className="text-xs font-semibold" style={{ color: colors.text.muted }}>{translations.alerts || 'Alerts'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Alerts Section */}
        <View className="px-6 pt-4 pb-2" style={{ backgroundColor: colors.background.lighter }}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-base font-bold" style={{ color: colors.text.dark }}>{translations.alerts || 'Recent Alerts'}</Text>
            <TouchableOpacity onPress={() => router.replace('/caremanager/alerts')}>
              <Text className="text-xs font-bold" style={{ color: colors.primary }}>View All →</Text>
            </TouchableOpacity>
          </View>

          {combinedAlerts.length === 0 ? (
            <View className="rounded-2xl p-8 items-center shadow-md" style={{ backgroundColor: colors.background.light, borderWidth: 1, borderColor: colors.border.light }}>
              <View className="w-16 h-16 rounded-3xl items-center justify-center mb-3" style={{ backgroundColor: colors.status.success + '20' }}>
                <MaterialIcons name="check-circle" size={32} color={colors.status.success} />
              </View>
              <Text className="text-base font-bold" style={{ color: colors.text.primary }}>All Clear!</Text>
              <Text className="text-xs mt-1 text-center" style={{ color: colors.text.secondary }}>{translations.noActiveAlertsAtMoment || 'No active alerts at the moment'}</Text>
              <Text className="text-xs mt-1" style={{ color: colors.text.muted }}>{translations.allSeniorsDoingWell || 'All seniors are doing well'}</Text>
            </View>
          ) : (
            combinedAlerts.map((alert) => {
              const formattedAlert = formatAlertForUI(alert);
              return (
                <TouchableOpacity
                  key={alert.id}
                  className="rounded-2xl mb-3 shadow-md"
                  activeOpacity={0.7}
                  style={{ backgroundColor: colors.background.light, borderWidth: 1, borderColor: colors.border.light }}
                  onPress={() => handleAlertClick(alert)}
                >
                  <View className="flex-row items-center p-4">
                    <View className="w-12 h-12 rounded-full items-center justify-center mr-4" style={{ backgroundColor: formattedAlert.bgColor }}>
                      <MaterialIcons name={formattedAlert.icon} size={24} color={formattedAlert.borderColor} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold mb-1" style={{ color: colors.text.dark }}>{formattedAlert.seniorName}</Text>
                      <Text className="text-xs" style={{ color: colors.text.secondary }}>{formattedAlert.message}</Text>
                      <Text className="text-xs mt-1" style={{ color: colors.text.muted }}>{formattedAlert.time}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color={colors.text.muted} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Task Queue Section */}
        <View className="px-6 pt-4 pb-2" style={{ backgroundColor: colors.background.lighter }}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-base font-bold" style={{ color: colors.text.dark }}>{translations.tasks || 'Recent Tasks'}</Text>
            <TouchableOpacity onPress={() => router.replace('/caremanager/tasks')}>
              <Text className="text-xs font-bold" style={{ color: colors.primary }}>View All →</Text>
            </TouchableOpacity>
          </View>

          {taskQueue.length === 0 ? (
            <View className="rounded-2xl p-8 items-center shadow-md" style={{ backgroundColor: colors.background.light, borderWidth: 1, borderColor: colors.border.light }}>
              <View className="w-16 h-16 rounded-3xl items-center justify-center mb-3" style={{ backgroundColor: colors.primary + '20' }}>
                <MaterialIcons name="task-alt" size={32} color={colors.primary} />
              </View>
              <Text className="text-base font-bold" style={{ color: colors.text.primary }}>{translations.noTasksYet || 'No Tasks Yet'}</Text>
              <Text className="text-xs mt-1 text-center" style={{ color: colors.text.secondary }}>You&apos;re all caught up!</Text>
              <Text className="text-xs mt-1" style={{ color: colors.text.muted }}>{translations.newTasksWillAppearHere || 'New tasks will appear here'}</Text>
            </View>
          ) : (
            taskQueue.map((task) => {
              const formattedTask = formatTaskForUI(task);
              return (
                <TouchableOpacity
                  key={task.id}
                  className="rounded-2xl mb-3 p-4 shadow-md"
                  style={{ backgroundColor: colors.background.light, borderWidth: 1, borderColor: colors.border.light }}
                  activeOpacity={0.7}
                  onPress={() => handleTaskClick(task)}
                >
                  <View className="flex-row items-start">
                    <View className="w-12 h-12 rounded-full items-center justify-center mr-4" style={{ backgroundColor: formattedTask.iconBg }}>
                      <MaterialIcons name={formattedTask.icon} size={24} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm font-bold flex-1" style={{ color: colors.text.dark }}>
                          {formattedTask.title}
                        </Text>
                        <View
                          className="px-3 py-1 rounded-full ml-2"
                          style={{ backgroundColor: formattedTask.statusColor }}
                        >
                          <Text
                            className="text-xs font-bold"
                            style={{ color: formattedTask.statusTextColor }}
                          >
                            {formattedTask.status}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center mt-1">
                        <MaterialIcons name="person" size={14} color={colors.text.muted} />
                        <Text className="text-xs ml-1" style={{ color: colors.text.secondary }}>{formattedTask.seniorName}</Text>
                        <Text className="text-xs mx-1.5" style={{ color: colors.text.muted }}>•</Text>
                        <MaterialIcons name="schedule" size={14} color={colors.text.muted} />
                        <Text className="text-xs ml-1" style={{ color: colors.text.secondary }}>{formattedTask.time}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        <View className="h-20" />
      </ScrollView>

      {/* Check-in Details Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <TouchableOpacity 
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
            className="absolute inset-0"
          />
          <View className="w-full" style={{ maxWidth: 500 }}>
            {selectedAlert && (() => {
              const formattedAlert = formatAlertForUI(selectedAlert);
              const seniorName = formattedAlert.seniorName || getSeniorName(selectedAlert.seniorId || selectedAlert.userId) || 'Senior';
              return (
                <View className="rounded-3xl" style={{ backgroundColor: colors.background.light, elevation: 8 }}>
                  {/* Modal Header */}
                  <View className="rounded-t-3xl px-6 py-5" style={{ backgroundColor: colors.primary }}>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xl font-bold" style={{ color: colors.text.light }}>{translations.checkInDetails || 'Check-in Details'}</Text>
                      <TouchableOpacity 
                        onPress={() => setModalVisible(false)}
                        className="rounded-full p-1"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                      >
                        <MaterialIcons name="close" size={24} color={colors.text.light} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Modal Content */}
                  <View className="px-6 py-6">
                    {/* Senior Info */}
                    <View className="flex-row items-center mb-5">
                      <Avatar.Text
                        size={64}
                        label={seniorName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        style={{ backgroundColor: colors.primary }}
                        color={colors.text.light}
                      />
                      <View className="ml-4 flex-1">
                        <Text className="text-xl font-bold" style={{ color: colors.text.primary }}>
                          {seniorName}
                        </Text>
                        <Text className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                          {selectedAlert.type === 'daily_checkin_new' ? 'Daily Check-in' : 'Health Update'}
                        </Text>
                      </View>
                    </View>

                    {/* Status & Mood */}
                    <View className="mb-4">
                      <Text className="text-xs font-semibold uppercase mb-2" style={{ color: colors.text.muted }}>Status</Text>
                      <View 
                        className="rounded-2xl p-4 flex-row items-center"
                        style={{ backgroundColor: formattedAlert.bgColor }}
                      >
                        <View 
                          className="w-12 h-12 rounded-full items-center justify-center mr-4"
                          style={{ backgroundColor: formattedAlert.borderColor + '30' }}
                        >
                          <MaterialIcons 
                            name={formattedAlert.icon} 
                            size={28} 
                            color={formattedAlert.borderColor}
                          />
                        </View>
                        <View className="flex-1">
                          <Text 
                            className="text-lg font-bold"
                            style={{ color: formattedAlert.borderColor }}
                          >
                            {selectedAlert.data?.mood ? selectedAlert.data.mood.charAt(0).toUpperCase() + selectedAlert.data.mood.slice(1) : formattedAlert.message}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Time */}
                    <View className="mb-5">
                      <Text className="text-xs font-semibold uppercase mb-2" style={{ color: colors.text.muted }}>Time</Text>
                      <View className="flex-row items-center rounded-2xl p-4" style={{ backgroundColor: colors.background.lighter }}>
                        <MaterialIcons name="access-time" size={20} color={colors.text.muted} />
                        <Text className="text-base ml-3 font-medium" style={{ color: colors.text.dark }}>
                          {formattedAlert.time}
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={() => {
                          setModalVisible(false);
                          router.push(`/caremanager/seniordetails/${selectedAlert.seniorId || selectedAlert.userId}`);
                        }}
                        className="flex-1 rounded-2xl py-4 items-center"
                        style={{ backgroundColor: colors.primary, elevation: 2 }}
                      >
                        <Text className="font-bold text-base" style={{ color: colors.text.light }}>{translations.viewProfile || 'View Profile'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setModalVisible(false)}
                        className="flex-1 rounded-2xl py-4 items-center"
                        style={{ backgroundColor: colors.background.lighter }}
                      >
                        <Text className="font-bold text-base" style={{ color: colors.text.dark }}>{translations.close || 'Close'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Task/Reminder Details Modal */}
      <Modal
        visible={taskModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTaskModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <TouchableOpacity 
            activeOpacity={1}
            onPress={() => setTaskModalVisible(false)}
            className="absolute inset-0"
          />
          <View className="w-full" style={{ maxWidth: 500 }}>
            {selectedTask && (() => {
              const formattedTask = formatTaskForUI(selectedTask);
              return (
                <View className="rounded-3xl" style={{ backgroundColor: colors.background.light, elevation: 8 }}>
                  {/* Modal Header */}
                  <View className="rounded-t-3xl px-5 py-4 flex-row items-center justify-between" style={{ backgroundColor: colors.primary }}>
                    <Text className="text-lg font-bold" style={{ color: colors.text.light }}>
                      {selectedTask.type === 'reminder' ? (translations.reminderDetails || 'Reminder Details') : 
                       selectedTask.type === 'routine' ? (translations.routineDetails || 'Routine Details') : 
                       selectedTask.type === 'service_request' ? (translations.serviceRequest || 'Service Request') : (translations.taskDetails || 'Task Details')}
                    </Text>
                    <TouchableOpacity 
                      onPress={() => setTaskModalVisible(false)}
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                    >
                      <MaterialIcons name="close" size={20} color={colors.text.light} />
                    </TouchableOpacity>
                  </View>

                  {/* Modal Content */}
                  <View className="px-5 py-5">
                    {/* Senior Info with Avatar */}
                    <View className="flex-row items-center mb-5">
                      <Avatar.Text
                        size={56}
                        label={(formattedTask.seniorName || 'S').split(' ').map(n => n[0]).join('').substring(0, 2)}
                        style={{ backgroundColor: colors.primary }}
                        color={colors.text.light}
                      />
                      <View className="ml-3 flex-1">
                        <Text className="text-lg font-bold" style={{ color: colors.text.primary }}>
                          {formattedTask.seniorName || 'Senior'}
                        </Text>
                        <Text className="text-sm" style={{ color: colors.text.secondary }}>
                          {formattedTask.title}
                        </Text>
                      </View>
                    </View>

                    {/* Status */}
                    <View className="mb-4">
                      <Text className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.text.muted }}>{translations.status || 'STATUS'}</Text>
                      <View 
                        className="rounded-xl p-3"
                        style={{ backgroundColor: formattedTask.statusColor }}
                      >
                        <View className="flex-row items-center">
                          <MaterialIcons 
                            name={
                              formattedTask.status === 'Completed' ? 'check-circle' :
                              formattedTask.status === 'Pending' ? 'schedule' :
                              formattedTask.status === 'Missed' ? 'cancel' : 'info'
                            }
                            size={20} 
                            color={formattedTask.statusTextColor}
                          />
                          <Text 
                            className="text-base font-semibold ml-2"
                            style={{ color: formattedTask.statusTextColor }}
                          >
                            {formattedTask.status}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Time */}
                    <View className="mb-5">
                      <Text className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.text.muted }}>{translations.time || 'TIME'}</Text>
                      <View className="flex-row items-center rounded-xl p-3" style={{ backgroundColor: colors.background.lighter }}>
                        <MaterialIcons name="access-time" size={20} color={colors.text.muted} />
                        <Text className="text-base ml-2" style={{ color: colors.text.dark }}>
                          {formattedTask.time}
                        </Text>
                      </View>
                    </View>

                    {/* Description if available */}
                    {(selectedTask.notes || selectedTask.description || selectedTask.taskDescription) && (
                      <View className="mb-5">
                        <Text className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.text.muted }}>{translations.description || 'DESCRIPTION'}</Text>
                        <View className="rounded-xl p-3" style={{ backgroundColor: colors.background.lighter }}>
                          <Text className="text-sm leading-5" style={{ color: colors.text.dark }}>
                            {selectedTask.notes || selectedTask.description || selectedTask.taskDescription}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Action Buttons */}
                    <View className="flex-row gap-3 mt-1">
                      <TouchableOpacity
                        onPress={() => {
                          setTaskModalVisible(false);
                          router.push(`/caremanager/seniordetails/${selectedTask.seniorId}`);
                        }}
                        className="flex-1 rounded-xl py-3 items-center justify-center"
                        style={{ backgroundColor: colors.primary, elevation: 2 }}
                      >
                        <Text className="font-semibold text-base" style={{ color: colors.text.light }}>{translations.viewProfile || 'View Profile'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setTaskModalVisible(false)}
                        className="flex-1 rounded-xl py-3 items-center justify-center"
                        style={{ backgroundColor: colors.background.lighter }}
                      >
                        <Text className="font-semibold text-base" style={{ color: colors.text.dark }}>{translations.close || 'Close'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <CareManagerBottomNav />
    </SafeAreaView>
  );
}