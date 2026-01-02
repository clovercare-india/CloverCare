import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Modal, ScrollView, StatusBar, TouchableOpacity, View, RefreshControl, StyleSheet, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Chip, FAB, Text, TextInput } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import FamilyBottomNav from '../../components/FamilyBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import TaskHistoryModal from '../../components/TaskHistoryModal';
import { colors } from '../../theme/colors';
import '../../global.css';
import { translations as translationData, loadLanguage } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { createTask, listenToCareManagerTasks } from '../../firestore/seniorFirestore';
import { getLinkedSeniorsWithDetails } from '../../firestore/familyFirestore';
import { format } from 'date-fns';

export default function ServiceRequestsScreen() {
  const { user, userProfile } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [selectedSenior, setSelectedSenior] = useState('all');
  const [showSeniorSelector, setShowSeniorSelector] = useState(false);
  
  const translations = translationData[currentLanguage];
  
  // State for tasks and seniors
  const [allTasks, setAllTasks] = useState([]);
  const [seniors, setSeniors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination and Refresh state
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // History states
  const [historyVisible, setHistoryVisible] = useState(false);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [formData, setFormData] = useState({
    seniorId: '',
    serviceType: '',
    customDescription: '',
    scheduledAt: new Date()
  });

  // Memoize minimum date to prevent unnecessary re-renders
  const minDate = useMemo(() => new Date(), []);

  const serviceOptions = [
    'Groceries',
    'Doctor Visit',
    'Medication',
    'Transportation',
    'Personal Care',
    'Home Assistance',
  ];

  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  // Close dropdown when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowSeniorSelector(false);
      };
    }, [])
  );

  const fetchData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(null);

      const seniorsResult = await getLinkedSeniorsWithDetails(user.uid);
      if (seniorsResult.success) {
        const linkedSeniors = seniorsResult.data;
        setSeniors([
          { id: 'all', name: translations.allSeniors },
          ...linkedSeniors.map(senior => ({
            id: senior.userId,
            name: senior.name || senior.fullName || 'Unknown Senior',
            phone: senior.phone || senior.phoneNumber || ''
          }))
        ]);

        if (linkedSeniors.length === 0) {
          setLoading(false);
          setRefreshing(false);
        }
      } else {
        setLoading(false);
        setRefreshing(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to load data');
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid, translations.allSeniors, refreshing]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up real-time listeners for tasks
  useEffect(() => {
    if (!user?.uid || seniors.length === 0) return;

    const activeSeniors = seniors.filter(s => s.id !== 'all');
    const unsubscribers = [];

    activeSeniors.forEach(senior => {
      const unsubscribe = listenToCareManagerTasks(senior.id, async (tasks) => {
        // Enrich tasks with senior name and basic flags
        const enrichedTasks = tasks.map(task => {
          // A task is from Care Manager if it's explicitly marked, or if it has a careManagerId, 
          // or if it's not a service_request type.
          const isCMTask = task.itemType === 'care_manager_task' || 
                          (task.type && task.type !== 'service_request') || 
                          !!task.careManagerId;
          
          const raisedBySenior = task.createdBy === senior.id;
          const raisedByFamily = task.createdBy === user.uid;

          // Determine requester name without extra Firestore calls
          let requestedBy = task.requestedBy || 'Unknown';
          if (isCMTask) {
            requestedBy = 'Care Manager';
          } else if (raisedBySenior) {
            requestedBy = senior.name;
          } else if (raisedByFamily) {
            requestedBy = userProfile?.name || userProfile?.fullName || 'You';
          }

          // Map fields for consistent display between CM tasks and Service Requests
          const title = task.title || (isCMTask ? (task.type ? task.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Task') : 'Service Request');
          const description = task.description || task.taskDescription || '';

          return {
            ...task,
            seniorName: senior.name,
            seniorId: senior.id,
            title,
            description,
            requestedBy,
            isCMTask,
            sortDate: task.createdAt,
            itemType: isCMTask ? 'care_manager_task' : task.itemType,
            raisedBySenior,
            raisedByFamily,
            requesterRole: isCMTask ? 'caremanager' : (raisedByFamily ? 'family' : (raisedBySenior ? 'senior' : 'caremanager'))
          };
        });

        setAllTasks(prev => {
          // Filter out old tasks for this senior and add new ones
          const otherSeniorsTasks = prev.filter(t => t.seniorId !== senior.id);
          const combined = [...otherSeniorsTasks, ...enrichedTasks];
          
          // Deduplicate and sort
          return Array.from(new Map(combined.map(item => [item.id || item.taskId, item])).values())
            .sort((a, b) => (b.sortDate?.seconds || 0) - (a.sortDate?.seconds || 0));
        });
        
        setLoading(false);
        setRefreshing(false);
      });
      unsubscribers.push(unsubscribe);
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [user?.uid, seniors]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const getStatusBadge = (status) => {
    let backgroundColor = '#E0E0E0';
    let textColor = '#757575';
    let label = status;

    switch (status) {
      case 'pending':
        backgroundColor = '#FFF3E0';
        textColor = '#EF6C00';
        label = translations.active || 'Active';
        break;
      case 'in_progress':
        backgroundColor = '#E3F2FD';
        textColor = '#1976D2';
        label = translations.inProgress || 'In Progress';
        break;
      case 'completed':
        backgroundColor = '#E8F5E9';
        textColor = '#2E7D32';
        label = translations.completed || 'Completed';
        break;
      case 'cancelled':
        backgroundColor = '#FFEBEE';
        textColor = '#C62828';
        label = translations.cancelled || 'Cancelled';
        break;
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor }]}>
        <Text style={[styles.statusBadgeText, { color: textColor }]}>{label}</Text>
      </View>
    );
  };

  const handleAddRequest = () => {
    setFormData({
      seniorId: seniors.length > 1 ? seniors[1].id : '',
      serviceType: '',
      customDescription: '',
      scheduledAt: new Date()
    });
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setFormData({
      seniorId: '',
      serviceType: '',
      customDescription: '',
      scheduledAt: new Date()
    });
  };

  const handleRequestDetail = (request) => {
    setSelectedRequest(request);
    setDetailModalVisible(true);
  };

  const handleDetailModalClose = () => {
    setDetailModalVisible(false);
    setSelectedRequest(null);
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

  const handleSubmitRequest = async () => {
    if (!formData.seniorId) {
      Alert.alert('Error', 'Please select a senior');
      return;
    }
    
    if (!formData.serviceType && !formData.customDescription.trim()) {
      Alert.alert('Error', 'Please select a service type or enter a custom description');
      return;
    }

    try {
      setSubmitting(true);
      
      const taskData = {
        seniorId: formData.seniorId,  // Explicitly set seniorId (required)
        userId: formData.seniorId,
        createdBy: user.uid,
        requestedBy: userProfile?.name || userProfile?.fullName || 'Family Member',
        title: formData.serviceType || formData.customDescription,
        description: formData.customDescription || formData.serviceType,
        type: 'service_request',
        scheduledAt: formData.scheduledAt
      };

      const result = await createTask(taskData);
      
      if (result.success) {
        Alert.alert('Success', 'Service request created successfully');
        handleModalClose();
        fetchData(); 
      } else {
        Alert.alert('Error', result.error || 'Failed to create request');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to create service request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending':
        return { bg: '#FFF3E0', text: '#EF6C00' };
      case 'in_progress':
        return { bg: '#E3F2FD', text: '#1976D2' };
      case 'completed':
        return { bg: '#E8F5E9', text: '#2E7D32' };
      case 'cancelled':
        return { bg: '#FFEBEE', text: '#C62828' };
      default:
        return { bg: '#E0E0E0', text: '#757575' };
    }
  };

  // Combine and sort tasks
  const getAllRequests = useCallback(() => {
    // Map allTasks to ensure consistent fields
    const mappedTasks = allTasks.map(task => ({
      ...task,
      taskId: task.taskId || task.id,
      title: task.title || task.type,
      description: task.description || '',
      userId: task.seniorId,
      sortDate: task.createdAt
    }));

    // Filter out completed and cancelled tasks from the main list
    const activeTasks = mappedTasks.filter(task => 
      task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'missed'
    );

    return activeTasks.sort((a, b) => {
      const dateA = a.sortDate?.seconds || 0;
      const dateB = b.sortDate?.seconds || 0;
      return dateB - dateA;
    });
  }, [allTasks]);

  // Filter the COMBINED list
  const filteredRequests = useMemo(() => {
    return getAllRequests().filter(request => {
      const matchesSenior = selectedSenior === 'all' || request.userId === selectedSenior;
      return matchesSenior;
    });
  }, [getAllRequests, selectedSenior]);

  // Infinite Scroll Handler
  const handleScroll = useCallback((event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    
    // Trigger when user is within 250 pixels of the bottom
    // This is more reliable than a small threshold
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 250;
    
    if (isNearBottom && !isLoadingMore && displayCount < (filteredRequests?.length || 0)) {
      setIsLoadingMore(true);
      // Small delay to simulate network/loading and prevent multiple triggers
      setTimeout(() => {
        setDisplayCount(prevCount => prevCount + 10); // Increase by 10 for better UX
        setIsLoadingMore(false);
      }, 400);
    }
  }, [isLoadingMore, displayCount, filteredRequests?.length]);

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return translations.active || 'Active';
      case 'in_progress':
        return translations.inProgress || 'In Progress';
      case 'completed':
        return translations.completed || 'Completed';
      case 'cancelled':
        return translations.cancelled || 'Cancelled';
      default:
        return status;
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'MMM dd, yyyy');
    } catch (_error) {
      return 'N/A';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'h:mm a');
    } catch (_error) {
      return '';
    }
  };

  const selectedSeniorName = seniors.find(s => s.id === selectedSenior)?.name || seniors.find(s => s.id === selectedSenior)?.fullName || translations.allSeniors;
  const selectedSeniorIndex = seniors.findIndex(s => s.id === selectedSenior);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.lighter} />

      {/* Header with Navbar */}
      <View className="bg-white">
        <View className="px-4 py-3 flex-row justify-between items-center gap-3">
          <View className="flex-1">
            <CloverCareNavbar 
              showLogo={true}
              logoSize={36}
              backgroundColor="transparent"
              appName="Clover Care"
              rightAction={{
                icon: 'history',
                onPress: () => setHistoryVisible(true)
              }}
            />
          </View>
        </View>
      </View>

      {/* Content Section */}
      <View className="bg-white px-4 pt-5 pb-5">
        {/* Heading - Compact */}
        <View className="mb-2">
          <Text className="text-2xl font-bold text-slate-900">{translations.serviceRequests}</Text>
        </View>

        {/* Controls Section */}
        <View className="gap-3">
          {/* Senior Selector Dropdown */}
          <View>
            <Text className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">{translations.selectSenior || 'Select Senior'}</Text>
            <TouchableOpacity 
              onPress={() => seniors.length > 1 && setShowSeniorSelector(!showSeniorSelector)}
              className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
              activeOpacity={seniors.length > 1 ? 0.7 : 1}
            >
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.primary }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                    {(selectedSeniorName || 'A').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-0.5">{translations.viewing || 'Viewing'}</Text>
                  <Text className="text-sm font-bold text-gray-900">
                    {selectedSeniorName}
                  </Text>
                </View>
              </View>
              {seniors.length > 1 && (
                <MaterialIcons 
                  name={showSeniorSelector ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                  size={24} 
                  color={colors.text.primary} 
                />
              )}
            </TouchableOpacity>

            {/* Dropdown List */}
            {showSeniorSelector && seniors.length > 1 && (
              <View className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {seniors.map((senior, index) => (
                  <TouchableOpacity
                    key={senior.id}
                    onPress={() => {
                      setSelectedSenior(senior.id);
                      setShowSeniorSelector(false);
                    }}
                    className={`flex-row items-center px-4 py-3 ${
                      index !== seniors.length - 1 ? 'border-b border-gray-100' : ''
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
                      {senior.id !== 'all' && (
                        <Text className="text-xs text-gray-500 mt-0.5">{senior.phone || senior.phoneNumber || 'N/A'}</Text>
                      )}
                    </View>
                    {index === selectedSeniorIndex && (
                      <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-base text-gray-600 mt-4">{translations.loadingRequests || 'Loading requests...'}</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-base text-red-600 text-center mb-4">{error}</Text>
          <Button mode="contained" onPress={fetchData}>
            Retry
          </Button>
        </View>
      ) : (
        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
        {filteredRequests.length === 0 ? (
          <View className="items-center justify-center py-20 px-4">
            <MaterialIcons name="inbox" size={64} color={colors.border.light} />
            <Text className="text-xl font-bold text-gray-900 mt-4">
              {translations.noRequests}
            </Text>
            <Text className="text-sm text-slate-600 mt-2 text-center">
              {translations.noRequestsDesc}
            </Text>
          </View>
        ) : (
          <View className="mb-32">
            {filteredRequests.slice(0, displayCount).map((request, index) => {
              const isCMTask = request.itemType === 'care_manager_task';
              const raisedBySenior = request.raisedBySenior;
              const raisedByFamily = request.raisedByFamily;

              return (
                <TouchableOpacity
                  key={request.id || request.taskId || `request-${index}`}
                  onPress={() => handleRequestDetail(request)}
                  className={`flex-row items-center px-4 py-4 border-b border-gray-100 ${
                    isCMTask ? 'bg-orange-50' : raisedBySenior ? 'bg-blue-50' : raisedByFamily ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  {/* Avatar */}
                  {request.avatar ? (
                    <Avatar.Image
                      size={48}
                      source={{ uri: request.avatar }}
                    />
                  ) : (
                    <Avatar.Text
                      size={48}
                      label={request.seniorName?.charAt(0)?.toUpperCase() || 'S'}
                      backgroundColor={isCMTask ? colors.accent : raisedBySenior ? colors.primary : raisedByFamily ? colors.status.success : colors.primary}
                      color={colors.white}
                    />
                  )}

                  {/* Content */}
                  <View className="flex-1 ml-3">
                    {/* Badges for different request types */}
                    <View className="flex-row mb-1 flex-wrap gap-1">
                      {isCMTask && (
                        <View className="bg-orange-200 px-1.5 py-0.5 rounded">
                          <Text className="text-[10px] font-bold text-orange-800">
                            CARE MANAGER TASK
                          </Text>
                        </View>
                      )}
                      {raisedBySenior && (
                        <View className="bg-blue-200 px-1.5 py-0.5 rounded">
                          <Text className="text-[10px] font-bold text-blue-800">
                            RAISED BY SENIOR
                          </Text>
                        </View>
                      )}
                      {raisedByFamily && (
                        <View className="bg-green-200 px-1.5 py-0.5 rounded">
                          <Text className="text-[10px] font-bold text-green-800">
                            RAISED BY FAMILY
                          </Text>
                        </View>
                      )}
                    </View>

                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-base font-semibold text-gray-900 flex-1 mr-2">
                        {request.title}
                      </Text>
                      {request.status && getStatusBadge(request.status)}
                    </View>
                    <Text className="text-sm text-gray-600">
                      {translations.forSenior} {request.seniorName}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1">
                      {isCMTask ? 'Assigned by Care Manager' : `${translations.requestedBy} ${request.requestedBy}`} • {formatDate(request.createdAt || request.sortDate)}
                    </Text>
                    {request.scheduledAt && (
                      <View className="flex-row items-center mt-1">
                        <MaterialIcons name="access-time" size={14} color={colors.primary} />
                        <Text className="text-xs font-medium text-blue-600 ml-1">
                          Required: {formatDate(request.scheduledAt)} {formatTime(request.scheduledAt)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Arrow */}
                  <MaterialIcons name="chevron-right" size={24} className="ml-4" color={colors.primary} />
                </TouchableOpacity>
              );
            })}
            
            {/* Loading Indicator - Shows only when auto-loading more items */}
            {isLoadingMore && (
              <View className="items-center py-4">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 12, color: colors.text.muted }}>
                  Loading more items...
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      )}

      {/* History Modal */}
      <TaskHistoryModal 
        visible={historyVisible}
        onDismiss={() => setHistoryVisible(false)}
        role="family"
        seniors={seniors}
        translations={translations}
        user={user}
      />

      {/* Add Service Request Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleModalClose}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '90%' }}>
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-900">
                Add Service Request
              </Text>
              <TouchableOpacity onPress={handleModalClose}>
                <MaterialIcons name="close" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Senior Selection */}
              <Text className="text-base font-semibold text-gray-900 mb-3">
                Select Senior
              </Text>
              {seniors.filter(s => s.id !== 'all').map((senior) => (
                <TouchableOpacity
                  key={senior.id}
                  onPress={() => setFormData({...formData, seniorId: senior.id})}
                  className={`p-3 rounded-lg border mb-2 ${
                    formData.seniorId === senior.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                  }`}
                >
                  <Text className={`${
                    formData.seniorId === senior.id ? 'text-blue-700 font-semibold' : 'text-gray-900'
                  }`}>
                    {senior.name || senior.fullName || 'Unknown Senior'}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Service Type Selection */}
              <Text className="text-base font-semibold text-gray-900 mb-3 mt-4">
                Service Type
              </Text>
              {serviceOptions.map((service) => (
                <TouchableOpacity
                  key={service}
                  onPress={() => setFormData({...formData, serviceType: service})}
                  className={`p-3 rounded-lg border mb-2 ${
                    formData.serviceType === service ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                  }`}
                >
                  <Text className={`${
                    formData.serviceType === service ? 'text-blue-700 font-semibold' : 'text-gray-900'
                  }`}>
                    {service}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Custom Description */}
              <Text className="text-base font-semibold text-gray-900 mb-3 mt-4">
                Custom Description (Optional)
              </Text>
              <TextInput
                mode="outlined"
                placeholder="Enter custom service description..."
                value={formData.customDescription}
                onChangeText={(text) => setFormData({...formData, customDescription: text})}
                multiline
                numberOfLines={3}
                className="mb-6"
              />

              {/* Date and Time Selection */}
              <Text className="text-base font-semibold text-gray-900 mb-3">
                {translations.whenIsThisRequired || 'When is this required?'}
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

              {/* Submit Button */}
              <Button
                mode="contained"
                onPress={handleSubmitRequest}
                loading={submitting}
                disabled={submitting}
                buttonColor={colors.primary}
                className="mt-4 mb-8"
              >
                {submitting ? 'Creating...' : 'Create Request'}
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Service Request Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDetailModalClose}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-2xl w-11/12 max-w-md">
            <View className="p-6">
              {/* Header */}
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-xl font-bold text-gray-900">
                  {selectedRequest?.itemType === 'care_manager_task' ? 'Care Manager Task' : 'Service Request Details'}
                </Text>
                <TouchableOpacity onPress={handleDetailModalClose}>
                  <MaterialIcons name="close" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {selectedRequest && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Senior Info */}
                  <View className="flex-row items-center mb-6">
                    {selectedRequest.avatar ? (
                      <Avatar.Image
                        size={60}
                        source={{ uri: selectedRequest.avatar }}
                      />
                    ) : (
                      <Avatar.Text
                        size={60}
                        label={selectedRequest.seniorName?.charAt(0)?.toUpperCase() || 'S'}
                        backgroundColor={selectedRequest.itemType === 'care_manager_task' ? colors.accent : colors.primary}
                        color={colors.white}
                      />
                    )}
                    <View className="ml-4 flex-1">
                      <Text className="text-lg font-semibold text-gray-900">
                        {selectedRequest.seniorName}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        Senior Citizen
                      </Text>
                    </View>
                  </View>

                  {/* Service Details */}
                  <View className="mb-6">
                    <Text className="text-base font-semibold text-gray-900 mb-3">
                      Task Details
                    </Text>
                    <View className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <Text className="text-sm text-gray-700">
                        <Text className="font-medium">{translations.titleLabel || 'Title:'}</Text> {selectedRequest.title}
                      </Text>
                      {selectedRequest.description && (
                        <Text className="text-sm text-gray-700">
                          <Text className="font-medium">{translations.descriptionLabel || 'Description:'}</Text> {selectedRequest.description}
                        </Text>
                      )}
                      {selectedRequest.notes && (
                        <Text className="text-sm text-gray-700">
                          <Text className="font-medium">Notes:</Text> {selectedRequest.notes}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Status */}
                  <View className="mb-6">
                    <Text className="text-base font-semibold text-gray-900 mb-2">
                      Status
                    </Text>
                    {selectedRequest.status && (
                      <Chip
                        mode="flat"
                        style={{
                          backgroundColor: getStatusStyle(selectedRequest.status).bg,
                          alignSelf: 'flex-start'
                        }}
                        textStyle={{
                          color: getStatusStyle(selectedRequest.status).text,
                          fontSize: 14,
                          fontWeight: '600',
                        }}
                      >
                        {getStatusLabel(selectedRequest.status)}
                      </Chip>
                    )}
                  </View>

                  {/* Request Info */}
                  <View className="mb-6">
                    <Text className="text-base font-semibold text-gray-900 mb-2">
                      Information
                    </Text>
                    <View className="bg-gray-50 rounded-lg p-4">
                      <Text className="text-sm text-gray-600 mb-1">
                        <Text className="font-medium">Raised By:</Text> {selectedRequest.isCMTask ? 'Care Manager' : selectedRequest.raisedBySenior ? 'Senior' : 'Family Member'}
                      </Text>
                      <Text className="text-sm text-gray-600 mb-1">
                        <Text className="font-medium">{translations.raisedAt || 'Raised At'}:</Text> {formatDate(selectedRequest.createdAt || selectedRequest.sortDate)} {formatTime(selectedRequest.createdAt || selectedRequest.sortDate)}
                      </Text>
                      {selectedRequest.scheduledAt && (
                        <Text className="text-sm text-blue-600 mb-1 font-medium">
                          <Text className="font-bold">Required At:</Text> {formatDate(selectedRequest.scheduledAt)} {formatTime(selectedRequest.scheduledAt)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row gap-3">
                    <Button
                      mode="contained"
                      onPress={handleDetailModalClose}
                      style={{ flex: 1 }}
                      buttonColor={colors.background.lighter}
                      textColor={colors.text.primary}
                    >
                      Close
                    </Button>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={{
          position: 'absolute',
          margin: 16,
          right: 0,
          bottom: 80,
          backgroundColor: colors.primary,
        }}
        onPress={handleAddRequest}
      />

      <FamilyBottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});