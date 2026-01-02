
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshControl, ScrollView, StatusBar, TouchableOpacity, View, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, Card, Chip, Text, Portal, Modal, TextInput, IconButton, Menu, Checkbox } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import FamilyBottomNav from '../../components/FamilyBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import { colors } from '../../theme/colors';
import '../../global.css';
import { translations as translationData, loadLanguage} from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { getLinkedSeniorsWithDetails, getHealthLogsForRoutines } from '../../firestore/familyFirestore';
import {
  getRoutinesForSenior,
  listenToRoutinesForSenior,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  getRemindersForSenior,
  getAllRemindersForSenior,
  listenToRemindersForSenior,
  createReminder,
  updateReminder,
  deleteReminder
} from '../../firestore/seniorFirestore';

export default function RoutinesScreen() {
  const { user, userProfile } = useAuth();
  const isMounted = useRef(true);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const translations = translationData[currentLanguage];
  const [linkedSeniors, setLinkedSeniors] = useState([]);
  const [selectedSeniorId, setSelectedSeniorId] = useState(null);
  const [selectedSeniorIndex, setSelectedSeniorIndex] = useState(0);
  const [showSeniorSelector, setShowSeniorSelector] = useState(false);
  const [routines, setRoutines] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [healthLogs, setHealthLogs] = useState([]);
  const [allHealthLogs, setAllHealthLogs] = useState([]); // Store all fetched logs
  const [displayedLogsCount, setDisplayedLogsCount] = useState(3); // How many to display
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState([]);
  const [healthLogDays, setHealthLogDays] = useState(7);

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [routineTypeMenuVisible, setRoutineTypeMenuVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(null); // Track which routine's menu is open
  const [expandedReminders, setExpandedReminders] = useState([]); // Track expanded reminder notes
  const [reminderMenuVisible, setReminderMenuVisible] = useState(null); // Track which reminder's menu is open
  
  // Reminder modal states
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderModalMode, setReminderModalMode] = useState('create'); // 'create' or 'edit'
  const [editingReminder, setEditingReminder] = useState(null);
  const [reminderTypeMenuVisible, setReminderTypeMenuVisible] = useState(false);
  
  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('medication');
  const [formTime, setFormTime] = useState(new Date()); // Change to Date object
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [formSelectedDays, setFormSelectedDays] = useState([]); // Array of selected days
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Reminder form states
  const [reminderFormTitle, setReminderFormTitle] = useState('');
  const [reminderFormType, setReminderFormType] = useState('general');
  const [reminderFormDateTime, setReminderFormDateTime] = useState(new Date());
  const [showReminderDatePicker, setShowReminderDatePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [reminderFormDescription, setReminderFormDescription] = useState('');
  const [savingReminder, setSavingReminder] = useState(false);

  // View All Reminders modal states
  const [viewAllRemindersModalVisible, setViewAllRemindersModalVisible] = useState(false);
  const [selectedSeniorForReminders, setSelectedSeniorForReminders] = useState(null);
  const [allReminders, setAllReminders] = useState([]);
  const [loadingAllReminders, setLoadingAllReminders] = useState(false);
  const [displayCountReminders, setDisplayCountReminders] = useState(10);
  const [isLoadingMoreReminders, setIsLoadingMoreReminders] = useState(false);

  // Days of the week
  const daysOfWeek = [
    { label: 'Monday', value: 'monday' },
    { label: 'Tuesday', value: 'tuesday' },
    { label: 'Wednesday', value: 'wednesday' },
    { label: 'Thursday', value: 'thursday' },
    { label: 'Friday', value: 'friday' },
    { label: 'Saturday', value: 'saturday' },
    { label: 'Sunday', value: 'sunday' }
  ];

  // Cleanup DateTimePicker on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Ensure DateTimePickers are dismissed when component unmounts
      setShowTimePicker(false);
      setShowReminderDatePicker(false);
      setShowReminderTimePicker(false);
    };
  }, []);

  // Load language preference
  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  // Close modals and pickers when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Clean up when navigating away
        setModalVisible(false);
        setReminderModalVisible(false);
        setShowTimePicker(false);
        setShowReminderDatePicker(false);
        setShowReminderTimePicker(false);
      };
    }, [])
  );

  // Fetch linked seniors on mount
  useEffect(() => {
    const fetchLinkedSeniors = async () => {
      if (!user?.uid) return;
      
      const result = await getLinkedSeniorsWithDetails(user.uid);
      
      if (result.success && result.data.length > 0) {
        setLinkedSeniors(result.data);
        setSelectedSeniorId(result.data[0].userId);
        setSelectedSeniorIndex(0);
      } else {
        setLoading(false);
      }
    };

    fetchLinkedSeniors();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (selectedSeniorId) {
        fetchData();
      }
      return () => {
        setShowTimePicker(false);
        setShowReminderDatePicker(false);
        setShowReminderTimePicker(false);
        setModalVisible(false);
        setReminderModalVisible(false);
      };
    }, [selectedSeniorId, fetchData])
  );

  // Fetch routines and health logs when senior changes
  useEffect(() => {
    if (selectedSeniorId) {
      fetchData();
      
      const unsubscribeRoutines = listenToRoutinesForSenior(selectedSeniorId, (updatedRoutines) => {
        setRoutines(updatedRoutines);
      });

      const unsubscribeReminders = listenToRemindersForSenior(selectedSeniorId, (updatedReminders) => {
        setReminders(updatedReminders);
      });
      
      // Cleanup listeners and pickers
      return () => {
        if (unsubscribeRoutines) unsubscribeRoutines();
        if (unsubscribeReminders) unsubscribeReminders();
        // Close modals first to prevent DateTimePicker cleanup issues
        setModalVisible(false);
        setReminderModalVisible(false);
        // Then ensure pickers are dismissed
        setShowTimePicker(false);
        setShowReminderDatePicker(false);
        setShowReminderTimePicker(false);
      };
    } else {
      // Reset state when no senior is selected
      setRoutines([]);
      setReminders([]);
      setHealthLogs([]);
      setLoading(false);
    }
  }, [fetchData, selectedSeniorId]);

  const fetchData = useCallback(async () => {
    if (!selectedSeniorId) return;
    
    setLoading(true);

    try {
      // Fetch routines
      const routinesResult = await getRoutinesForSenior(selectedSeniorId);
      if (routinesResult.success) {
        setRoutines(routinesResult.routines);
      }

      // Fetch reminders
      const remindersResult = await getRemindersForSenior(selectedSeniorId);
      if (remindersResult.success) {
        setReminders(remindersResult.reminders);
      }

      // Fetch health logs
      const logsResult = await getHealthLogsForRoutines(selectedSeniorId, healthLogDays);
      if (logsResult.success) {
        setAllHealthLogs(logsResult.logs);
        setHealthLogs(logsResult.logs.slice(0, 3));
        setDisplayedLogsCount(3);
      } else {
        setAllHealthLogs([]);
        setHealthLogs([]);
      }
    } catch (error) {
      // Handle error silently or show alert
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSeniorId, healthLogDays]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const handleLoadMoreHealthLogs = async () => {
    const newCount = displayedLogsCount + 3;
    
    // If we still have logs in the cache, just show more
    if (newCount <= allHealthLogs.length) {
      setHealthLogs(allHealthLogs.slice(0, newCount));
      setDisplayedLogsCount(newCount);
    } else {
      // Otherwise, fetch more days of logs
      const newDays = healthLogDays + 7;
      setHealthLogDays(newDays);
      
      const logsResult = await getHealthLogsForRoutines(selectedSeniorId, newDays);
      if (logsResult.success) {
        setAllHealthLogs(logsResult.logs);
        setHealthLogs(logsResult.logs.slice(0, newCount));
        setDisplayedLogsCount(newCount);
      }
    }
  };

  const handleSeniorSelect = (seniorId, index) => {
    setSelectedSeniorId(seniorId);
    setSelectedSeniorIndex(index);
    setShowSeniorSelector(false);
    setHealthLogDays(7); // Reset to 7 days when changing senior
    setExpandedLogs([]); // Collapse all logs
    setDisplayedLogsCount(3); // Reset displayed count
    setAllHealthLogs([]); // Clear cache
  };

  const toggleLogExpansion = (logId) => {
    setExpandedLogs(prev => 
      prev.includes(logId) 
        ? prev.filter(id => id !== logId)
        : [...prev, logId]
    );
  };

  const handleCreateRoutine = () => {
    setModalMode('create');
    setEditingRoutine(null);
    setFormTitle('');
    setFormType('medication');
    setFormTime(new Date()); // Reset to current time
    setFormSelectedDays([]); // Reset days
    setFormNotes('');
    setModalVisible(true);
  };

  const handleEditRoutine = (routine) => {
    setModalMode('edit');
    setEditingRoutine(routine);
    setFormTitle(routine.title || '');
    setFormType(routine.type || 'medication');
    
    // Extract time from scheduledTime
    if (routine.scheduledTime) {
      const date = toDate(routine.scheduledTime) || new Date();
      setFormTime(date);
    } else {
      setFormTime(new Date());
    }
    
    // Parse frequency to selected days array
    if (routine.frequency && routine.frequency !== 'daily') {
      try {
        const days = JSON.parse(routine.frequency);
        setFormSelectedDays(Array.isArray(days) ? days : []);
      } catch {
        setFormSelectedDays([]);
      }
    } else if (routine.frequency === 'daily') {
      // If daily, select all days
      setFormSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
    } else {
      setFormSelectedDays([]);
    }
    
    setFormNotes(routine.notes || '');
    setModalVisible(true);
  };

  const handleDeleteRoutine = async (routineId) => {
    if (!routineId) {
      Alert.alert('Error', 'Cannot delete routine: Invalid routine ID');
      return;
    }
    
    // Show confirmation dialog
    Alert.alert(
      'Delete Routine',
      'Are you sure you want to delete this routine?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteRoutine(routineId);
            
            if (result.success) {
              // No need to call fetchData() - the real-time listener will update automatically
            } else {
              Alert.alert('Error', result.error || 'Failed to delete routine. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleSaveRoutine = async () => {
    // Validation
    if (!formTitle.trim()) {
      Alert.alert('Validation', 'Please enter a routine title');
      return;
    }
    if (formSelectedDays.length === 0) {
      Alert.alert('Validation', 'Please select at least one day');
      return;
    }

    setSaving(true);

    try {
      // Use the selected time directly
      const scheduledTime = new Date(formTime);

      // Convert selected days to frequency string
      let frequency;
      if (formSelectedDays.length === 7) {
        frequency = 'daily';
      } else {
        frequency = JSON.stringify(formSelectedDays);
      }

      const routineData = {
        userId: selectedSeniorId,
        title: formTitle.trim(),
        type: formType,
        scheduledTime: scheduledTime,
        frequency: frequency,
        notes: formNotes.trim(),
        createdBy: user.uid
      };

      if (modalMode === 'create') {
        await createRoutine(routineData);
      } else {
        await updateRoutine(editingRoutine.routineId, routineData);
      }

      setModalVisible(false);
      await fetchData(); // Refresh data
    } catch (error) {
      Alert.alert('Error', 'Failed to save routine. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelModal = () => {
    setModalVisible(false);
    // Dismiss any open DateTimePickers
    setShowTimePicker(false);
  };

  // Reminder handlers
  const handleCreateReminder = () => {
    setReminderModalMode('create');
    setEditingReminder(null);
    setReminderFormTitle('');
    setReminderFormType('general');
    setReminderFormDateTime(new Date());
    setReminderFormDescription('');
    setReminderModalVisible(true);
  };

  const handleEditReminder = (reminder) => {
    setReminderModalMode('edit');
    setEditingReminder(reminder);
    setReminderFormTitle(reminder.title || '');
    setReminderFormType(reminder.type || 'general');
    
    // Extract date and time from scheduledTime
    if (reminder.scheduledTime) {
      const date = toDate(reminder.scheduledTime) || new Date();
      setReminderFormDateTime(date);
    } else {
      setReminderFormDateTime(new Date());
    }
    
    setReminderFormDescription(reminder.description || '');
    setReminderModalVisible(true);
  };

  const handleDeleteReminder = async (reminderId) => {
    if (!reminderId) {
      Alert.alert('Error', 'Cannot delete reminder: Invalid reminder ID');
      return;
    }
    
    // Show confirmation dialog
    Alert.alert(
      translations.deleteReminder || 'Delete Reminder',
      translations.confirmDelete || 'Are you sure you want to delete this reminder?',
      [
        {
          text: translations.cancel || 'Cancel',
          style: 'cancel'
        },
        {
          text: translations.deleteReminder || 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteReminder(reminderId);
            
            if (result.success) {
              // No need to call fetchData() - the real-time listener will update automatically
            } else {
              Alert.alert(translations.error || 'Error', result.error || 'Failed to delete reminder. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleViewAllReminders = () => {
    setViewAllRemindersModalVisible(true);
    if (linkedSeniors.length > 0) {
      // Default to first senior or currently selected senior
      const defaultSenior = selectedSeniorId ? linkedSeniors.find(s => s.userId === selectedSeniorId) : linkedSeniors[0];
      setSelectedSeniorForReminders(defaultSenior);
      fetchAllRemindersForSenior(defaultSenior.userId);
    }
  };

  const fetchAllRemindersForSenior = async (seniorId) => {
    setLoadingAllReminders(true);
    setDisplayCountReminders(10); // Reset display count when fetching new reminders
    const result = await getAllRemindersForSenior(seniorId);
    if (result.success) {
      setAllReminders(result.reminders);
    } else {
      Alert.alert('Error', 'Failed to fetch reminders');
    }
    setLoadingAllReminders(false);
  };

  const handleScrollReminders = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 300;
    
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isNearBottom) {
      if (!isLoadingMoreReminders && displayCountReminders < allReminders.length) {
        setIsLoadingMoreReminders(true);
        setTimeout(() => {
          setDisplayCountReminders(prevCount => prevCount + 5);
          setIsLoadingMoreReminders(false);
        }, 300);
      }
    }
  };

  const handleSeniorSelectForReminders = (senior) => {
    setSelectedSeniorForReminders(senior);
    fetchAllRemindersForSenior(senior.userId);
  };

  const handleSaveReminder = async () => {
    // Validation
    if (!reminderFormTitle.trim()) {
      Alert.alert('Validation', 'Please enter a reminder title');
      return;
    }

    setSavingReminder(true);

    try {
      const selectedSenior = linkedSeniors.find(s => s.userId === selectedSeniorId);
      const seniorName = selectedSenior?.name || selectedSenior?.fullName || 'Unknown Senior';
      const creatorName = userProfile?.name || userProfile?.fullName || 'Family Member';

      const reminderData = {
        userId: selectedSeniorId,
        seniorName: seniorName,
        title: reminderFormTitle.trim(),
        type: reminderFormType,
        scheduledTime: reminderFormDateTime,
        description: reminderFormDescription.trim(),
        createdBy: user.uid,
        createdByName: creatorName
      };

      if (reminderModalMode === 'create') {
        await createReminder(reminderData);
      } else {
        await updateReminder(editingReminder.reminderId, reminderData);
      }

      setReminderModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save reminder. Please try again.');
    } finally {
      setSavingReminder(false);
    }
  };

  const handleCancelReminderModal = () => {
    setReminderModalVisible(false);
    // Dismiss any open DateTimePickers
    setShowReminderDatePicker(false);
    setShowReminderTimePicker(false);
  };

  const onReminderDateTimeChange = (event, selectedDate) => {
    try {
      // Check if component is still mounted
      if (!isMounted.current) {
        return;
      }

      // For Android, handle date picker
      if (Platform.OS === 'android') {
        // Use setTimeout to ensure state update happens after picker dismisses naturally
        setTimeout(() => {
          if (isMounted.current) {
            setShowReminderDatePicker(false);
            // After date is selected, show time picker
            if (event?.type === 'set' && selectedDate) {
              setShowReminderTimePicker(true);
            }
          }
        }, 100);
        
        // Only update if user confirmed (not dismissed/cancelled)
        if (event?.type === 'set' && selectedDate) {
          setReminderFormDateTime(selectedDate);
        }
      } else {
        // For iOS, update immediately as user scrolls (no dismiss needed)
        if (selectedDate) {
          setReminderFormDateTime(selectedDate);
        }
      }
    } catch (error) {
      // Error handling
    }
  };

  const onReminderTimeChange = (event, selectedTime) => {
    try {
      // Check if component is still mounted
      if (!isMounted.current) {
        return;
      }

      // For Android, handle time picker
      if (Platform.OS === 'android') {
        // Use setTimeout to ensure state update happens after picker dismisses naturally
        setTimeout(() => {
          if (isMounted.current) {
            setShowReminderTimePicker(false);
          }
        }, 100);
        
        // Only update if user confirmed (not dismissed/cancelled)
        if (event?.type === 'set' && selectedTime) {
          // Combine the date from reminderFormDateTime with the new time
          const updatedDateTime = new Date(reminderFormDateTime);
          updatedDateTime.setHours(selectedTime.getHours());
          updatedDateTime.setMinutes(selectedTime.getMinutes());
          setReminderFormDateTime(updatedDateTime);
        }
      } else {
        // For iOS, update immediately as user scrolls (no dismiss needed)
        if (selectedTime) {
          const updatedDateTime = new Date(reminderFormDateTime);
          updatedDateTime.setHours(selectedTime.getHours());
          updatedDateTime.setMinutes(selectedTime.getMinutes());
          setReminderFormDateTime(updatedDateTime);
        }
      }
    } catch (error) {
      // Error handling
    }
  };

  const onTimeChange = (event, selectedDate) => {
    try {
      // Check if component is still mounted
      if (!isMounted.current) {
        return;
      }

      // For Android, IMMEDIATELY dismiss the picker to prevent unmount issues
      if (Platform.OS === 'android') {
        // Use setTimeout to ensure state update happens after picker dismisses naturally
        setTimeout(() => {
          if (isMounted.current) {
            setShowTimePicker(false);
          }
        }, 100);
        
        // Only update if user confirmed (not dismissed/cancelled)
        if (event?.type === 'set' && selectedDate) {
          setFormTime(selectedDate);
        }
      } else {
        // For iOS, update immediately as user scrolls (no dismiss needed)
        if (selectedDate) {
          setFormTime(selectedDate);
        }
      }
    } catch (error) {
      // Error handling
    }
  };

  const toggleDaySelection = (day) => {
    setFormSelectedDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  const selectAllDays = () => {
    setFormSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  };

  const deselectAllDays = () => {
    setFormSelectedDays([]);
  };

  const formatTimeDisplay = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = toDate(timestamp);
    if (!date) return '';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatLogTime = (timestamp) => {
    if (!timestamp) return '';
    const date = toDate(timestamp);
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatFrequency = (frequency) => {
    if (!frequency) return 'Daily';
    if (frequency === 'daily') return 'Every day';
    
    try {
      const days = JSON.parse(frequency);
      if (Array.isArray(days) && days.length > 0) {
        if (days.length === 7) return 'Every day';
        return days.map(d => 
          daysOfWeek.find(day => day.value === d)?.label.slice(0, 3)
        ).join(', ');
      }
    } catch {
      return frequency;
    }
    return 'Daily';
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'completed':
        return { bg: '#dcfce7', text: colors.status.success };
      case 'missed':
        return { bg: '#fecaca', text: colors.status.error };
      case 'pending':
      default:
        return { bg: '#fef3c7', text: colors.status.warning };
    }
  };

  const getIconForRoutineType = (type) => {
    const iconMap = {
      medication: 'medication',
      meal: 'restaurant',
      exercise: 'directions-walk',
      therapy: 'accessible',
      custom: 'task-alt'
    };
    return iconMap[type] || 'task-alt';
  };

  const getIconForReminderType = (type) => {
    const iconMap = {
      general: 'notifications',
      medication: 'medication',
      appointment: 'event',
      meal: 'restaurant',
      exercise: 'directions-walk',
      other: 'notifications-active'
    };
    return iconMap[type] || 'notifications';
  };

  const formatReminderDateTime = (timestamp) => {
    if (!timestamp) return '';
    const date = toDate(timestamp);
    if (!date) return '';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getReminderStatusStyle = (status) => {
    switch (status) {
      case 'completed':
        return { bg: '#dcfce7', text: colors.status.success };
      case 'pending':
      default:
        return { bg: '#fef3c7', text: colors.status.warning };
    }
  };

  const routineTypes = [
    { label: 'Medication', value: 'medication' },
    { label: 'Meal', value: 'meal' },
    { label: 'Exercise', value: 'exercise' },
    { label: 'Therapy', value: 'therapy' },
    { label: 'Custom', value: 'custom' }
  ];

  const reminderTypes = [
    { label: 'General', value: 'general' },
    { label: 'Medication', value: 'medication' },
    { label: 'Appointment', value: 'appointment' },
    { label: 'Meal', value: 'meal' },
    { label: 'Exercise', value: 'exercise' },
    { label: 'Other', value: 'other' }
  ];

  // Helper to normalize Firestore Timestamp or Date-like values into a JS Date
  const toDate = (value) => {
    if (!value) return null;
    if (value.toDate && typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    try {
      return new Date(value);
    } catch {
      return null;
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor={colors.background.lighter} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-gray-600">{translations.loading || 'Loading...'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (linkedSeniors.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor="#f6f7f8" />
        <View className="flex-1 justify-center items-center px-4">
          <MaterialIcons name="person-add" size={64} color={colors.border.light} />
          <Text className="mt-4 text-xl font-bold text-gray-900">{translations.noLinkedSeniors || 'No Linked Seniors'}</Text>
          <Text className="mt-2 text-gray-600 text-center">
            Link a senior to view their routines and health logs
          </Text>
        </View>
        <FamilyBottomNav />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

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
        </View>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Senior Selector Dropdown */}
        <View className="px-6 pt-6 pb-2 bg-white">
          <Text className="text-base font-bold text-gray-900 mb-4">{translations.yourSeniors || 'Your Seniors'}</Text>
          <TouchableOpacity 
            onPress={() => linkedSeniors.length > 1 && setShowSeniorSelector(!showSeniorSelector)}
            className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
            activeOpacity={linkedSeniors.length > 1 ? 0.7 : 1}
          >
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.primary }}>
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                  {(linkedSeniors[selectedSeniorIndex]?.name || linkedSeniors[selectedSeniorIndex]?.fullName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 mb-0.5">{translations.viewing || 'Viewing'}</Text>
                <Text className="text-sm font-bold text-gray-900">
                  {linkedSeniors[selectedSeniorIndex]?.name || linkedSeniors[selectedSeniorIndex]?.fullName || 'Unknown'}
                </Text>
              </View>
            </View>
            {linkedSeniors.length > 1 && (
              <MaterialIcons 
                name={showSeniorSelector ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                size={24} 
                color={colors.text.muted} 
              />
            )}
          </TouchableOpacity>

          {/* Dropdown List */}
          {showSeniorSelector && linkedSeniors.length > 1 && (
            <View className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
              {linkedSeniors.map((senior, index) => (
                <TouchableOpacity
                  key={senior.userId}
                  onPress={() => handleSeniorSelect(senior.userId, index)}
                  className={`flex-row items-center px-4 py-3 ${
                    index !== linkedSeniors.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                  style={index === selectedSeniorIndex ? { backgroundColor: colors.background.lighter } : {}}
                  activeOpacity={0.7}
                >
                  <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{
                    backgroundColor: index === selectedSeniorIndex ? colors.primary : colors.text.muted
                  }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                      {(senior.name || senior.fullName || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold" style={{
                      color: index === selectedSeniorIndex ? colors.primary : '#111827'
                    }}>
                      {senior.name || senior.fullName || 'Unknown'}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-0.5">{senior.phone || senior.phoneNumber || 'N/A'}</Text>
                  </View>
                  {index === selectedSeniorIndex && (
                    <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Routines Section */}
        <View className="px-6 pt-4 pb-2 bg-white">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-base font-bold text-gray-900">
              Daily Routines
            </Text>
            <TouchableOpacity 
              onPress={handleCreateRoutine}
              className="rounded-xl px-4 py-2"
              style={{ backgroundColor: colors.primary }}
            >
              <View className="flex-row items-center">
                <MaterialIcons name="add" size={16} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 4 }}>{translations.add || 'Add'}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {routines.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-gray-100">
              <View className="w-16 h-16 bg-blue-50 rounded-3xl items-center justify-center mb-3">
                <MaterialIcons name="schedule" size={32} color={colors.primary} />
              </View>
              <Text className="text-gray-900 font-bold text-lg">{translations.noRoutinesYet || 'No Routines Yet'}</Text>
              <Text className="text-gray-600 mt-1 text-center">{translations.createRoutineToTrack || 'Create a routine to track daily activities'}</Text>
            </View>
          ) : (
            routines.map((routine, index) => {
              const statusStyle = getStatusStyle(routine.status);
              const iconColor = routine.status === 'completed' ? colors.status.success :
                               routine.status === 'missed' ? colors.status.error : colors.primary;
              const cardBg = routine.status === 'completed' ? '#f0fdf4' :
                            routine.status === 'missed' ? '#fef5f5' : '#ffffff';
              const iconBg = routine.status === 'completed' ? '#dcfce7' :
                            routine.status === 'missed' ? '#fee2e2' : '#f0f4f7';
              
              return (
                <View 
                  key={routine.routineId || `routine-${index}`} 
                  className="rounded-2xl mb-3 p-4"
                  style={{ 
                    backgroundColor: cardBg,
                    borderWidth: 1,
                    borderColor: routine.status === 'completed' ? colors.status.success : 
                                routine.status === 'missed' ? colors.status.error : colors.border.light,
                    shadowColor: iconColor,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 3,
                    elevation: 2
                  }}
                >
                  <View className="flex-row items-start">
                    {/* Icon Circle */}
                    <View 
                      className="mr-3 rounded-xl items-center justify-center"
                      style={{ 
                        width: 48, 
                        height: 48, 
                        backgroundColor: iconBg
                      }}
                    >
                      <MaterialIcons 
                        name={getIconForRoutineType(routine.type)} 
                        size={26} 
                        color={iconColor}
                      />
                    </View>

                    {/* Content */}
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-base font-bold text-gray-900" style={{ flex: 1, paddingRight: 8 }}>
                          {routine.title}
                        </Text>
                        <View 
                          className="px-3 py-1.5 rounded-full"
                          style={{ backgroundColor: statusStyle.bg }}
                        >
                          <Text className="text-xs font-bold" style={{ color: statusStyle.text }}>
                            {routine.status === 'completed' ? '✓ Done' :
                             routine.status === 'missed' ? '✗ Missed' : '○ Pending'}
                          </Text>
                        </View>
                      </View>
                      
                      <View className="flex-row items-center mb-2 flex-wrap gap-2">
                        <View className="flex-row items-center rounded-lg px-2 py-1" style={{ backgroundColor: '#f9fafb' }}>
                          <MaterialIcons name="access-time" size={14} color={iconColor} />
                          <Text className="text-xs font-semibold ml-1" style={{ color: iconColor }}>
                            {formatTime(routine.scheduledTime)}
                          </Text>
                        </View>
                        <View className="flex-row items-center rounded-lg px-2 py-1" style={{ backgroundColor: '#f9fafb' }}>
                          <MaterialIcons name="repeat" size={14} color={colors.text.muted} />
                          <Text className="text-xs font-medium text-gray-600 ml-1">
                            {formatFrequency(routine.frequency)}
                          </Text>
                        </View>
                      </View>
                      
                      {routine.notes && (
                        <View className="rounded-lg p-2 mb-2" style={{ backgroundColor: '#f9fafb' }}>
                          <Text className="text-xs text-gray-600 leading-4" numberOfLines={2}>
                            💬 {routine.notes}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Three Dot Menu */}
                    <Menu
                      visible={menuVisible === (routine.routineId || routine.id)}
                      onDismiss={() => setMenuVisible(null)}
                      anchor={
                        <TouchableOpacity 
                          onPress={() => setMenuVisible(routine.routineId || routine.id)}
                          className="p-2"
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="more-vert" size={22} color={colors.text.muted} />
                        </TouchableOpacity>
                      }
                      contentStyle={{ backgroundColor: 'white', borderRadius: 12 }}
                    >
                      <Menu.Item 
                        onPress={() => {
                          setMenuVisible(null);
                          handleEditRoutine(routine);
                        }}
                        leadingIcon="pencil"
                        title="Edit"
                        titleStyle={{ color: colors.primary }}
                      />
                      <Menu.Item 
                        onPress={() => {
                          setMenuVisible(null);
                          handleDeleteRoutine(routine.routineId || routine.id);
                        }}
                        leadingIcon="delete"
                        title="Delete"
                        titleStyle={{ color: colors.status.error }}
                      />
                    </Menu>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Reminders Section */}
        <View className="px-6 pt-4 pb-2 bg-white">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-1">
              <Text className="text-base font-bold text-gray-900">
                {translations.reminders || 'Reminders'}
              </Text>
              <TouchableOpacity onPress={handleViewAllReminders}>
                <Text className="text-xs text-blue-600 mt-1 font-medium">
                  View All →
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              onPress={handleCreateReminder}
              className="bg-purple-500 rounded-xl px-4 py-2"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="add" size={16} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 4 }}>{translations.add || 'Add'}</Text>
              </View>
            </TouchableOpacity>
          </View>
          
          {reminders.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-gray-100">
              <View className="w-16 h-16 rounded-3xl items-center justify-center mb-3" style={{ backgroundColor: '#f3f0f7' }}>
                <MaterialIcons name="notifications" size={32} color={colors.secondary} />
              </View>
              <Text className="text-gray-900 font-bold text-lg">{translations.noReminders || 'No Reminders'}</Text>
              <Text className="text-gray-600 mt-1 text-center">{translations.setUpRemindersForTasks || 'Set up reminders for important tasks'}</Text>
            </View>
          ) : (
            reminders.map((reminder, index) => {
              const statusStyle = getReminderStatusStyle(reminder.status);
              const iconColor = reminder.status === 'completed' ? colors.status.success : colors.secondary;
              const iconBg = reminder.status === 'completed' ? '#e8f5e9' : '#f3f0f7';
              
              return (
                <View 
                  key={reminder.reminderId || `reminder-${index}`} 
                  className="rounded-2xl mb-3 p-4 border"
                  style={{ 
                    backgroundColor: reminder.status === 'completed' ? '#f0fdf4' : '#ffffff',
                    borderColor: reminder.status === 'completed' ? colors.status.success : colors.border.light,
                    shadowColor: iconColor,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    elevation: 2
                  }}
                >
                  <View className="flex-row items-start">
                    {/* Icon Circle */}
                    <View 
                      className="mr-3 rounded-xl items-center justify-center"
                      style={{ 
                        width: 48, 
                        height: 48, 
                        backgroundColor: iconBg
                      }}
                    >
                      <MaterialIcons 
                        name={getIconForReminderType(reminder.type)} 
                        size={26} 
                        color={iconColor}
                      />
                    </View>

                    {/* Content */}
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-base font-bold text-gray-900" style={{ flex: 1 }}>
                          {reminder.title}
                        </Text>
                        <View 
                          className="px-3 py-1.5 rounded-full ml-2"
                          style={{ backgroundColor: statusStyle.bg }}
                        >
                          <Text className="text-xs font-bold" style={{ color: statusStyle.text }}>
                            {reminder.status === 'completed' ? '✓ Done' : '○ Pending'}
                          </Text>
                        </View>
                      </View>
                      
                      <View className="flex-row items-center mb-2">
                        <View className="flex-row items-center rounded-lg px-2 py-1" style={{ backgroundColor: '#f9fafb' }}>
                          <MaterialIcons name="event" size={14} color={iconColor} />
                          <Text className="text-xs font-semibold ml-1" style={{ color: iconColor }}>
                            {formatReminderDateTime(reminder.scheduledTime)}
                          </Text>
                        </View>
                      </View>
                      
                      {reminder.description && (
                        <TouchableOpacity 
                          onPress={() => {
                            const reminderId = reminder.reminderId || reminder.id;
                            setExpandedReminders(prev => 
                              prev.includes(reminderId) 
                                ? prev.filter(id => id !== reminderId)
                                : [...prev, reminderId]
                            );
                          }}
                          activeOpacity={0.7}
                        >
                          <View className="rounded-lg p-2 mb-2 flex-row items-center justify-between" style={{ backgroundColor: '#f9fafb' }}>
                            <Text className="text-xs font-semibold" style={{ color: iconColor }}>
                              {expandedReminders.includes(reminder.reminderId || reminder.id) ? '📝 Hide Note' : '📝 View Note'}
                            </Text>
                            <MaterialIcons 
                              name={expandedReminders.includes(reminder.reminderId || reminder.id) ? 'expand-less' : 'expand-more'} 
                              size={18} 
                              color={iconColor} 
                            />
                          </View>
                          {expandedReminders.includes(reminder.reminderId || reminder.id) && (
                            <View className="rounded-lg p-2 mb-2 mt-1" style={{ backgroundColor: '#f0f4f7', borderLeftWidth: 3, borderLeftColor: iconColor }}>
                              <Text className="text-xs text-gray-700 leading-5">
                                {reminder.description}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Three Dot Menu */}
                    <Menu
                      visible={reminderMenuVisible === (reminder.reminderId || reminder.id)}
                      onDismiss={() => setReminderMenuVisible(null)}
                      anchor={
                        <TouchableOpacity 
                          onPress={() => setReminderMenuVisible(reminder.reminderId || reminder.id)}
                          className="p-2"
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="more-vert" size={22} color={colors.text.muted} />
                        </TouchableOpacity>
                      }
                      contentStyle={{ backgroundColor: 'white', borderRadius: 12 }}
                    >
                      <Menu.Item 
                        onPress={() => {
                          setReminderMenuVisible(null);
                          handleEditReminder(reminder);
                        }}
                        leadingIcon="pencil"
                        title="Edit"
                        titleStyle={{ color: colors.secondary }}
                      />
                      <Menu.Item 
                        onPress={() => {
                          setReminderMenuVisible(null);
                          handleDeleteReminder(reminder.reminderId || reminder.id);
                        }}
                        leadingIcon="delete"
                        title="Delete"
                        titleStyle={{ color: colors.status.error }}
                      />
                    </Menu>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Health Logs Section */}
        <View className="px-6 pt-4 pb-32 bg-white">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-base font-bold text-gray-900">
              Health Logs
            </Text>
            <Text className="text-xs text-gray-600">
              Last {healthLogDays} days
            </Text>
          </View>

          {healthLogs.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-gray-100">
              <View className="w-16 h-16 rounded-3xl items-center justify-center mb-3" style={{ backgroundColor: '#fef5f5' }}>
                <MaterialIcons name="favorite" size={32} color={colors.status.error} />
              </View>
              <Text className="text-gray-900 font-bold text-lg">{translations.noHealthLogs || 'No Health Logs'}</Text>
              <Text className="text-gray-600 mt-1 text-center">{translations.noHealthRecordsForPeriod || 'No health records found for the selected period'}</Text>
            </View>
          ) : (
            <>
              {healthLogs.map((log, logIndex) => {
                const isExpanded = expandedLogs.includes(log.logId || log.id);
                
                return (
                  <TouchableOpacity
                    key={log.logId || log.id || `log-${logIndex}`}
                    onPress={() => toggleLogExpansion(log.logId || log.id)}
                    activeOpacity={0.7}
                  >
                    <View 
                      className="rounded-2xl mb-3 overflow-hidden"
                      style={{ 
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 1
                      }}
                    >
                      <View className="p-4">
                        {/* Header */}
                        <View className="flex-row items-center justify-between mb-3">
                          <View className="flex-1 flex-row items-center">
                            <View 
                              className="rounded-xl items-center justify-center mr-3"
                              style={{ 
                                width: 44, 
                                height: 44, 
                                backgroundColor: '#fef2f2'
                              }}
                            >
                              <MaterialIcons name="favorite" size={24} color="#ef4444" />
                            </View>
                            <View>
                              <Text className="text-sm font-bold text-gray-900">
                                Health Check
                              </Text>
                              <Text className="text-xs text-gray-500">
                                {String(formatLogTime(log.createdAt) || '')}
                              </Text>
                            </View>
                          </View>
                          <View 
                            className="w-7 h-7 rounded-full items-center justify-center"
                            style={{ backgroundColor: '#f3f4f6' }}
                          >
                            <MaterialIcons 
                              name={isExpanded ? 'expand-less' : 'expand-more'} 
                              size={18} 
                              color={colors.text.muted} 
                            />
                          </View>
                        </View>

                        {/* Vitals Display */}
                        {log.vitals && typeof log.vitals === 'object' && Object.keys(log.vitals).length > 0 ? (
                          <View className="gap-2 mb-2">
                            <View className="flex-row gap-2">
                              <View className="flex-1 rounded-lg p-2.5" style={{ backgroundColor: '#fef2f2' }}>
                                <View className="flex-row items-center mb-1">
                                  <MaterialIcons name="favorite" size={14} color="#ef4444" />
                                  <Text className="text-xs font-semibold ml-1 text-gray-600">{translations.bp || 'BP'}</Text>
                                </View>
                                <Text className="text-sm font-bold text-gray-900">
                                  {typeof log.vitals.bloodPressure === 'string' || typeof log.vitals.bloodPressure === 'number' ? String(log.vitals.bloodPressure) : 'N/A'}
                                </Text>
                              </View>

                              <View className="flex-1 rounded-lg p-2.5" style={{ backgroundColor: '#fffbeb' }}>
                                <View className="flex-row items-center mb-1">
                                  <MaterialIcons name="water-drop" size={14} color="#f59e0b" />
                                  <Text className="text-xs font-semibold ml-1 text-gray-600">{translations.sugar || 'Sugar'}</Text>
                                </View>
                                <Text className="text-sm font-bold text-gray-900">
                                  {typeof log.vitals.bloodSugar === 'string' || typeof log.vitals.bloodSugar === 'number' ? String(log.vitals.bloodSugar) : 'N/A'}
                                </Text>
                              </View>
                            </View>

                            {(typeof log.vitals.temperature === 'string' || typeof log.vitals.temperature === 'number') && (
                              <View className="rounded-lg p-2.5" style={{ backgroundColor: '#f0f9ff' }}>
                                <View className="flex-row items-center justify-between">
                                  <View className="flex-row items-center">
                                    <MaterialIcons name="thermostat" size={14} color="#3b82f6" />
                                    <Text className="text-xs font-semibold ml-1 text-gray-600">{translations.temperature || 'Temperature'}</Text>
                                  </View>
                                  <Text className="text-sm font-bold text-gray-900">
                                    {String(log.vitals.temperature)}°F
                                  </Text>
                                </View>
                              </View>
                            )}
                          </View>
                        ) : null}

                        {/* Expanded Details */}
                        {isExpanded && (
                          <View className="mt-3 pt-3 border-t border-gray-100">
                            {log.notes && (
                              <View className="mb-3">
                                <Text className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                                  Notes
                                </Text>
                                <Text className="text-sm text-gray-700 leading-5">
                                  {String(log.notes || '')}
                                </Text>
                              </View>
                            )}
                            
                            {log.loggedBy && (
                              <View className="mb-3">
                                <Text className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                                  Logged By
                                </Text>
                                <Text className="text-sm text-gray-700">
                                  {String(log.loggedBy || '')}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Load More Button - only show if there are more logs to display */}
              {displayedLogsCount < allHealthLogs.length || allHealthLogs.length === displayedLogsCount ? (
                <TouchableOpacity 
                  onPress={handleLoadMoreHealthLogs}
                  className="bg-white rounded-xl py-3 items-center mt-2 border border-gray-100"
                >
                  <View className="flex-row items-center">
                    <MaterialIcons name="expand-more" size={18} color={colors.primary} />
                    <Text className="text-blue-600 font-semibold text-sm ml-2">
                      Load More Health Logs
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Routine Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={handleCancelModal}
          contentContainerStyle={{
            backgroundColor: 'white',
            marginHorizontal: 20,
            marginVertical: 40,
            padding: 20,
            borderRadius: 12,
            maxHeight: '85%'
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text.dark }}>
                {modalMode === 'create' ? 'Create Routine' : 'Edit Routine'}
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={handleCancelModal}
                style={{ margin: 0 }}
              />
            </View>

            {/* Title Input */}
            <TextInput
              label="Routine Title *"
              value={formTitle}
              onChangeText={setFormTitle}
              mode="outlined"
              placeholder="e.g., Morning Medication"
              style={{ marginBottom: 12 }}
            />

            {/* Type Dropdown */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Routine Type</Text>
              <TouchableOpacity 
                onPress={() => setRoutineTypeMenuVisible(!routineTypeMenuVisible)}
                className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <MaterialIcons 
                    name={getIconForRoutineType(formType)} 
                    size={20} 
                    color={colors.primary} 
                  />
                  <Text className="text-sm font-medium text-gray-900 ml-2">
                    {routineTypes.find(t => t.value === formType)?.label || 'Select Type'}
                  </Text>
                </View>
                <MaterialIcons 
                  name={routineTypeMenuVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                  size={24} 
                  color={colors.text.muted} 
                />
              </TouchableOpacity>

              {routineTypeMenuVisible && (
                <View className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  {routineTypes.map((type, index) => (
                    <TouchableOpacity
                      key={type.value}
                      onPress={() => {
                        setFormType(type.value);
                        setRoutineTypeMenuVisible(false);
                      }}
                      className={`flex-row items-center px-4 py-3 ${
                        index !== routineTypes.length - 1 ? 'border-b border-gray-100' : ''
                      }`}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons 
                        name={getIconForRoutineType(type.value)} 
                        size={20} 
                        color={formType === type.value ? colors.primary : colors.text.muted} 
                      />
                      <Text className={`flex-1 text-sm ml-3 ${formType === type.value ? 'font-bold text-blue-600' : 'text-gray-900'}`}>
                        {type.label}
                      </Text>
                      {formType === type.value && (
                        <MaterialIcons name="check" size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Time Picker */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: 8 }}>
                Time *
              </Text>
              <Button
                mode="outlined"
                onPress={() => {
                  if (Platform.OS === 'android') {
                    // For Android, DateTimePicker will show as modal automatically
                    setShowTimePicker(true);
                  } else {
                    setShowTimePicker(true);
                  }
                }}
                icon="clock-outline"
                contentStyle={{ justifyContent: 'flex-start' }}
              >
                {formatTimeDisplay(formTime)}
              </Button>
              
              {Platform.OS === 'ios' && showTimePicker && (
                <View style={{ marginTop: 8 }}>
                  <DateTimePicker
                    value={formTime}
                    mode="time"
                    is24Hour={false}
                    display="spinner"
                    onChange={onTimeChange}
                  />
                  <Button
                    mode="contained"
                    onPress={() => setShowTimePicker(false)}
                    style={{ marginTop: 8 }}
                    buttonColor={colors.primary}
                  >
                    Done
                  </Button>
                </View>
              )}
              
              {Platform.OS === 'android' && showTimePicker && isMounted.current && modalVisible && (
                <DateTimePicker
                  value={formTime}
                  mode="time"
                  is24Hour={false}
                  display="default"
                  onChange={onTimeChange}
                />
              )}
            </View>

            {/* Day Selection */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary }}>
                  Select Days *
                </Text>
                <View style={{ flexDirection: 'row' }}>
                  <Button
                    mode="text"
                    onPress={selectAllDays}
                    compact
                    textColor={colors.primary}
                    style={{ marginHorizontal: 4 }}
                  >
                    All
                  </Button>
                  <Button
                    mode="text"
                    onPress={deselectAllDays}
                    compact
                    textColor={colors.status.error}
                    style={{ marginHorizontal: 4 }}
                  >
                    None
                  </Button>
                </View>
              </View>
              
              <Card mode="outlined" style={{ padding: 8 }}>
                {daysOfWeek.map((day) => (
                  <TouchableOpacity
                    key={day.value}
                    onPress={() => toggleDaySelection(day.value)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                  >
                    <Checkbox.Android
                      status={formSelectedDays.includes(day.value) ? 'checked' : 'unchecked'}
                      onPress={() => toggleDaySelection(day.value)}
                      color={colors.primary}
                    />
                    <Text style={{ fontSize: 16, color: colors.text.dark, marginLeft: 8 }}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </Card>
            </View>

            {/* Frequency Display */}
            {formSelectedDays.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: colors.text.muted }}>
                  Routine will repeat on: {
                    formSelectedDays.length === 7 
                      ? 'Every day' 
                      : formSelectedDays.map(d => 
                          daysOfWeek.find(day => day.value === d)?.label.slice(0, 3)
                        ).join(', ')
                  }
                </Text>
              </View>
            )}

            {/* Notes */}
            <TextInput
              label="Notes"
              value={formNotes}
              onChangeText={setFormNotes}
              mode="outlined"
              placeholder="Additional instructions..."
              multiline
              numberOfLines={3}
              style={{ marginBottom: 16 }}
            />

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button
                mode="outlined"
                onPress={handleCancelModal}
                disabled={saving}
                style={{ marginRight: 8 }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveRoutine}
                loading={saving}
                disabled={saving}
                buttonColor={colors.primary}
              >
                {modalMode === 'create' ? 'Create' : 'Update'}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Add/Edit Reminder Modal */}
      <Portal>
        <Modal
          visible={reminderModalVisible}
          onDismiss={handleCancelReminderModal}
          contentContainerStyle={{
            backgroundColor: 'white',
            marginHorizontal: 20,
            marginVertical: 40,
            padding: 20,
            borderRadius: 12,
            maxHeight: '85%'
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text.dark }}>
                {reminderModalMode === 'create' ? (translations.createReminder || 'Create Reminder') : (translations.editReminder || 'Edit Reminder')}
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={handleCancelReminderModal}
                style={{ margin: 0 }}
              />
            </View>

            {/* Title Input */}
            <TextInput
              label={translations.reminderTitle || "Reminder Title *"}
              value={reminderFormTitle}
              onChangeText={setReminderFormTitle}
              mode="outlined"
              placeholder="e.g., Doctor Appointment"
              style={{ marginBottom: 12 }}
            />

            {/* Type Dropdown */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">{translations.reminderType || 'Reminder Type'}</Text>
              <TouchableOpacity 
                onPress={() => setReminderTypeMenuVisible(!reminderTypeMenuVisible)}
                className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <MaterialIcons 
                    name={getIconForReminderType(reminderFormType)} 
                    size={20} 
                    color={colors.secondary} 
                  />
                  <Text className="text-sm font-medium text-gray-900 ml-2">
                    {reminderTypes.find(t => t.value === reminderFormType)?.label || translations.general || 'Select Type'}
                  </Text>
                </View>
                <MaterialIcons 
                  name={reminderTypeMenuVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                  size={24} 
                  color={colors.text.muted} 
                />
              </TouchableOpacity>

              {reminderTypeMenuVisible && (
                <View className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  {reminderTypes.map((type, index) => (
                    <TouchableOpacity
                      key={type.value}
                      onPress={() => {
                        setReminderFormType(type.value);
                        setReminderTypeMenuVisible(false);
                      }}
                      className={`flex-row items-center px-4 py-3 ${
                        index !== reminderTypes.length - 1 ? 'border-b border-gray-100' : ''
                      }`}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons 
                        name={getIconForReminderType(type.value)} 
                        size={20} 
                        color={reminderFormType === type.value ? colors.secondary : colors.text.muted} 
                      />
                      <Text className={`flex-1 text-sm ml-3 ${reminderFormType === type.value ? 'font-bold text-purple-600' : 'text-gray-900'}`}>
                        {type.label}
                      </Text>
                      {reminderFormType === type.value && (
                        <MaterialIcons name="check" size={18} color={colors.secondary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Date & Time Picker */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: 8 }}>
                {translations.reminderDateTime || 'Date & Time'} *
              </Text>
              <Button
                mode="outlined"
                onPress={() => {
                  // Start with date picker
                  setShowReminderDatePicker(true);
                }}
                icon="calendar-clock"
                contentStyle={{ justifyContent: 'flex-start' }}
              >
                {(() => {
                  try {
                    const dateObj = reminderFormDateTime instanceof Date ? reminderFormDateTime : new Date(reminderFormDateTime);
                    return dateObj.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    });
                  } catch (error) {
                    // Handle date formatting error silently
                    return 'Select Date & Time';
                  }
                })()}
              </Button>
              
              {/* iOS Date Picker */}
              {Platform.OS === 'ios' && showReminderDatePicker && (
                <View style={{ marginTop: 8 }}>
                  <DateTimePicker
                    value={reminderFormDateTime instanceof Date ? reminderFormDateTime : new Date()}
                    mode="datetime"
                    is24Hour={false}
                    display="spinner"
                    onChange={onReminderDateTimeChange}
                  />
                  <Button
                    mode="contained"
                    onPress={() => setShowReminderDatePicker(false)}
                    style={{ marginTop: 8 }}
                    buttonColor={colors.primary}
                  >
                    {translations.done || 'Done'}
                  </Button>
                </View>
              )}
              
              {/* Android Date Picker */}
              {Platform.OS === 'android' && showReminderDatePicker && isMounted.current && reminderModalVisible && (
                <DateTimePicker
                  value={reminderFormDateTime instanceof Date ? reminderFormDateTime : new Date()}
                  mode="date"
                  is24Hour={false}
                  display="default"
                  onChange={onReminderDateTimeChange}
                />
              )}
              
              {/* Android Time Picker */}
              {Platform.OS === 'android' && showReminderTimePicker && isMounted.current && reminderModalVisible && (
                <DateTimePicker
                  value={reminderFormDateTime instanceof Date ? reminderFormDateTime : new Date()}
                  mode="time"
                  is24Hour={false}
                  display="default"
                  onChange={onReminderTimeChange}
                />
              )}
            </View>

            {/* Description */}
            <TextInput
              label={translations.reminderDescription || "Description"}
              value={reminderFormDescription}
              onChangeText={setReminderFormDescription}
              mode="outlined"
              placeholder="Additional details..."
              multiline
              numberOfLines={3}
              style={{ marginBottom: 16 }}
            />

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button
                mode="outlined"
                onPress={handleCancelReminderModal}
                disabled={savingReminder}
                style={{ marginRight: 8 }}
              >
                {translations.cancel || 'Cancel'}
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveReminder}
                loading={savingReminder}
                disabled={savingReminder}
                buttonColor={colors.primary}
              >
                {reminderModalMode === 'create' ? (translations.createReminder || 'Create') : (translations.save || 'Update')}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* View All Reminders Modal */}
      <Portal>
        <Modal
          visible={viewAllRemindersModalVisible}
          onDismiss={() => setViewAllRemindersModalVisible(false)}
          contentContainerStyle={{
            backgroundColor: 'white',
            margin: 20,
            borderRadius: 12,
            maxHeight: '85%'
          }}
        >
          <ScrollView 
            showsVerticalScrollIndicator={false}
            onScroll={handleScrollReminders}
            scrollEventThrottle={16}
          >
            <View style={{ padding: 20 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text.dark }}>
                  All Reminders
                </Text>
                <IconButton
                  icon="close"
                  size={24}
                  onPress={() => setViewAllRemindersModalVisible(false)}
                  style={{ margin: 0 }}
                />
              </View>

              {/* Senior Selection */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: 8 }}>
                  Select Senior
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {linkedSeniors.map((senior) => (
                    <Chip
                      key={senior.userId}
                      selected={selectedSeniorForReminders?.userId === senior.userId}
                      onPress={() => handleSeniorSelectForReminders(senior)}
                      style={{
                        backgroundColor: selectedSeniorForReminders?.userId === senior.userId ? colors.primary : colors.background.lighter
                      }}
                      textStyle={{
                        color: selectedSeniorForReminders?.userId === senior.userId ? colors.white : colors.text.primary
                      }}
                    >
                      {senior.name || senior.fullName || 'Unknown'}
                    </Chip>
                  ))}
                </View>
              </View>

              {/* Loading Indicator */}
              {loadingAllReminders ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ marginTop: 12, color: colors.text.muted }}>{translations.loadingReminders || 'Loading reminders...'}</Text>
                </View>
              ) : allReminders.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <MaterialIcons name="notifications-off" size={48} color={colors.border.light} />
                  <Text style={{ marginTop: 12, color: colors.text.muted }}>{translations.noRemindersFound || 'No reminders found'}</Text>
                </View>
              ) : (
                <View>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                    Showing {allReminders.length} reminder{allReminders.length !== 1 ? 's' : ''}
                  </Text>
                  {allReminders.slice(0, displayCountReminders).map((reminder, index) => {
                    const statusStyle = getReminderStatusStyle(reminder.status);
                    const isPast = (() => {
                      const d = toDate(reminder.scheduledTime);
                      return d ? d < new Date() : false;
                    })();
                    
                    return (
                      <Card key={reminder.reminderId || `reminder-${index}`} style={{ marginBottom: 12, backgroundColor: colors.white }}>
                        <Card.Content style={{ paddingVertical: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.dark, marginBottom: 4 }}>
                                {reminder.title}
                              </Text>
                              <Text style={{ fontSize: 14, color: colors.text.muted, marginBottom: 4 }}>
                                {formatReminderDateTime(reminder.scheduledTime)}
                              </Text>
                              <Text style={{ fontSize: 12, color: colors.text.muted }}>
                                {reminderTypes.find(t => t.value === reminder.type)?.label || 'General'}
                              </Text>
                              {reminder.description && (
                                <Text style={{ fontSize: 12, color: colors.text.muted, marginTop: 4 }} numberOfLines={2}>
                                  {reminder.description}
                                </Text>
                              )}
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Chip
                                mode="flat"
                                style={{ 
                                  backgroundColor: statusStyle.bg,
                                  marginBottom: 4
                                }}
                                textStyle={{ 
                                  color: statusStyle.text, 
                                  fontSize: 11, 
                                  fontWeight: '600'
                                }}
                                compact
                              >
                                {reminder.status === 'completed' ? '✓ Completed' : 'Pending'}
                              </Chip>
                              {isPast && reminder.status !== 'completed' && (
                                <Chip
                                  mode="flat"
                                  style={{ 
                                    backgroundColor: '#fef2f2'
                                  }}
                                  textStyle={{ 
                                    color: '#dc2626', 
                                    fontSize: 10
                                  }}
                                  compact
                                >
                                  Overdue
                                </Chip>
                              )}
                            </View>
                          </View>
                        </Card.Content>
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      <FamilyBottomNav />
    </SafeAreaView>
  );
}
