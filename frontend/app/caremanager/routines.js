import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState, useRef } from 'react';
import { ScrollView, StatusBar, Text, TouchableOpacity, View, RefreshControl, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, Button, Portal, Modal, TextInput, IconButton, Checkbox } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import CareManagerBottomNav from '../../components/CareManagerBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import '../../global.css';
import { translations as translationData, loadLanguage } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { 
  listenToAssignedSeniorIds,
  listenToRoutinesForAssignedSeniors,
  listenToRemindersForAssignedSeniors
} from '../../firestore/caremanagerFirestore';
import { getUserProfile } from '../../firestore/sharedFirestore';
import {
  createRoutine,
  createReminder,
  deleteRoutine,
  deleteReminder,
  updateRoutine,
  updateReminder
} from '../../firestore/seniorFirestore';

const daysOfWeek = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' }
];

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
  { label: 'Health Check', value: 'health-check' },
  { label: 'Follow-up', value: 'follow-up' },
  { label: 'Other', value: 'other' }
];

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
    'health-check': 'favorite',
    'follow-up': 'done-all',
    other: 'notifications-active'
  };
  return iconMap[type] || 'notifications';
};

const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return { bg: '#dcfce7', text: '#166534' };
    case 'missed': return { bg: '#fecaca', text: '#991b1b' };
    default: return { bg: '#fef3c7', text: '#92400e' };
  }
};

const getCardBg = (status) => {
  if (status === 'completed') return '#f0f9f4';
  if (status === 'missed') return '#fef2f2';
  return '#ffffff';
};

const getIconBg = (status) => {
  if (status === 'completed') return '#dcfce7';
  if (status === 'missed') return '#fee2e2';
  return '#fef9f0';
};

const getStatusEmoji = (status) => {
  if (status === 'completed') return '✓ Done';
  if (status === 'missed') return '✗ Missed';
  return '○ Pending';
};

export default function CareManagerRoutinesScreen() {
  const { user } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const translations = translationData[currentLanguage];
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedSeniorId, setSelectedSeniorId] = useState('all');
  const [routines, setRoutines] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [assignedSeniorIds, setAssignedSeniorIds] = useState([]);
  const [assignedSeniors, setAssignedSeniors] = useState([]);
  const [menuVisible, setMenuVisible] = useState(null);
  const [itemMenuVisible, setItemMenuVisible] = useState(null);
  const [itemListType, setItemListType] = useState('routines'); // 'routines' or 'reminders'
  
  // Routine Modal States
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [routineFormSeniorId, setRoutineFormSeniorId] = useState('');
  const [routineFormTitle, setRoutineFormTitle] = useState('');
  const [routineFormType, setRoutineFormType] = useState('medication');
  const [routineFormTime, setRoutineFormTime] = useState(new Date());
  const [showRoutineTimePicker, setShowRoutineTimePicker] = useState(false);
  const [routineFormDays, setRoutineFormDays] = useState([]);
  const [routineFormNotes, setRoutineFormNotes] = useState('');
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [routineTypeMenuVisible, setRoutineTypeMenuVisible] = useState(false);
  const [routineSeniorMenuVisible, setRoutineSeniorMenuVisible] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState(null); // For tracking edit mode
  
  // Reminder Modal States
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderFormSeniorId, setReminderFormSeniorId] = useState('');
  const [reminderFormTitle, setReminderFormTitle] = useState('');
  const [reminderFormType, setReminderFormType] = useState('general');
  const [reminderFormDateTime, setReminderFormDateTime] = useState(new Date());
  const [showReminderDatePicker, setShowReminderDatePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [reminderFormDescription, setReminderFormDescription] = useState('');
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderTypeMenuVisible, setReminderTypeMenuVisible] = useState(false);
  const [reminderSeniorMenuVisible, setReminderSeniorMenuVisible] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState(null); // For tracking edit mode
  
  // Details Modal States
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemType, setSelectedItemType] = useState(null); // 'routine' or 'reminder'
  
  const isMounted = useRef(true);

  const handleEditRoutine = (routine) => {
    setEditingRoutineId(routine.id);
    setRoutineFormSeniorId(routine.userId);
    setRoutineFormTitle(routine.title);
    setRoutineFormType(routine.type);
    
    if (routine.scheduledTime) {
      const date = routine.scheduledTime.toDate ? routine.scheduledTime.toDate() : new Date(routine.scheduledTime);
      setRoutineFormTime(date);
    } else {
      setRoutineFormTime(new Date());
    }

    if (routine.frequency === 'daily') {
      setRoutineFormDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
    } else if (routine.frequency) {
      try {
        const days = JSON.parse(routine.frequency);
        setRoutineFormDays(Array.isArray(days) ? days : []);
      } catch (e) {
        setRoutineFormDays([]);
      }
    } else {
      setRoutineFormDays([]);
    }

    setRoutineFormNotes(routine.notes || '');
    setItemMenuVisible(null);
    setRoutineModalVisible(true);
  };

  const handleDeleteRoutine = (routineId) => {
    Alert.alert(
      'Delete Routine',
      'Are you sure you want to delete this routine?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              const result = await deleteRoutine(routineId);
              if (result.success) {
                setItemMenuVisible(null);
                Alert.alert('Success', 'Routine deleted successfully');
              } else {
                Alert.alert('Error', result.error || 'Failed to delete routine');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete routine');
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  const handleEditReminder = (reminder) => {
    const reminderId = reminder.reminderId || reminder.id;
    setEditingReminderId(reminderId);
    setReminderFormSeniorId(reminder.userId);
    setReminderFormTitle(reminder.title);
    setReminderFormType(reminder.type);
    setReminderFormDescription(reminder.description || '');
    
    if (reminder.scheduledTime) {
      const date = reminder.scheduledTime.toDate ? reminder.scheduledTime.toDate() : new Date(reminder.scheduledTime);
      setReminderFormDateTime(date);
    } else {
      setReminderFormDateTime(new Date());
    }

    setItemMenuVisible(null);
    setReminderModalVisible(true);
  };

  const handleDeleteReminder = (reminderId) => {
    Alert.alert(
      'Delete Reminder',
      'Are you sure you want to delete this reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              const result = await deleteReminder(reminderId);
              if (result.success) {
                setItemMenuVisible(null);
                Alert.alert('Success', 'Reminder deleted successfully');
              } else {
                Alert.alert('Error', result.error || 'Failed to delete reminder');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete reminder');
            }
          },
          style: 'destructive'
        }
      ]
    );
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

    const unsubscribe = listenToAssignedSeniorIds(user.uid, async (seniorIds) => {
      if (seniorIds.length === 0) {
        setAssignedSeniorIds([]);
        setAssignedSeniors([]);
        return;
      }

      setAssignedSeniorIds(seniorIds);
      
      // Fetch each senior's profile
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

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      setShowRoutineTimePicker(false);
      setShowReminderDatePicker(false);
      setShowReminderTimePicker(false);
    };
  }, []);

  // Listen to routines and reminders
  useEffect(() => {
    if (!user?.uid || assignedSeniorIds.length === 0) return;

    const unsubscribeRoutines = listenToRoutinesForAssignedSeniors(assignedSeniorIds, (routinesList) => {
      setRoutines(routinesList);
      setRefreshing(false);
    });
    
    const unsubscribeReminders = listenToRemindersForAssignedSeniors(assignedSeniorIds, (remindersList) => {
      setReminders(remindersList);
    });

    return () => {
      if (unsubscribeRoutines) unsubscribeRoutines();
      if (unsubscribeReminders) unsubscribeReminders();
    };
  }, [user?.uid, assignedSeniorIds]);

  const onRefresh = () => {
    setRefreshing(true);
    // Listener will auto-refresh
    setTimeout(() => setRefreshing(false), 1000);
  };

  const filterItems = (items) => {
    let filtered = items;

    if (selectedSeniorId !== 'all') {
      filtered = filtered.filter(item => item.userId === selectedSeniorId);
    }

    if (selectedFilter !== 'all') {
      filtered = filtered.filter(item => item.status === selectedFilter);
    }

    return filtered;
  };

  const filteredRoutines = filterItems(routines);
  const filteredReminders = filterItems(reminders);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Routine Handlers
  const handleOpenRoutineModal = () => {
    if (assignedSeniors.length === 0) {
      Alert.alert('No Seniors', 'You have no assigned seniors to create routines for.');
      return;
    }
    setEditingRoutineId(null);
    setRoutineFormSeniorId(assignedSeniors[0].userId);
    setRoutineFormTitle('');
    setRoutineFormType('medication');
    setRoutineFormTime(new Date());
    setRoutineFormDays([]);
    setRoutineFormNotes('');
    setRoutineModalVisible(true);
  };

  const handleCloseRoutineModal = () => {
    setRoutineModalVisible(false);
    setEditingRoutineId(null);
    setRoutineFormSeniorId('');
    setRoutineFormTitle('');
    setRoutineFormType('medication');
    setRoutineFormTime(new Date());
    setRoutineFormDays([]);
    setRoutineFormNotes('');
  };

  const handleSaveRoutine = async () => {
    if (!routineFormTitle.trim()) {
      Alert.alert('Error', 'Please enter a routine title');
      return;
    }
    if (!routineFormSeniorId) {
      Alert.alert('Error', 'Please select a senior');
      return;
    }
    if (routineFormDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day');
      return;
    }

    setSavingRoutine(true);
    try {
      const selectedSenior = assignedSeniors.find(s => s.userId === routineFormSeniorId);
      const frequency = routineFormDays.length === 7 ? 'daily' : JSON.stringify(routineFormDays);
      
      const routineData = {
        userId: routineFormSeniorId,
        seniorName: selectedSenior?.name || 'Senior',
        title: routineFormTitle.trim(),
        type: routineFormType,
        scheduledTime: routineFormTime,
        frequency: frequency,
        notes: routineFormNotes.trim(),
        createdBy: user.uid
      };

      if (editingRoutineId) {
        // Update existing routine
        const result = await updateRoutine(editingRoutineId, routineData);
        if (result.success) {
          Alert.alert('Success', 'Routine updated successfully');
          setRoutineModalVisible(false);
          setEditingRoutineId(null);
        } else {
          Alert.alert('Error', result.error || 'Failed to update routine');
        }
      } else {
        // Create new routine
        const result = await createRoutine(routineData);
        if (result.success) {
          Alert.alert('Success', 'Routine created successfully');
          setRoutineModalVisible(false);
        } else {
          Alert.alert('Error', result.error || 'Failed to create routine');
        }
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to save routine');
    } finally {
      setSavingRoutine(false);
    }
  };

  const toggleRoutineDay = (day) => {
    setRoutineFormDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const selectAllDays = () => {
    setRoutineFormDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  };

  const onRoutineTimeChange = (event, selectedTime) => {
    if (!isMounted.current) return;
    
    if (Platform.OS === 'android') {
      setTimeout(() => {
        if (isMounted.current) setShowRoutineTimePicker(false);
      }, 100);
      
      if (event?.type === 'set' && selectedTime) {
        setRoutineFormTime(selectedTime);
      }
    } else {
      if (selectedTime) setRoutineFormTime(selectedTime);
    }
  };

  // Reminder Handlers
  const handleOpenReminderModal = () => {
    if (assignedSeniors.length === 0) {
      Alert.alert('No Seniors', 'You have no assigned seniors to create reminders for.');
      return;
    }
    setEditingReminderId(null);
    setReminderFormSeniorId(assignedSeniors[0].userId);
    setReminderFormTitle('');
    setReminderFormType('general');
    setReminderFormDateTime(new Date());
    setReminderFormDescription('');
    setReminderModalVisible(true);
  };

  const handleCloseReminderModal = () => {
    setReminderModalVisible(false);
    setEditingReminderId(null);
    setReminderFormSeniorId('');
    setReminderFormTitle('');
    setReminderFormType('general');
    setReminderFormDateTime(new Date());
    setReminderFormDescription('');
  };

  const handleSaveReminder = async () => {
    if (!reminderFormTitle.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }
    if (!reminderFormSeniorId) {
      Alert.alert('Error', 'Please select a senior');
      return;
    }

    setSavingReminder(true);
    try {
      const selectedSenior = assignedSeniors.find(s => s.userId === reminderFormSeniorId);
      
      const reminderData = {
        userId: reminderFormSeniorId,
        seniorName: selectedSenior?.name || 'Senior',
        title: reminderFormTitle.trim(),
        type: reminderFormType,
        scheduledTime: reminderFormDateTime,
        description: reminderFormDescription.trim(),
        createdBy: user.uid,
        createdByName: 'Care Manager'
      };

      if (editingReminderId) {
        // Update existing reminder
        const result = await updateReminder(editingReminderId, reminderData);
        if (result.success) {
          Alert.alert('Success', 'Reminder updated successfully');
          setReminderModalVisible(false);
          setEditingReminderId(null);
        } else {
          Alert.alert('Error', result.error || 'Failed to update reminder');
        }
      } else {
        // Create new reminder
        const result = await createReminder(reminderData);
        if (result.success) {
          Alert.alert('Success', 'Reminder created successfully');
          setReminderModalVisible(false);
        } else {
          Alert.alert('Error', result.error || 'Failed to create reminder');
        }
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to save reminder');
    } finally {
      setSavingReminder(false);
    }
  };

  const onReminderDateTimeChange = (event, selectedDate) => {
    if (!isMounted.current) return;
    
    if (Platform.OS === 'android') {
      setTimeout(() => {
        if (isMounted.current) {
          setShowReminderDatePicker(false);
          if (event?.type === 'set' && selectedDate) {
            setShowReminderTimePicker(true);
          }
        }
      }, 100);
      
      if (event?.type === 'set' && selectedDate) {
        setReminderFormDateTime(selectedDate);
      }
    } else {
      if (selectedDate) setReminderFormDateTime(selectedDate);
    }
  };

  const onReminderTimeChange = (event, selectedTime) => {
    if (!isMounted.current) return;
    
    if (Platform.OS === 'android') {
      setTimeout(() => {
        if (isMounted.current) setShowReminderTimePicker(false);
      }, 100);
      
      if (event?.type === 'set' && selectedTime) {
        const updatedDateTime = new Date(reminderFormDateTime);
        updatedDateTime.setHours(selectedTime.getHours());
        updatedDateTime.setMinutes(selectedTime.getMinutes());
        setReminderFormDateTime(updatedDateTime);
      }
    } else {
      if (selectedTime) {
        const updatedDateTime = new Date(reminderFormDateTime);
        updatedDateTime.setHours(selectedTime.getHours());
        updatedDateTime.setMinutes(selectedTime.getMinutes());
        setReminderFormDateTime(updatedDateTime);
      }
    }
  };

  // Details Modal Handlers
  const handleOpenDetails = (item, type) => {
    setSelectedItem(item);
    setSelectedItemType(type);
    setDetailsModalVisible(true);
  };

  const formatDays = (frequency) => {
    if (frequency === 'daily') return 'Daily';
    try {
      const days = JSON.parse(frequency);
      if (Array.isArray(days)) {
        return days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
      }
    } catch (_err) {
      return frequency;
    }
    return frequency;
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f6f7f8" />

      {/* Header */}
      <View className="bg-white">
        <View className="px-4 py-3 flex-row justify-between items-center gap-3">
          <View className="flex-1">
            <CloverCareNavbar 
              showLogo={true}
              logoSize={36}
              backgroundColor="transparent"
              showBackButton={false}
              appName="Clover Care"
            />
          </View>
        </View>
      </View>

      <View className="px-4 pt-4 pb-4">
        {/* Controls Section */}
        <View className="gap-3">
          {/* Senior Selector Dropdown */}
          <View>
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
              <MaterialIcons name="expand-more" size={22} color="#475569" />
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

          {/* Status Filters */}
          <View>
            <Text className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Filter by Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {[
                  { value: 'all', emoji: '📋' },
                  { value: 'completed', emoji: '✓' },
                  { value: 'pending', emoji: '○' },
                  { value: 'missed', emoji: '✗' }
                ].map((filter) => {
                  const isSelected = selectedFilter === filter.value;
                  const getFilterColor = () => {
                    if (!isSelected) return { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' };
                    if (filter.value === 'completed') return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
                    if (filter.value === 'missed') return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
                    if (filter.value === 'pending') return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
                    return { bg: '#f0f4f7', text: '#5B718A', border: '#cbd5e1' };
                  };
                  const colors = getFilterColor();
                  
                  return (
                    <TouchableOpacity
                      key={filter.value}
                      onPress={() => setSelectedFilter(filter.value)}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: colors.bg,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: isSelected ? 1.5 : 1,
                        borderColor: colors.border,
                        flexDirection: 'row',
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ fontSize: 13, marginRight: 4 }}>{filter.emoji}</Text>
                      <Text style={{ 
                        color: colors.text, 
                        fontSize: 13, 
                        fontWeight: isSelected ? '600' : '500',
                        textTransform: 'capitalize'
                      }}>
                        {filter.value}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Items Dropdown - toggle between routines & reminders */}
          <View>
            <Text className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">View</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Routines Button */}
              <TouchableOpacity
                onPress={() => setItemListType('routines')}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  borderWidth: 1.5,
                  borderColor: itemListType === 'routines' ? '#5B718A' : '#e5e7eb',
                  backgroundColor: itemListType === 'routines' ? '#f0f4f7' : 'white',
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1
                }}
              >
                <MaterialIcons
                  name="schedule"
                  size={20}
                  color={itemListType === 'routines' ? '#5B718A' : '#6b7280'}
                  style={{ marginRight: 8 }}
                />
                <View>
                  <Text style={{
                    color: itemListType === 'routines' ? '#111827' : '#6b7280',
                    fontWeight: itemListType === 'routines' ? '600' : '500',
                    fontSize: 13
                  }}>
                    Routines
                  </Text>
                  <Text style={{
                    color: itemListType === 'routines' ? '#5B718A' : '#9ca3af',
                    fontSize: 10,
                    marginTop: 2
                  }}>
                    {filteredRoutines.length} items
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Reminders Button */}
              <TouchableOpacity
                onPress={() => setItemListType('reminders')}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  borderWidth: 1.5,
                  borderColor: itemListType === 'reminders' ? '#F7BC20' : '#e5e7eb',
                  backgroundColor: itemListType === 'reminders' ? '#fef9f0' : 'white',
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1
                }}
              >
                <MaterialIcons
                  name="notifications-active"
                  size={20}
                  color={itemListType === 'reminders' ? '#F7BC20' : '#6b7280'}
                  style={{ marginRight: 8 }}
                />
                <View>
                  <Text style={{
                    color: itemListType === 'reminders' ? '#111827' : '#6b7280',
                    fontWeight: itemListType === 'reminders' ? '600' : '500',
                    fontSize: 13
                  }}>
                    Reminders
                  </Text>
                  <Text style={{
                    color: itemListType === 'reminders' ? '#F7BC20' : '#9ca3af',
                    fontSize: 10,
                    marginTop: 2
                  }}>
                    {filteredReminders.length} items
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pb-20"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {itemListType === 'routines' ? (
          // Show routines only
          filteredRoutines.length > 0 ? (
            <View className="mb-6">
              {filteredRoutines.map((routine) => {
                const statusColor = getStatusColor(routine.status);
                const senior = assignedSeniors.find(s => s.userId === routine.userId);
                
                return (
                  <TouchableOpacity
                    key={routine.id}
                    onPress={() => handleOpenDetails(routine, 'routine')}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: getCardBg(routine.status),
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: routine.status === 'completed' ? '#bbf7d0' : routine.status === 'missed' ? '#fecaca' : '#e5e7eb',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 3,
                      elevation: 1
                    }}
                  >
                    <View className="flex-row items-center">
                      {/* Compact Icon Circle */}
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: routine.status === 'completed' ? '#dcfce7' : routine.status === 'missed' ? '#fee2e2' : '#f0f4f7',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10
                      }}>
                        <MaterialIcons name="schedule" size={20} color="#5B718A" />
                      </View>
                      
                      {/* Content */}
                      <View className="flex-1">
                        {/* Title and Status Badge */}
                        <View className="flex-row items-center justify-between mb-1">
                          <Text className="text-sm font-bold text-gray-900 flex-1" numberOfLines={1} style={{ marginRight: 8 }}>
                            {routine.title}
                          </Text>
                          <View style={{
                            backgroundColor: statusColor.bg,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 10,
                            marginRight: 8
                          }}>
                            <Text style={{ color: statusColor.text, fontSize: 10, fontWeight: '600' }}>
                              {getStatusEmoji(routine.status)}
                            </Text>
                          </View>
                          {/* Three Dot Menu */}
                          <TouchableOpacity
                            onPress={() => setItemMenuVisible(prev => prev === routine.id ? null : routine.id)}
                            style={{ padding: 4 }}
                          >
                            <MaterialIcons name="more-vert" size={20} color="#6b7280" />
                          </TouchableOpacity>
                        </View>
                        
                        {/* Menu Dropdown */}
                        {itemMenuVisible === routine.id && (
                          <View style={{
                            backgroundColor: 'white',
                            borderWidth: 1,
                            borderColor: '#e5e7eb',
                            borderRadius: 8,
                            overflow: 'hidden',
                            marginBottom: 8,
                            elevation: 3
                          }}>
                            <TouchableOpacity
                              onPress={() => handleEditRoutine(routine)}
                              style={{ padding: 10, flexDirection: 'row', alignItems: 'center' }}
                            >
                              <MaterialIcons name="edit" size={18} color="#5B718A" style={{ marginRight: 8 }} />
                              <Text style={{ color: '#111827', fontSize: 13, fontWeight: '500' }}>Edit</Text>
                            </TouchableOpacity>
                            <View style={{ height: 1, backgroundColor: '#f3f4f6' }} />
                            <TouchableOpacity
                              onPress={() => handleDeleteRoutine(routine.id)}
                              style={{ padding: 10, flexDirection: 'row', alignItems: 'center' }}
                            >
                              <MaterialIcons name="delete" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                              <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '500' }}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        
                        {/* Info Row - Compact */}
                        <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
                          {/* Senior Name */}
                          <View className="flex-row items-center">
                            <MaterialIcons name="person" size={12} color="#8DAAA5" />
                            <Text className="text-xs text-gray-600 ml-1" numberOfLines={1}>
                              {senior?.name || 'Unknown'}
                            </Text>
                          </View>
                          
                          {/* Time */}
                          <View className="flex-row items-center">
                            <MaterialIcons name="access-time" size={12} color="#5B718A" />
                            <Text className="text-xs text-gray-600 ml-1 font-medium">
                              {formatTime(routine.scheduledTime)}
                            </Text>
                          </View>
                          
                          {/* Type */}
                          <View style={{
                            backgroundColor: '#f0f7f6',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6
                          }}>
                            <Text className="text-xs text-gray-700 font-medium capitalize" style={{ fontSize: 10 }}>
                              {routine.type || 'General'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center py-20">
              <MaterialIcons name="event-note" size={64} color="#94a3b8" />
              <Text className="text-xl font-bold text-gray-900 mb-2 mt-4">{translations.noRoutinesFound || 'No Routines Found'}</Text>
              <Text className="text-sm text-gray-600 text-center px-8">
                {selectedSeniorId === 'all' 
                  ? 'No routines have been set up for your assigned seniors yet.' 
                  : 'No routines found for this senior.'}
              </Text>
              <Text className="text-xs text-gray-500 text-center px-8 mt-2">
                Use the buttons below to create routines and reminders
              </Text>
            </View>
          )
        ) : (
          // Show reminders only
          filteredReminders.length > 0 ? (
            <View className="mb-6">
              {filteredReminders.map((reminder) => {
                const statusColor = getStatusColor(reminder.status);
                const senior = assignedSeniors.find(s => s.userId === reminder.userId);
                
                return (
                  <TouchableOpacity
                    key={reminder.reminderId || reminder.id}
                    onPress={() => handleOpenDetails(reminder, 'reminder')}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: getCardBg(reminder.status),
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: reminder.status === 'completed' ? '#bbf7d0' : reminder.status === 'missed' ? '#fecaca' : '#e5e7eb',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 3,
                      elevation: 1
                    }}
                  >
                    <View className="flex-row items-center">
                      {/* Compact Icon Circle */}
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: getIconBg(reminder.status),
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10
                      }}>
                        <MaterialIcons name="notifications-active" size={20} color="#F7BC20" />
                      </View>
                      
                      {/* Content */}
                      <View className="flex-1">
                        {/* Title and Status Badge */}
                        <View className="flex-row items-center justify-between mb-1">
                          <Text className="text-sm font-bold text-gray-900 flex-1" numberOfLines={1} style={{ marginRight: 8 }}>
                            {reminder.title}
                          </Text>
                          <View style={{
                            backgroundColor: statusColor.bg,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 10,
                            marginRight: 8
                          }}>
                            <Text style={{ color: statusColor.text, fontSize: 10, fontWeight: '600' }}>
                              {getStatusEmoji(reminder.status)}
                            </Text>
                          </View>
                          {/* Three Dot Menu */}
                          <TouchableOpacity
                            onPress={() => setItemMenuVisible(prev => prev === (reminder.reminderId || reminder.id) ? null : (reminder.reminderId || reminder.id))}
                            style={{ padding: 4 }}
                          >
                            <MaterialIcons name="more-vert" size={20} color="#6b7280" />
                          </TouchableOpacity>
                        </View>
                        
                        {/* Menu Dropdown */}
                        {itemMenuVisible === (reminder.reminderId || reminder.id) && (
                          <View style={{
                            backgroundColor: 'white',
                            borderWidth: 1,
                            borderColor: '#e5e7eb',
                            borderRadius: 8,
                            overflow: 'hidden',
                            marginBottom: 8,
                            elevation: 3
                          }}>
                            <TouchableOpacity
                              onPress={() => handleEditReminder(reminder)}
                              style={{ padding: 10, flexDirection: 'row', alignItems: 'center' }}
                            >
                              <MaterialIcons name="edit" size={18} color="#F7BC20" style={{ marginRight: 8 }} />
                              <Text style={{ color: '#111827', fontSize: 13, fontWeight: '500' }}>Edit</Text>
                            </TouchableOpacity>
                            <View style={{ height: 1, backgroundColor: '#f3f4f6' }} />
                            <TouchableOpacity
                              onPress={() => handleDeleteReminder(reminder.reminderId || reminder.id)}
                              style={{ padding: 10, flexDirection: 'row', alignItems: 'center' }}
                            >
                              <MaterialIcons name="delete" size={18} color="#dc2626" style={{ marginRight: 8 }} />
                              <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '500' }}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        
                        {/* Info Row - Compact */}
                        <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
                          {/* Senior Name */}
                          <View className="flex-row items-center">
                            <MaterialIcons name="person" size={12} color="#8DAAA5" />
                            <Text className="text-xs text-gray-600 ml-1" numberOfLines={1}>
                              {senior?.name || 'Unknown'}
                            </Text>
                          </View>
                          
                          {/* DateTime */}
                          <View className="flex-row items-center">
                            <MaterialIcons name="event" size={12} color="#5B718A" />
                            <Text className="text-xs text-gray-600 ml-1 font-medium">
                              {formatDateTime(reminder.scheduledTime)}
                            </Text>
                          </View>
                          
                          {/* Type */}
                          <View style={{
                            backgroundColor: '#fef9f0',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6
                          }}>
                            <Text className="text-xs text-gray-700 font-medium capitalize" style={{ fontSize: 10 }}>
                              {reminder.type || 'General'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center py-20">
              <MaterialIcons name="event-note" size={64} color="#94a3b8" />
              <Text className="text-xl font-bold text-gray-900 mb-2 mt-4">{translations.noRemindersFoundText || 'No Reminders Found'}</Text>
              <Text className="text-sm text-gray-600 text-center px-8">
                {selectedSeniorId === 'all' 
                  ? 'No reminders have been set up for your assigned seniors yet.' 
                  : 'No reminders found for this senior.'}
              </Text>
              <Text className="text-xs text-gray-500 text-center px-8 mt-2">
                Use the buttons below to create reminders and routines
              </Text>
            </View>
          )
        )}

        <View className="h-24" />
      </ScrollView>

      {/* Floating Action Buttons */}
      <View className="absolute right-5 bottom-24" style={{ gap: 12 }}>
        {/* Create Reminder Button - Only show when reminders tab is active */}
        {itemListType === 'reminders' && (
          <TouchableOpacity
            onPress={handleOpenReminderModal}
            style={{ 
              backgroundColor: '#F7BC20',
              borderRadius: 16, 
              padding: 16, 
              flexDirection: 'row', 
              alignItems: 'center',
              elevation: 6, 
              shadowColor: '#000', 
              shadowOffset: { width: 0, height: 4 }, 
              shadowOpacity: 0.3, 
              shadowRadius: 8 
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons name="notifications-active" size={24} color="#ffffff" />
            <Text className="text-white font-bold ml-2 text-sm">{translations.addReminder || 'Add Reminder'}</Text>
          </TouchableOpacity>
        )}

        {/* Create Routine Button - Only show when routines tab is active */}
        {itemListType === 'routines' && (
          <TouchableOpacity
            onPress={handleOpenRoutineModal}
            style={{ 
              backgroundColor: '#5B718A',
              borderRadius: 16, 
              padding: 16, 
              flexDirection: 'row', 
              alignItems: 'center',
              elevation: 6, 
              shadowColor: '#000', 
              shadowOffset: { width: 0, height: 4 }, 
              shadowOpacity: 0.3, 
              shadowRadius: 8 
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add-circle" size={24} color="#ffffff" />
            <Text className="text-white font-bold ml-2 text-sm">{translations.addRoutine || 'Add Routine'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Create Routine Modal */}
      <Portal>
        <Modal
          visible={routineModalVisible}
          onDismiss={handleCloseRoutineModal}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827' }}>
                {editingRoutineId ? 'Edit Routine' : 'Create Routine'}
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={handleCloseRoutineModal}
                style={{ margin: 0 }}
              />
            </View>

            {/* Senior Selection */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Senior *
              </Text>
              <TouchableOpacity 
                onPress={() => setRoutineSeniorMenuVisible(!routineSeniorMenuVisible)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'white',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="person" size={20} color="#5B718A" />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827', marginLeft: 8 }}>
                    {assignedSeniors.find(s => s.userId === routineFormSeniorId)?.name || 'Select Senior'}
                  </Text>
                </View>
                <MaterialIcons 
                  name={routineSeniorMenuVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                  size={24} 
                  color="#9ca3af" 
                />
              </TouchableOpacity>

              {routineSeniorMenuVisible && (
                <View style={{
                  marginTop: 8,
                  backgroundColor: 'white',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 12,
                  overflow: 'hidden',
                  elevation: 2,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4
                }}>
                  {assignedSeniors.map((senior, index) => (
                    <TouchableOpacity
                      key={senior.userId}
                      onPress={() => {
                        setRoutineFormSeniorId(senior.userId);
                        setRoutineSeniorMenuVisible(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: index !== assignedSeniors.length - 1 ? 1 : 0,
                        borderBottomColor: '#f3f4f6'
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons 
                        name="person" 
                        size={18} 
                        color={routineFormSeniorId === senior.userId ? '#5B718A' : '#9ca3af'} 
                      />
                      <Text style={{
                        flex: 1,
                        fontSize: 14,
                        marginLeft: 12,
                        color: routineFormSeniorId === senior.userId ? '#5B718A' : '#111827',
                        fontWeight: routineFormSeniorId === senior.userId ? '600' : '500'
                      }}>
                        {senior.name}
                      </Text>
                      {routineFormSeniorId === senior.userId && (
                        <MaterialIcons name="check" size={18} color="#5B718A" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <TextInput
              label="Routine Title *"
              value={routineFormTitle}
              onChangeText={setRoutineFormTitle}
              mode="outlined"
              placeholder="e.g., Morning Medication"
              style={{ marginBottom: 12 }}
              outlineColor="#e5e7eb"
              activeOutlineColor="#5B718A"
            />

            {/* Type Dropdown */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Routine Type
              </Text>
              <TouchableOpacity 
                onPress={() => setRoutineTypeMenuVisible(!routineTypeMenuVisible)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'white',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons 
                    name={getIconForRoutineType(routineFormType)} 
                    size={20} 
                    color="#5B718A" 
                  />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827', marginLeft: 8 }}>
                    {routineTypes.find(t => t.value === routineFormType)?.label || 'Select Type'}
                  </Text>
                </View>
                <MaterialIcons 
                  name={routineTypeMenuVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                  size={24} 
                  color="#9ca3af" 
                />
              </TouchableOpacity>

              {routineTypeMenuVisible && (
                <View style={{
                  marginTop: 8,
                  backgroundColor: 'white',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 12,
                  overflow: 'hidden',
                  elevation: 2,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4
                }}>
                  {routineTypes.map((type, index) => (
                    <TouchableOpacity
                      key={type.value}
                      onPress={() => {
                        setRoutineFormType(type.value);
                        setRoutineTypeMenuVisible(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: index !== routineTypes.length - 1 ? 1 : 0,
                        borderBottomColor: '#f3f4f6'
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons 
                        name={getIconForRoutineType(type.value)} 
                        size={18} 
                        color={routineFormType === type.value ? '#5B718A' : '#9ca3af'} 
                      />
                      <Text style={{
                        flex: 1,
                        fontSize: 14,
                        marginLeft: 12,
                        color: routineFormType === type.value ? '#5B718A' : '#111827',
                        fontWeight: routineFormType === type.value ? '600' : '500'
                      }}>
                        {type.label}
                      </Text>
                      {routineFormType === type.value && (
                        <MaterialIcons name="check" size={18} color="#5B718A" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Time Picker */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Time *
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setShowRoutineTimePicker(true);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'white',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="schedule" size={20} color="#5B718A" />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827', marginLeft: 8 }}>
                    {routineFormTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </Text>
                </View>
                <MaterialIcons name="edit" size={18} color="#9ca3af" />
              </TouchableOpacity>
              
              {Platform.OS === 'ios' && showRoutineTimePicker && (
                <View style={{ marginTop: 12, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12 }}>
                  <DateTimePicker
                    value={routineFormTime}
                    mode="time"
                    is24Hour={false}
                    display="spinner"
                    onChange={onRoutineTimeChange}
                  />
                  <Button
                    mode="contained"
                    onPress={() => setShowRoutineTimePicker(false)}
                    style={{ marginTop: 8 }}
                    buttonColor="#5B718A"
                  >
                    Done
                  </Button>
                </View>
              )}
              
              {Platform.OS === 'android' && showRoutineTimePicker && isMounted.current && routineModalVisible && (
                <DateTimePicker
                  value={routineFormTime}
                  mode="time"
                  is24Hour={false}
                  display="default"
                  onChange={onRoutineTimeChange}
                  accentColor="#5B718A"
                />
              )}
            </View>

            {/* Day Selection */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Select Days *
                </Text>
                <View style={{ flexDirection: 'row' }}>
                  <Button mode="text" onPress={selectAllDays} compact textColor="#5B718A" style={{ marginHorizontal: 4 }}>
                    All
                  </Button>
                  <Button mode="text" onPress={() => setRoutineFormDays([])} compact textColor="#dc2626" style={{ marginHorizontal: 4 }}>
                    None
                  </Button>
                </View>
              </View>
              
              <View style={{
                backgroundColor: 'white',
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 8,
                overflow: 'hidden'
              }}>
                {daysOfWeek.map((day, index) => (
                  <TouchableOpacity
                    key={day.value}
                    onPress={() => toggleRoutineDay(day.value)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 8,
                      paddingVertical: 10,
                      borderBottomWidth: index !== daysOfWeek.length - 1 ? 1 : 0,
                      borderBottomColor: '#f3f4f6'
                    }}
                  >
                    <Checkbox.Android
                      status={routineFormDays.includes(day.value) ? 'checked' : 'unchecked'}
                      onPress={() => toggleRoutineDay(day.value)}
                      color="#5B718A"
                    />
                    <Text style={{
                      fontSize: 15,
                      color: routineFormDays.includes(day.value) ? '#5B718A' : '#111827',
                      marginLeft: 12,
                      fontWeight: routineFormDays.includes(day.value) ? '600' : '500'
                    }}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {routineFormDays.length > 0 && (
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                  Routine will repeat on: {
                    routineFormDays.length === 7 
                      ? 'Every day' 
                      : routineFormDays.map(d => 
                          daysOfWeek.find(day => day.value === d)?.label.slice(0, 3)
                        ).join(', ')
                  }
                </Text>
              )}
            </View>

            {/* Notes Field */}
            <TextInput
              label="Notes"
              value={routineFormNotes}
              onChangeText={setRoutineFormNotes}
              mode="outlined"
              placeholder="Additional instructions..."
              multiline
              numberOfLines={3}
              style={{ marginBottom: 16 }}
              outlineColor="#e5e7eb"
              activeOutlineColor="#5B718A"
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button
                mode="outlined"
                onPress={handleCloseRoutineModal}
                disabled={savingRoutine}
                style={{ marginRight: 8 }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveRoutine}
                loading={savingRoutine}
                disabled={savingRoutine}
                buttonColor="#5B718A"
              >
                Create
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Create Reminder Modal */}
      <Portal>
        <Modal
          visible={reminderModalVisible}
          onDismiss={handleCloseReminderModal}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827' }}>
                {editingReminderId ? 'Edit Reminder' : 'Create Reminder'}
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={handleCloseReminderModal}
                style={{ margin: 0 }}
              />
            </View>

            {/* Senior Selection */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Senior *
              </Text>
              <TouchableOpacity 
                onPress={() => setReminderSeniorMenuVisible(!reminderSeniorMenuVisible)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'white',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="person" size={20} color="#F7BC20" />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827', marginLeft: 8 }}>
                    {assignedSeniors.find(s => s.userId === reminderFormSeniorId)?.name || 'Select Senior'}
                  </Text>
                </View>
                <MaterialIcons 
                  name={reminderSeniorMenuVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                  size={24} 
                  color="#9ca3af" 
                />
              </TouchableOpacity>

              {reminderSeniorMenuVisible && (
                <View style={{
                  marginTop: 8,
                  backgroundColor: 'white',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 12,
                  overflow: 'hidden',
                  elevation: 2,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4
                }}>
                  {assignedSeniors.map((senior, index) => (
                    <TouchableOpacity
                      key={senior.userId}
                      onPress={() => {
                        setReminderFormSeniorId(senior.userId);
                        setReminderSeniorMenuVisible(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: index !== assignedSeniors.length - 1 ? 1 : 0,
                        borderBottomColor: '#f3f4f6'
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons 
                        name="person" 
                        size={18} 
                        color={reminderFormSeniorId === senior.userId ? '#F7BC20' : '#9ca3af'} 
                      />
                      <Text style={{
                        flex: 1,
                        fontSize: 14,
                        marginLeft: 12,
                        color: reminderFormSeniorId === senior.userId ? '#F7BC20' : '#111827',
                        fontWeight: reminderFormSeniorId === senior.userId ? '600' : '500'
                      }}>
                        {senior.name}
                      </Text>
                      {reminderFormSeniorId === senior.userId && (
                        <MaterialIcons name="check" size={18} color="#F7BC20" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <TextInput
              label="Reminder Title *"
              value={reminderFormTitle}
              onChangeText={setReminderFormTitle}
              mode="outlined"
              placeholder="e.g., Doctor Appointment"
              style={{ marginBottom: 12 }}
              outlineColor="#e5e7eb"
              activeOutlineColor="#F7BC20"
            />

            {/* Type Dropdown */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Reminder Type
              </Text>
              <TouchableOpacity 
                onPress={() => setReminderTypeMenuVisible(!reminderTypeMenuVisible)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'white',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons 
                    name={getIconForReminderType(reminderFormType)} 
                    size={20} 
                    color="#F7BC20" 
                  />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827', marginLeft: 8 }}>
                    {reminderTypes.find(t => t.value === reminderFormType)?.label || 'Select Type'}
                  </Text>
                </View>
                <MaterialIcons 
                  name={reminderTypeMenuVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                  size={24} 
                  color="#9ca3af" 
                />
              </TouchableOpacity>

              {reminderTypeMenuVisible && (
                <View style={{
                  marginTop: 8,
                  backgroundColor: 'white',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 12,
                  overflow: 'hidden',
                  elevation: 2,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4
                }}>
                  {reminderTypes.map((type, index) => (
                    <TouchableOpacity
                      key={type.value}
                      onPress={() => {
                        setReminderFormType(type.value);
                        setReminderTypeMenuVisible(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: index !== reminderTypes.length - 1 ? 1 : 0,
                        borderBottomColor: '#f3f4f6'
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons 
                        name={getIconForReminderType(type.value)} 
                        size={18} 
                        color={reminderFormType === type.value ? '#F7BC20' : '#9ca3af'} 
                      />
                      <Text style={{
                        flex: 1,
                        fontSize: 14,
                        marginLeft: 12,
                        color: reminderFormType === type.value ? '#F7BC20' : '#111827',
                        fontWeight: reminderFormType === type.value ? '600' : '500'
                      }}>
                        {type.label}
                      </Text>
                      {reminderFormType === type.value && (
                        <MaterialIcons name="check" size={18} color="#F7BC20" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Date & Time Picker */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Date & Time *
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setShowReminderDatePicker(true);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'white',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="event-note" size={20} color="#F7BC20" />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827', marginLeft: 8 }}>
                    {reminderFormDateTime.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                </View>
                <MaterialIcons name="edit" size={18} color="#9ca3af" />
              </TouchableOpacity>
              
              {Platform.OS === 'ios' && showReminderDatePicker && (
                <View style={{ marginTop: 12, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12 }}>
                  <DateTimePicker
                    value={reminderFormDateTime}
                    mode="datetime"
                    is24Hour={false}
                    display="spinner"
                    onChange={onReminderDateTimeChange}
                  />
                  <Button
                    mode="contained"
                    onPress={() => setShowReminderDatePicker(false)}
                    style={{ marginTop: 8 }}
                    buttonColor="#F7BC20"
                  >
                    Done
                  </Button>
                </View>
              )}
              
              {Platform.OS === 'android' && showReminderDatePicker && isMounted.current && reminderModalVisible && (
                <DateTimePicker
                  value={reminderFormDateTime}
                  mode="date"
                  is24Hour={false}
                  display="default"
                  onChange={onReminderDateTimeChange}
                  accentColor="#F7BC20"
                />
              )}
              
              {Platform.OS === 'android' && showReminderTimePicker && isMounted.current && reminderModalVisible && (
                <DateTimePicker
                  value={reminderFormDateTime}
                  mode="time"
                  is24Hour={false}
                  display="default"
                  onChange={onReminderTimeChange}
                  accentColor="#F7BC20"
                />
              )}
            </View>

            {/* Description Field */}
            <TextInput
              label="Description"
              value={reminderFormDescription}
              onChangeText={setReminderFormDescription}
              mode="outlined"
              placeholder="Additional details..."
              multiline
              numberOfLines={3}
              style={{ marginBottom: 16 }}
              outlineColor="#e5e7eb"
              activeOutlineColor="#F7BC20"
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button
                mode="outlined"
                onPress={handleCloseReminderModal}
                disabled={savingReminder}
                style={{ marginRight: 8 }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveReminder}
                loading={savingReminder}
                disabled={savingReminder}
                buttonColor="#5B718A"
              >
                Create
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Details Modal */}
      <Portal>
        <Modal
          visible={detailsModalVisible}
          onDismiss={() => setDetailsModalVisible(false)}
          contentContainerStyle={{
            backgroundColor: 'white',
            marginHorizontal: 20,
            padding: 20,
            borderRadius: 12,
            maxHeight: '80%'
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  backgroundColor: selectedItemType === 'routine' ? '#f0f4f7' : '#fef9f0',
                  borderRadius: 24,
                  padding: 8,
                  marginRight: 12
                }}>
                  <MaterialIcons
                    name={selectedItemType === 'routine' ? 'schedule' : 'notifications-active'}
                    size={24}
                    color={selectedItemType === 'routine' ? '#5B718A' : '#F7BC20'}
                  />
                </View>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827' }}>
                  {selectedItemType === 'routine' ? 'Routine Details' : 'Reminder Details'}
                </Text>
              </View>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setDetailsModalVisible(false)}
                style={{ margin: 0 }}
              />
            </View>

            {selectedItem && (
              <View>
                {/* Title */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                    TITLE
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
                    {selectedItem.title}
                  </Text>
                </View>

                {/* Senior Name */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                    SENIOR
                  </Text>
                  <Text style={{ fontSize: 16, color: '#374151' }}>
                    {assignedSeniors.find(s => s.userId === selectedItem.userId)?.name || 'Unknown'}
                  </Text>
                </View>

                {/* Type */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                    TYPE
                  </Text>
                  <View style={{
                    backgroundColor: selectedItemType === 'routine' ? '#f0f4f7' : '#fef9f0',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    alignSelf: 'flex-start'
                  }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: selectedItemType === 'routine' ? '#5B718A' : '#F7BC20',
                      textTransform: 'capitalize'
                    }}>
                      {selectedItem.type}
                    </Text>
                  </View>
                </View>

                {/* Status */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                    STATUS
                  </Text>
                  <Chip
                    mode="flat"
                    style={{
                      backgroundColor: getStatusColor(selectedItem.status).bg,
                      alignSelf: 'flex-start'
                    }}
                    textStyle={{
                      color: getStatusColor(selectedItem.status).text,
                      fontSize: 14,
                      fontWeight: '600',
                      textTransform: 'capitalize'
                    }}
                  >
                    {selectedItem.status || 'pending'}
                  </Chip>
                </View>

                {/* Time/DateTime */}
                {selectedItemType === 'routine' ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                      TIME
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialIcons name="access-time" size={20} color="#6b7280" />
                      <Text style={{ fontSize: 16, color: '#374151', marginLeft: 8 }}>
                        {formatTime(selectedItem.scheduledTime)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                      DATE & TIME
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialIcons name="calendar-today" size={20} color="#6b7280" />
                      <Text style={{ fontSize: 16, color: '#374151', marginLeft: 8 }}>
                        {formatDateTime(selectedItem.scheduledTime)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Frequency (for routines) */}
                {selectedItemType === 'routine' && selectedItem.frequency && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                      FREQUENCY
                    </Text>
                    <Text style={{ fontSize: 16, color: '#374151' }}>
                      {formatDays(selectedItem.frequency)}
                    </Text>
                  </View>
                )}

                {/* Notes/Description */}
                {selectedItemType === 'routine' && selectedItem.notes ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                      NOTES
                    </Text>
                    <View style={{
                      backgroundColor: '#f9fafb',
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#e5e7eb'
                    }}>
                      <Text style={{ fontSize: 15, color: '#374151', lineHeight: 22 }}>
                        {selectedItem.notes}
                      </Text>
                    </View>
                  </View>
                ) : selectedItemType === 'reminder' && selectedItem.description ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                      DESCRIPTION
                    </Text>
                    <View style={{
                      backgroundColor: '#f9fafb',
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#e5e7eb'
                    }}>
                      <Text style={{ fontSize: 15, color: '#374151', lineHeight: 22 }}>
                        {selectedItem.description}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Created At */}
                {selectedItem.createdAt && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                      CREATED AT
                    </Text>
                    <Text style={{ fontSize: 14, color: '#6b7280' }}>
                      {selectedItem.createdAt.toDate ? 
                        selectedItem.createdAt.toDate().toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        }) : 
                        'N/A'
                      }
                    </Text>
                  </View>
                )}

                {/* Close Button */}
                <Button
                  mode="contained"
                  onPress={() => setDetailsModalVisible(false)}
                  style={{ marginTop: 8 }}
                  buttonColor="#5B718A"
                >
                  Close
                </Button>
              </View>
            )}
          </ScrollView>
        </Modal>
      </Portal>

      <CareManagerBottomNav />
    </SafeAreaView>
  );
}
