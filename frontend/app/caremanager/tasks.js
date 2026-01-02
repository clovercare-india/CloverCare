import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StatusBar, TouchableOpacity, View, RefreshControl, StyleSheet, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, FAB, TextInput} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import CareManagerBottomNav from '../../components/CareManagerBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import TaskHistoryModal from '../../components/TaskHistoryModal';
import { colors } from '../../theme/colors';
import '../../global.css';
import { translations as translationData, loadLanguage } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { getUserProfile } from '../../firestore/sharedFirestore';
import { updateReminderStatus } from '../../firestore/seniorFirestore';
import logger from '../../utils/logger';
import { 
  listenToCarerTasksForAssignedSeniors,
  updateCarerTaskStatus, 
  listenToAssignedSeniorIds,
  listenToRemindersForAssignedSeniors,
  createTaskForSenior,
  listenToTasksCreatedByCareManager,
  updateTaskStatus,
  deleteInvalidTasks
} from '../../firestore/caremanagerFirestore';

// Utility functions for date and time formatting
const formatDate = (timestamp) => {
  if (!timestamp) return 'Unknown';
  const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(dateObj.getTime())) return 'Unknown';
  return format(dateObj, 'MMM dd, yyyy');
};

const formatTime = (timestamp) => {
  if (!timestamp) return 'Unknown';
  const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(dateObj.getTime())) return 'Unknown';
  return format(dateObj, 'h:mm a');
};

export default function CareManagerTasksScreen() {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [selectedSeniorId, setSelectedSeniorId] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false);
  const [assignedSeniors, setAssignedSeniors] = useState([]);
  const [menuVisible, setMenuVisible] = useState(null);
  const creatorCache = useRef({});
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [formData, setFormData] = useState({
    seniorId: '',
    taskType: '',
    customDescription: '',
    scheduledAt: new Date()
  });

  // Memoize minimum date to prevent unnecessary re-renders
  const minDate = useMemo(() => new Date(), []);

  // History states
  const [historyVisible, setHistoryVisible] = useState(false);

  // Main list pagination states
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { user } = useAuth();
  const translations = translationData[currentLanguage];

  const getSeniorName = useCallback((seniorId) => {
    return assignedSeniors.find(s => s.userId === seniorId)?.name || 'Unknown Senior';
  }, [assignedSeniors]);

  const getCreatorInfo = useCallback(async (creatorId, seniorId) => {
    if (!creatorId) return { name: 'Unknown', role: 'Unknown' };
    
    // Check if senior raised it
    if (creatorId === seniorId) {
      return { name: getSeniorName(seniorId), role: 'Senior' };
    }

    // Check if the creator is the current care manager
    if (creatorId === user?.uid) {
      return { name: 'Me', role: 'Care Manager' };
    }

    // Check if already cached
    if (creatorCache.current[creatorId]) {
      return creatorCache.current[creatorId];
    }

    try {
      const profile = await getUserProfile(creatorId);
      if (profile) {
        let role = 'Unknown';
        const userRole = (profile.role || '').toLowerCase().trim();
        
        if (userRole === 'senior') {
          role = 'Senior';
        } else if (userRole === 'family' || userRole === 'family_member') {
          role = 'Family';
        } else if (userRole === 'caregiver' || userRole === 'care_manager' || userRole === 'caremanager') {
          role = 'Care Manager';
        } else if (profile.role) {
          role = profile.role.charAt(0).toUpperCase() + profile.role.slice(1).toLowerCase().replace('_', ' ');
        }
        
        const creatorInfo = { 
          name: profile.name || profile.fullName || 'Unknown', 
          role 
        };
        creatorCache.current[creatorId] = creatorInfo;
        return creatorInfo;
      }
    } catch (_error) {
      // Silently fail and return unknown
    }
    return { name: 'Unknown', role: 'Unknown' };
  }, [user?.uid, getSeniorName]);

  const taskTypes = [
    'Medication Reminder',
    'Doctor Appointment',
    'Exercise/Physical Activity',
    'Meal Preparation',
    'Personal Hygiene',
    'Social Activity',
    'Health Check',
    'Home Maintenance',
    'Shopping/Groceries',
    'Family Visit',
  ];

  // Map task type names to standardized type codes
  const getTaskTypeCode = (taskTypeName) => {
    if (!taskTypeName) return 'custom';
    const typeMap = {
      'Medication Reminder': 'medication_reminder',
      'Doctor Appointment': 'doctor_appointment',
      'Exercise/Physical Activity': 'exercise_activity',
      'Meal Preparation': 'meal_preparation',
      'Personal Hygiene': 'personal_hygiene',
      'Social Activity': 'social_activity',
      'Health Check': 'health_check',
      'Home Maintenance': 'home_maintenance',
      'Shopping/Groceries': 'shopping_groceries',
      'Family Visit': 'family_visit',
    };
    return typeMap[taskTypeName] || 'custom';
  };

  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  // Fetch assigned seniors with real-time listener
  useEffect(() => {
    if (!user?.uid) return;

    // Use real-time listener for assigned seniors
    const unsubscribe = listenToAssignedSeniorIds(user.uid, async (seniorIds) => {
      if (seniorIds.length === 0) {
        setAssignedSeniors([]);
        return;
      }

      const seniorProfiles = await Promise.all(
        seniorIds.map(async (seniorId) => {
          const profile = await getUserProfile(seniorId);
          return { userId: seniorId, name: profile?.name || profile?.fullName || 'Unknown', ...profile };
        })
      );
      setAssignedSeniors(seniorProfiles);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  // Clean up invalid tasks on component mount
  useEffect(() => {
    const cleanupInvalidTasks = async () => {
      if (!user?.uid) return;
      
      const result = await deleteInvalidTasks(user.uid);
      if (result.success && result.deletedCount > 0) {
        logger.warn(
          "caremanager/tasks",
          `Found and deleted ${result.deletedCount} invalid tasks`,
          { deletedTasks: result.deletedTasks?.map(t => ({ id: t.id, reason: t.reason })) }
        );
      }
    };

    cleanupInvalidTasks();
  }, [user?.uid]);

  // Listen to tasks and reminders
  useEffect(() => {
    if (!user?.uid || assignedSeniors.length === 0) return;

    const assignedSeniorIds = assignedSeniors.map(s => s.userId);
    let unsubscribeServiceRequests, unsubscribeReminders, unsubscribeMyTasks;

    // Listen to service requests
    unsubscribeServiceRequests = listenToCarerTasksForAssignedSeniors(assignedSeniorIds, async (tasks) => {
      const validTasks = tasks.filter(task => task?.seniorId?.trim());

      const processed = await Promise.all(validTasks.map(async (task) => {
        const creatorInfo = task.createdBy ? await getCreatorInfo(task.createdBy, task.seniorId) : { name: 'System', role: 'System' };
        return {
          id: task.id || task.taskId,
          seniorId: task.seniorId,
          seniorName: getSeniorName(task.seniorId),
          taskDescription: task.taskDescription || (task.title ? (task.title + (task.description && task.description !== 'Custom service request' ? ` - ${task.description}` : '')) : 'No description'),
          scheduledTime: task.scheduledAt ? `${formatDate(task.scheduledAt)} ${formatTime(task.scheduledAt)}` : formatTime(task.createdAt),
          status: task.status === 'in_progress' ? 'pending' : task.status,
          type: 'service_request',
          createdAt: task.createdAt,
          scheduledAt: task.scheduledAt,
          creatorName: creatorInfo.name,
          creatorRole: creatorInfo.role,
          originalRequest: task
        };
      }));
      setTasks(prev => {
        const filtered = prev.filter(t => t.type !== 'service_request');
        const existingIds = new Set(filtered.map(t => t.id));
        return [...filtered, ...processed.filter(t => !existingIds.has(t.id))];
      });
    });

    // Listen to reminders
    unsubscribeReminders = listenToRemindersForAssignedSeniors(assignedSeniorIds, async (remindersList) => {
      const validReminders = remindersList.filter(reminder => reminder?.userId?.trim());

      const processed = await Promise.all(validReminders.map(async (reminder) => {
        const creatorInfo = reminder.createdBy ? await getCreatorInfo(reminder.createdBy, reminder.userId) : { name: 'System', role: 'System' };
        return {
          id: reminder.id,
          seniorId: reminder.userId,
          seniorName: getSeniorName(reminder.userId),
          taskDescription: reminder.title ? `${reminder.title}${reminder.description ? ` - ${reminder.description}` : ''}` : 'Reminder',
          scheduledTime: reminder.scheduledTime ? `${formatDate(reminder.scheduledTime)} ${formatTime(reminder.scheduledTime)}` : formatTime(reminder.createdAt),
          status: reminder.status,
          type: 'reminder',
          createdAt: reminder.createdAt || reminder.scheduledTime,
          scheduledAt: reminder.scheduledTime,
          creatorName: creatorInfo.name,
          creatorRole: creatorInfo.role,
          originalReminder: reminder
        };
      }));
      setTasks(prev => {
        const filtered = prev.filter(t => t.type !== 'reminder');
        const existingIds = new Set(filtered.map(t => t.id));
        return [...filtered, ...processed.filter(t => !existingIds.has(t.id))];
      });
    });

    // Listen to care manager created tasks
    unsubscribeMyTasks = listenToTasksCreatedByCareManager(user.uid, (myTasks) => {
      const validTasks = myTasks.filter(task => task?.seniorId?.trim());

      const processed = validTasks.map(task => ({
        id: task.taskId,
        seniorId: task.seniorId,
        seniorName: getSeniorName(task.seniorId),
        taskDescription: task.taskDescription,
        scheduledTime: task.scheduledAt ? `${formatDate(task.scheduledAt)} ${formatTime(task.scheduledAt)}` : formatTime(task.createdAt),
        status: task.status,
        type: 'care_manager_task',
        createdAt: task.createdAt,
        scheduledAt: task.scheduledAt,
        creatorName: 'Me',
        creatorRole: 'Care Manager',
        originalTask: task
      }));
      setTasks(prev => {
        const filtered = prev.filter(t => t.type !== 'care_manager_task');
        const existingIds = new Set(filtered.map(t => t.id));
        return [...filtered, ...processed.filter(t => !existingIds.has(t.id))];
      });
    });

    return () => {
      if (unsubscribeServiceRequests) unsubscribeServiceRequests();
      if (unsubscribeReminders) unsubscribeReminders();
      if (unsubscribeMyTasks) unsubscribeMyTasks();
    };
  }, [user?.uid, assignedSeniors, getCreatorInfo, getSeniorName]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleTaskDetail = (task) => {
    setSelectedTask(task);
    setTimeout(() => {
      setDetailModalVisible(true);
    }, 100);
  };

  const handleDetailModalClose = () => {
    setDetailModalVisible(false);
    setSelectedTask(null);
  };

  // NEW: Handlers for Creation
  const handleAddTask = () => {
    setFormData({
      seniorId: '',
      taskType: '',
      customDescription: '',
      scheduledAt: new Date()
    });
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setFormData({ seniorId: '', taskType: '', customDescription: '', scheduledAt: new Date() });
  };

  const onDateChange = useCallback((event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const newDate = new Date(formData.scheduledAt);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setFormData(prev => ({ ...prev, scheduledAt: newDate }));
    }
  }, [formData.scheduledAt]);

  const onTimeChange = useCallback((event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDate = new Date(formData.scheduledAt);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setFormData(prev => ({ ...prev, scheduledAt: newDate }));
    }
  }, [formData.scheduledAt]);

  const handleSubmitTask = async () => {
    // Strict validation for seniorId
    if (!formData.seniorId || typeof formData.seniorId !== 'string' || formData.seniorId.trim() === '') {
      Alert.alert('Error', 'Please select a senior');
      return;
    }
    if (!formData.taskType && !formData.customDescription.trim()) {
      Alert.alert('Error', 'Please select a task type or enter a custom description');
      return;
    }

    try {
      setSubmitting(true);
      const taskType = getTaskTypeCode(formData.taskType);
      const taskData = {
        seniorId: formData.seniorId.trim(),
        careManagerId: user.uid,
        taskDescription: formData.customDescription.trim() || formData.taskType,
        type: taskType,
        status: 'pending',
        scheduledAt: formData.scheduledAt
      };

      const result = await createTaskForSenior(taskData);
      
      if (result.success) {
        Alert.alert('Success', 'Task created successfully! This task will appear on the senior\'s dashboard.');
        handleModalClose();
      } else {
        Alert.alert('Error', result.error || 'Failed to create task');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkCompleted = async (taskId, taskDescription, taskType) => {
    try {
      if (taskType === 'service_request') {
        await updateCarerTaskStatus(taskId, 'completed');
      } else if (taskType === 'reminder') {
        await updateReminderStatus(taskId, 'completed');
      } else if (taskType === 'care_manager_task') {
        await updateTaskStatus(taskId, 'completed');
      }
      Alert.alert('Success', `"${taskDescription}" marked as completed`);
    } catch (_error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleMarkMissed = async (taskId, taskDescription, taskType) => {
    try {
      if (taskType === 'service_request') {
        await updateCarerTaskStatus(taskId, 'cancelled', 'Marked as missed by care manager');
      } else if (taskType === 'reminder') {
        await updateReminderStatus(taskId, 'missed');
      } else if (taskType === 'care_manager_task') {
        await updateTaskStatus(taskId, 'cancelled');
      }
      Alert.alert('Done', `"${taskDescription}" marked as missed`);
    } catch (_error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  // Main list scroll handler
  const handleMainScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
    
    if (isNearBottom && !isLoadingMore && displayCount < filteredTasks.length) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayCount(prev => prev + 10);
        setIsLoadingMore(false);
      }, 400);
    }
  };

  const getFilteredTasks = () => {
    let filtered = tasks.filter(t => {
      // Must have a valid seniorId and be in the assigned seniors list
      const seniorId = t?.seniorId?.trim();
      return seniorId && assignedSeniors.some(s => s.userId === seniorId);
    });

    if (selectedSeniorId !== 'all') {
      filtered = filtered.filter(t => t.seniorId === selectedSeniorId);
    }

    if (showOnlyMyTasks) {
      filtered = filtered.filter(t => t.creatorName === 'Me');
    }

    // Only show active tasks in the main list
    filtered = filtered.filter(t => !['completed', 'cancelled', 'missed'].includes(t.status));

    return filtered.sort((a, b) => {
      const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return timeB.getTime() - timeA.getTime();
    });
  };

  const filteredTasks = getFilteredTasks();
  const hasTasks = filteredTasks.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      {/* Header with Navbar */}
      <View className="bg-white">
        <View className="px-4 py-3 flex-row justify-between items-center gap-3">
          <View className="flex-1">
            <CloverCareNavbar 
              showLogo={true}
              logoSize={36}
              backgroundColor="transparent"
              appName="Clover Care"
            />
          </View>
          <TouchableOpacity 
            onPress={() => setHistoryVisible(true)}
            className="p-2 bg-gray-50 rounded-full border border-gray-100"
          >
            <MaterialIcons name="history" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
      <View className="px-4 pt-4 pb-4">
        <View className="gap-3">
          <View style={{ zIndex: 100, overflow: 'visible' }}>
            <Text className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Senior</Text>
            <TouchableOpacity
              onPress={() => setMenuVisible(prev => prev === 'senior' ? null : 'senior')}
              activeOpacity={0.8}
              style={{ 
                borderWidth: 1.5, 
                borderColor: '#8DAAA5', 
                backgroundColor: '#f0f7f6', 
                paddingHorizontal: 14, 
                paddingVertical: 12, 
                borderRadius: 12, 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{
                  backgroundColor: 'white',
                  borderRadius: 20,
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10
                }}>
                  <MaterialIcons name="person" size={18} color="#8DAAA5" />
                </View>
                <Text style={{ color: '#111827', fontWeight: '600', fontSize: 15 }}>
                  {selectedSeniorId === 'all' ? 'All Seniors' : assignedSeniors.find(s => s.userId === selectedSeniorId)?.name || 'Select Senior'}
                </Text>
              </View>
                <MaterialIcons name={menuVisible === 'senior' ? "expand-less" : "expand-more"} size={22} color="#475569" />
              </TouchableOpacity>
            {menuVisible === 'senior' && (
              <View style={{ 
                marginTop: 8, 
                backgroundColor: 'white', 
                borderWidth: 1, 
                borderColor: '#e5e7eb', 
                borderRadius: 12, 
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
                position: 'absolute',
                top: 60,
                left: 0,
                right: 0,
                zIndex: 1000
              }}>
                <TouchableOpacity
                  onPress={() => { setSelectedSeniorId('all'); setMenuVisible(null); }}
                  style={{ 
                    padding: 14, 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    backgroundColor: selectedSeniorId === 'all' ? '#f0f7f6' : 'transparent'
                  }}
                >
                  <MaterialIcons name="group" size={20} color="#8DAAA5" style={{ marginRight: 12 }} />
                  <Text style={{ color: '#111827', fontWeight: '600', fontSize: 15 }}>All Seniors</Text>
                </TouchableOpacity>

                <View style={{ height: 1, backgroundColor: '#f3f4f6' }} />

                {assignedSeniors.map((senior) => (
                  <TouchableOpacity
                    key={senior.userId}
                    onPress={() => { setSelectedSeniorId(senior.userId); setMenuVisible(null); }}
                    style={{ 
                      padding: 14, 
                      flexDirection: 'row', 
                      alignItems: 'center',
                      backgroundColor: selectedSeniorId === senior.userId ? '#f0f7f6' : 'transparent'
                    }}
                  >
                    <MaterialIcons name="person" size={20} color="#8DAAA5" style={{ marginRight: 12 }} />
                    <Text style={{ color: '#475569', fontWeight: '500', fontSize: 15 }}>{senior.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Filter Button */}
          <TouchableOpacity
            onPress={() => setShowOnlyMyTasks(!showOnlyMyTasks)}
            activeOpacity={0.7}
            style={{
              backgroundColor: showOnlyMyTasks ? '#5B718A' : '#f9fafb',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: showOnlyMyTasks ? '#5B718A' : '#e5e7eb',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1
            }}
          >
            <MaterialIcons name="filter-list" size={18} color={showOnlyMyTasks ? "#fff" : "#6b7280"} />
            <Text style={{ 
              color: showOnlyMyTasks ? '#fff' : '#6b7280',
              fontSize: 14,
              fontWeight: '600',
              marginLeft: 8
            }}>
              {showOnlyMyTasks ? 'Showing My Tasks Only' : 'Show Only My Tasks'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-4" 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={handleMainScroll}
        scrollEventThrottle={16}
      >
        {!hasTasks ? (
          // Empty State
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-24 h-24 bg-gray-100 rounded-full items-center justify-center mb-4">
              <MaterialIcons name="task-alt" size={48} color="#94a3b8" />
            </View>
            <Text className="text-xl font-bold text-gray-900 mb-2">
              {translations.noTasks.replace('{filter}', '').replace('{tasks}', translations.tasks.toLowerCase()).replace(/\s+/g, ' ').trim()}
            </Text>
            <Text className="text-sm text-gray-600 text-center px-8">
              {translations.noTasksDesc.replace('{filter}', '').replace(/\s+/g, ' ').trim()}
            </Text>
          </View>
        ) : (
          // Task Cards
          <>
            {filteredTasks.slice(0, displayCount).map((task) => {
              const getStatusColor = (status) => {
                if (status === 'completed') return { bg: '#dcfce7', text: '#166534' };
                if (status === 'missed' || status === 'cancelled') return { bg: '#fecaca', text: '#991b1b' };
                return { bg: '#fef3c7', text: '#92400e' };
              };

              const statusColor = getStatusColor(task.status);
              const iconName = task.type === 'care_manager_task' ? 'assignment' : task.type === 'reminder' ? 'notifications-active' : 'help-outline';

              return (
                <TouchableOpacity
                  key={`${task.type}-${task.id}`}
                  onPress={() => handleTaskDetail(task)}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      backgroundColor: 'white',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: '#e5e7eb',
                      elevation: 1
                    }}
                  >
                    <View className="flex-row items-start">
                      <View style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: task.type === 'care_manager_task' ? '#fef9f0' : '#f0f4f7',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12
                      }}>
                        <MaterialIcons 
                          name={iconName}
                          size={22} 
                          color={task.type === 'care_manager_task' ? '#F7BC20' : '#5B718A'} 
                        />
                      </View>
                      
                      <View className="flex-1">
                        <Text className="text-base font-bold text-gray-900 mb-1">
                          {task.seniorName}
                        </Text>
                        
                        <Text className="text-sm text-gray-700 mb-2" numberOfLines={2}>
                          {task.taskDescription}
                        </Text>
                        
                        <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
                          <View style={{
                            backgroundColor: '#f0f7f6',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                            flexDirection: 'row',
                            alignItems: 'center'
                          }}>
                            <MaterialIcons name="person-outline" size={14} color="#8DAAA5" />
                            <Text style={{ fontSize: 11, color: '#5B718A', fontWeight: '600', marginLeft: 4 }} numberOfLines={1}>
                              {task.creatorName} ({task.creatorRole})
                            </Text>
                          </View>

                          <View style={{
                            backgroundColor: statusColor.bg,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                            marginLeft: 'auto'
                          }}>
                            <Text style={{ color: statusColor.text, fontSize: 11, fontWeight: '700' }}>
                              {task.status === 'completed' ? '✓ Done' : task.status === 'missed' || task.status === 'cancelled' ? '✗ Missed' : '○ Pending'}
                            </Text>
                          </View>
                        </View>
                        
                        {task.scheduledAt && (
                          <View style={{
                            backgroundColor: '#eff6ff',
                            borderRadius: 10,
                            padding: 12,
                            marginTop: 10,
                            borderWidth: 1,
                            borderColor: '#dbeafe',
                            flexDirection: 'row',
                            alignItems: 'center'
                          }}>
                            <MaterialIcons name="alarm" size={14} color="#2563eb" />
                            <Text style={{ fontSize: 11, color: '#2563eb', marginLeft: 6, fontWeight: '700' }}>{translations.requiredAt.toUpperCase()}</Text>
                            <Text style={{ fontSize: 11, color: '#1e40af', fontWeight: '600', marginLeft: 8 }}>
                              {task.scheduledTime}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {task.status === 'pending' && (
                      <View className="flex-row mt-3 pt-3" style={{ gap: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                        <TouchableOpacity 
                          onPress={() => handleMarkCompleted(task.id, task.taskDescription, task.type)}
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 10,
                            borderRadius: 10,
                            backgroundColor: '#dcfce7',
                            borderWidth: 1,
                            borderColor: '#bbf7d0'
                          }}
                        >
                          <MaterialIcons name="check-circle" size={18} color="#16a34a" />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#16a34a', marginLeft: 6 }}>
                            Complete
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => handleMarkMissed(task.id, task.taskDescription, task.type)}
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 10,
                            borderRadius: 10,
                            backgroundColor: '#fecaca',
                            borderWidth: 1,
                            borderColor: '#fca5a5'
                          }}
                        >
                          <MaterialIcons name="cancel" size={18} color="#dc2626" />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#dc2626', marginLeft: 6 }}>
                            Miss
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {isLoadingMore && (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator color="#5B718A" />
                <Text style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>Loading more tasks...</Text>
              </View>
            )}
          </>
        )}
        <View className="h-32" />
      </ScrollView>

      {/* NEW: Add Task Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="slide" onRequestClose={handleModalClose}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-900">Create Task</Text>
              <TouchableOpacity onPress={handleModalClose}>
                <MaterialIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              <Text className="text-base font-semibold text-gray-900 mb-3">{translations.selectSenior || 'Select Senior'}</Text>
              {assignedSeniors.length === 0 ? (
                <Text className="text-gray-600 mb-4">No seniors assigned yet. You will be able to create tasks once you have assigned seniors.</Text>
              ) : (
                assignedSeniors.map((senior) => (
                  <TouchableOpacity
                    key={senior.userId}
                    onPress={() => setFormData({...formData, seniorId: senior.userId})}
                    className={`p-3 rounded-lg border mb-2 ${formData.seniorId === senior.userId ? 'border-primary bg-primary-50' : 'border-gray-300'}`}
                  >
                    <Text className={`${formData.seniorId === senior.userId ? 'text-primary-700 font-semibold' : 'text-gray-900'}`}>{senior.name}</Text>
                  </TouchableOpacity>
                ))
              )}

              <Text className="text-base font-semibold text-gray-900 mb-3 mt-4">{translations.taskType || 'Task Type'}</Text>
              {taskTypes.map((task) => (
                <TouchableOpacity
                  key={task}
                  onPress={() => setFormData({...formData, taskType: task})}
                  className={`p-3 rounded-lg border mb-2 ${formData.taskType === task ? 'border-primary bg-primary-50' : 'border-gray-300'}`}
                >
                  <Text className={`${formData.taskType === task ? 'text-primary-700 font-semibold' : 'text-gray-900'}`}>{task}</Text>
                </TouchableOpacity>
              ))}

              <Text className="text-base font-semibold text-gray-900 mb-3 mt-4">Custom Description (Optional)</Text>
              <TextInput
                mode="outlined"
                placeholder="Enter custom task description..."
                value={formData.customDescription}
                onChangeText={(text) => setFormData({...formData, customDescription: text})}
                multiline
                numberOfLines={3}
                className="mb-4"
              />

              {/* Date and Time Selection */}
              <Text className="text-base font-semibold text-gray-900 mb-3">
                When is this required?
              </Text>
              <View className="flex-row gap-3 mb-6">
                <TouchableOpacity 
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowDatePicker(true);
                  }}
                  className="flex-1 p-3 rounded-lg border border-gray-300 bg-gray-50 flex-row items-center justify-between"
                >
                  <Text className="text-gray-900">
                    {format(formData.scheduledAt, 'MMM dd, yyyy')}
                  </Text>
                  <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowTimePicker(true);
                  }}
                  className="flex-1 p-3 rounded-lg border border-gray-300 bg-gray-50 flex-row items-center justify-between"
                >
                  <Text className="text-gray-900">
                    {format(formData.scheduledAt, 'h:mm a')}
                  </Text>
                  <MaterialIcons name="access-time" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={formData.scheduledAt}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  onChange={onDateChange}
                  minimumDate={minDate}
                />
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={formData.scheduledAt}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                  onChange={onTimeChange}
                />
              )}

              <Button
                mode="contained"
                onPress={handleSubmitTask}
                loading={submitting}
                disabled={submitting || !formData.seniorId || (!formData.taskType && !formData.customDescription.trim()) || assignedSeniors.length === 0}
                buttonColor="#5B718A"
                className="mb-4"
              >
                {submitting ? 'Creating...' : 'Create Task'}
              </Button>
              {assignedSeniors.length === 0 && (
                <Text style={{ color: '#dc2626', fontSize: 12, marginBottom: 12 }}>No seniors assigned to you. Please contact your administrator.</Text>
              )}
              {assignedSeniors.length > 0 && !formData.seniorId && (
                <Text style={{ color: '#dc2626', fontSize: 12, marginBottom: 12 }}>Please select a senior first</Text>
              )}
              {!formData.taskType && !formData.customDescription.trim() && (
                <Text style={{ color: '#dc2626', fontSize: 12, marginBottom: 12 }}>Please select a task type or enter a description</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={{ position: 'absolute', margin: 16, right: 0, bottom: 80, backgroundColor: '#5B718A' }}
        onPress={handleAddTask}
      />

      {/* Detail Modal */}
      <Modal 
        visible={detailModalVisible} 
        transparent={true} 
        animationType="fade" 
        onRequestClose={handleDetailModalClose}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
          <View style={{
            backgroundColor: 'white',
            borderRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 20,
            maxHeight: '80%',
            width: '100%'
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#111827' }}>Task Details</Text>
              <TouchableOpacity onPress={handleDetailModalClose}>
                <MaterialIcons name="close" size={28} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedTask && (
                <>
                  {/* Senior Info */}
                  <View style={{
                    backgroundColor: '#f0f7f6',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 20,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: 'white',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12
                    }}>
                      <MaterialIcons name="person" size={28} color="#8DAAA5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                        {selectedTask.seniorName}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        Senior
                      </Text>
                    </View>
                  </View>

                  {/* Task Title & Description */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      Task
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
                      {selectedTask.taskDescription || selectedTask.title}
                    </Text>
                    {selectedTask.description && (
                      <Text style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>
                        <Text style={{ fontWeight: 'bold' }}>Description: </Text>{selectedTask.description}
                      </Text>
                    )}
                    {selectedTask.notes && (
                      <Text style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>
                        <Text style={{ fontWeight: 'bold' }}>Notes: </Text>{selectedTask.notes}
                      </Text>
                    )}
                  </View>

                  {/* Status */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      Status
                    </Text>
                    <View style={{
                      backgroundColor: selectedTask.status === 'completed' ? '#dcfce7' : selectedTask.status === 'missed' || selectedTask.status === 'cancelled' ? '#fecaca' : '#fef3c7',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      alignSelf: 'flex-start'
                    }}>
                      <Text style={{
                        color: selectedTask.status === 'completed' ? '#166534' : selectedTask.status === 'missed' || selectedTask.status === 'cancelled' ? '#991b1b' : '#92400e',
                        fontSize: 13,
                        fontWeight: '700'
                      }}>
                        {selectedTask.status === 'completed' ? '✓ Completed' : selectedTask.status === 'missed' || selectedTask.status === 'cancelled' ? '✗ Missed' : '○ Pending'}
                      </Text>
                    </View>
                  </View>

                  {/* Information */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                      Information
                    </Text>
                    
                    <View style={{
                      backgroundColor: '#f9fafb',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <MaterialIcons name="calendar-today" size={16} color="#6b7280" />
                        <Text style={{ fontSize: 11, color: '#6b7280', marginLeft: 8, fontWeight: '500' }}>Created Date</Text>
                      </View>
                      <Text style={{ fontSize: 14, color: '#111827', fontWeight: '600', marginLeft: 24 }}>
                        {formatDate(selectedTask.createdAt)}
                      </Text>
                    </View>

                    <View style={{
                      backgroundColor: '#f9fafb',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <MaterialIcons name="access-time" size={16} color="#6b7280" />
                        <Text style={{ fontSize: 11, color: '#6b7280', marginLeft: 8, fontWeight: '500' }}>Created Time</Text>
                      </View>
                      <Text style={{ fontSize: 14, color: '#111827', fontWeight: '600', marginLeft: 24 }}>
                        {formatTime(selectedTask.createdAt)}
                      </Text>
                    </View>

                    {selectedTask.scheduledAt && (
                      <View style={{
                        backgroundColor: '#eff6ff',
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: '#dbeafe'
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <MaterialIcons name="alarm" size={16} color="#2563eb" />
                          <Text style={{ fontSize: 11, color: '#2563eb', marginLeft: 8, fontWeight: '700' }}>{translations.requiredAt.toUpperCase()}</Text>
                        </View>
                        <Text style={{ fontSize: 14, color: '#1e40af', fontWeight: '700', marginLeft: 24 }}>
                          {formatDate(selectedTask.scheduledAt)} {formatTime(selectedTask.scheduledAt)}
                        </Text>
                      </View>
                    )}

                    {selectedTask.type && (
                      <View style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 10
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <MaterialIcons name="category" size={16} color="#6b7280" />
                          <Text style={{ fontSize: 11, color: '#6b7280', marginLeft: 8, fontWeight: '500' }}>Task Type</Text>
                        </View>
                        <Text style={{ fontSize: 14, color: '#111827', fontWeight: '600', marginLeft: 24 }}>
                          {(selectedTask.originalRequest?.type || selectedTask.originalTask?.type || selectedTask.originalReminder?.type || selectedTask.type)
                            .split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ')}
                        </Text>
                      </View>
                    )}

                    <View style={{
                      backgroundColor: '#f9fafb',
                      borderRadius: 12,
                      padding: 14
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <MaterialIcons name="person-outline" size={16} color="#6b7280" />
                        <Text style={{ fontSize: 11, color: '#6b7280', marginLeft: 8, fontWeight: '500' }}>Created By</Text>
                      </View>
                      <Text style={{ fontSize: 14, color: '#111827', fontWeight: '600', marginLeft: 24 }}>
                        {selectedTask.creatorName} ({selectedTask.creatorRole})
                      </Text>
                    </View>
                  </View>

                  {/* Close Button */}
                  <TouchableOpacity
                    onPress={handleDetailModalClose}
                    style={{
                      backgroundColor: '#5B718A',
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: 'center',
                      marginBottom: 10
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Task History Modal */}
      <TaskHistoryModal 
        visible={historyVisible}
        onDismiss={() => setHistoryVisible(false)}
        role="care_manager"
        seniors={assignedSeniors}
        translations={translations}
        user={user}
      />

      <CareManagerBottomNav />
    </SafeAreaView>
  );
}
