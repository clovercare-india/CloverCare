import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StatusBar, Text, TouchableOpacity, View, RefreshControl, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CareManagerBottomNav from '../../components/CareManagerBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import ConfigureCheckInModal from '../../components/ConfigureCheckInModal';
import '../../global.css';
import { translations as translationData, loadLanguage } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { getUserProfile } from '../../firestore/sharedFirestore';
import { 
  getCareManagerAssignedSeniors,
  listenToAssignedSeniorIds,
  listenToCarerTasksForAssignedSeniors, 
  listenToCheckinsForAssignedSeniors, 
  listenToAlertsForAssignedSeniors,
  listenToRoutinesForAssignedSeniors,
  configureScheduledCheckIn,
  getScheduledCheckIn
} from '../../firestore/caremanagerFirestore';

export default function CareManagerSeniorsScreen() {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSeniorId, setExpandedSeniorId] = useState(null);
  
  const translations = translationData[currentLanguage];
  const [seniors, setSeniors] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [assignedSeniorIds, setAssignedSeniorIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Modal state for configure check-in
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);
  const [selectedSeniorForCheckIn, setSelectedSeniorForCheckIn] = useState(null);
  const [checkInConfig, setCheckInConfig] = useState(null);

  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  // Load real seniors data from Firestore with REAL-TIME listener for senior assignments
  useEffect(() => {
    if (!user?.uid) return;
    
    const careManagerId = user.uid;
    setLoading(true);
    setError(null);
    
    let cleanupFunctions = [];
    
    // Listen to real-time changes in assigned seniors (when reassigned from admin)
    const unsubscribeAssignedSeniors = listenToAssignedSeniorIds(careManagerId, (seniorIds) => {
      setAssignedSeniorIds(seniorIds);
      
      // Cleanup previous listeners
      cleanupFunctions.forEach(fn => fn());
      cleanupFunctions = [];
      
      // Setup listeners for the updated senior IDs
      if (seniorIds.length === 0) {
        setLoading(false);
        setServiceRequests([]);
        setTasks([]);
        setRoutines([]);
        setCheckins([]);
        setAlerts([]);
        return;
      }
      
      // Listen to carer tasks (service requests and CM tasks)
      const unsubscribeTasks = listenToCarerTasksForAssignedSeniors(seniorIds, (tasksList) => {
        setTasks(tasksList);
        setServiceRequests([]); // carerTasks covers both now
      });
      cleanupFunctions.push(unsubscribeTasks);

      // Listen to routines
      const unsubscribeRoutines = listenToRoutinesForAssignedSeniors(seniorIds, (routinesList) => {
        setRoutines(routinesList);
      });
      cleanupFunctions.push(unsubscribeRoutines);
      
      // Listen to check-ins
      const unsubscribeCheckins = listenToCheckinsForAssignedSeniors(seniorIds, (checkinsList) => {
        setCheckins(checkinsList);
      });
      cleanupFunctions.push(unsubscribeCheckins);
      
      // Listen to alerts
      const unsubscribeAlerts = listenToAlertsForAssignedSeniors(seniorIds, (alertsList) => {
        setAlerts(alertsList);
      });
      cleanupFunctions.push(unsubscribeAlerts);
      
      setLoading(false);
    });
    
    return () => {
      if (unsubscribeAssignedSeniors) unsubscribeAssignedSeniors();
      cleanupFunctions.forEach(fn => fn());
    };
  }, [user?.uid]);
  
  // Transform real data into seniors list using dynamic assignedSeniorIds
  useEffect(() => {
    const fetchSeniorsData = async () => {
      if (assignedSeniorIds.length === 0) {
        setSeniors([]);
        return;
      }
      
      // Fetch each senior's full profile
      const seniorProfiles = await Promise.all(
        assignedSeniorIds.map(async (seniorId) => {
          const profile = await getUserProfile(seniorId);
          
          const seniorTasks = tasks.filter(t => t.seniorId === seniorId || t.userId === seniorId);
          const seniorRoutines = routines.filter(r => r.userId === seniorId);
          const seniorCheckins = checkins.filter(c => c.userId === seniorId);
          const seniorAlerts = alerts.filter(a => a.seniorId === seniorId || a.userId === seniorId);
          
          const todayCheckins = seniorCheckins.filter(c => {
            const today = new Date().toISOString().split('T')[0];
            const checkinDate = c.createdAt?.toDate?.() ? c.createdAt.toDate().toISOString().split('T')[0] : 
                               c.timestamp?.toDate?.() ? c.timestamp.toDate().toISOString().split('T')[0] :
                               new Date(c.createdAt || c.timestamp).toISOString().split('T')[0];
            return checkinDate === today;
          });
          
          // Calculate stats including routines
          const pendingTasksCount = seniorTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
          const pendingRoutinesCount = seniorRoutines.filter(r => r.status === 'pending').length;
          const totalPending = pendingTasksCount + pendingRoutinesCount;

          const missedTasksCount = seniorTasks.filter(t => t.status === 'missed').length;
          const missedRoutinesCount = seniorRoutines.filter(r => r.status === 'missed').length;
          const totalMissed = missedTasksCount + missedRoutinesCount;

          const activeAlerts = seniorAlerts.filter(a => a.status === 'active').length;
          
          const hasCheckedInToday = todayCheckins.length > 0;
          
          // Robust name resolution
          let seniorName = 'Unknown Senior';
          if (profile) {
            if (profile.name && profile.name !== 'Unknown') seniorName = profile.name;
            else if (profile.fullName && profile.fullName !== 'Unknown') seniorName = profile.fullName;
            else if (profile.firstName && profile.lastName) seniorName = `${profile.firstName} ${profile.lastName}`;
            else if (profile.firstName) seniorName = profile.firstName;
            else seniorName = `Senior ${seniorId}`;
          }

          // Format last check-in with time
          let lastCheckInText = 'No check-in today';
          if (hasCheckedInToday && todayCheckins[0]) {
            const lastCheckin = todayCheckins[0];
            const checkinTime = lastCheckin.timestamp?.toDate?.() ? 
              lastCheckin.timestamp.toDate() : 
              lastCheckin.createdAt?.toDate?.() ? 
              lastCheckin.createdAt.toDate() : 
              new Date(lastCheckin.createdAt || lastCheckin.timestamp);
            const timeString = checkinTime.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            lastCheckInText = `Today (${timeString})`;
          }

          // OPTIMIZED: Use lastHealthLogAt from profile (no separate query needed)
          let lastHealthLogText = 'No data';
          if (profile?.lastHealthLogAt) {
            const logTime = profile.lastHealthLogAt.toDate ? 
              profile.lastHealthLogAt.toDate() : 
              new Date(profile.lastHealthLogAt);
            
            const now = new Date();
            const diffMs = now - logTime;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            if (diffHours < 1) {
              lastHealthLogText = diffMinutes <= 1 ? 'Just now' : `${diffMinutes}m ago`;
            } else if (diffHours < 24) {
              lastHealthLogText = diffHours === 1 ? '1h ago' : `${diffHours}h ago`;
            } else {
              const diffDays = Math.floor(diffHours / 24);
              lastHealthLogText = diffDays === 1 ? '1d ago' : `${diffDays}d ago`;
            }
          }

          return {
            id: seniorId,
            name: seniorName,
            phone: profile?.phone || profile?.phoneNumber || 'No phone',
            age: profile?.age || 0,
            statusText: hasCheckedInToday ? 'Check-in Completed' : 'Check-in Pending',
            statusBg: hasCheckedInToday ? '#dcfce7' : '#fef3c7',
            statusTextColor: hasCheckedInToday ? '#166534' : '#92400e',
            notificationCount: activeAlerts + pendingTasksCount,
            lastCheckIn: lastCheckInText,
            pendingTasks: totalPending,
            missedTasks: totalMissed,
            activeRequests: pendingTasksCount,
            lastHealthLog: lastHealthLogText,
            recentActivity: [
              ...seniorTasks.slice(0, 2).map(t => ({
                type: 'task',
                message: `${seniorName} - ${t.taskDescription || t.title || t.serviceType || 'Task'}`
              })),
              ...seniorCheckins.slice(0, 1).map(c => ({
                type: 'check-in',
                message: `${seniorName} - Daily check-in: ${c.mood || 'Completed'}`
              }))
            ].slice(0, 3)
          };
        })
      );
      
      setSeniors(seniorProfiles);
    };
    
    fetchSeniorsData();
  }, [assignedSeniorIds, serviceRequests, tasks, routines, checkins, alerts]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.uid) {
      try {
        const assignedResult = await getCareManagerAssignedSeniors(user.uid);
        if (assignedResult.success) {
          setAssignedSeniorIds(assignedResult.assignedSeniors || []);
        }
      } catch (_error) {
        // Error refreshing - silent fail
      }
    }
    setRefreshing(false);
  };

  const toggleExpand = (seniorId) => {
    setExpandedSeniorId(expandedSeniorId === seniorId ? null : seniorId);
  };

  const handleCall = async (phoneNumber) => {
    if (!phoneNumber || phoneNumber === 'No phone' || phoneNumber === '-') {
      return;
    }
    
    try {
      await Linking.openURL(`tel:${phoneNumber}`);
    } catch (_error) {
      Alert.alert('Error', 'Failed to initiate call');
    }
  };

  const handleConfigureCheckIn = async (senior) => {
    setSelectedSeniorForCheckIn(senior);
    
    // Load existing configuration
    const configResult = await getScheduledCheckIn(senior.id);
    if (configResult.success && configResult.config) {
      setCheckInConfig(configResult.config);
    } else {
      setCheckInConfig(null);
    }
    
    setCheckInModalVisible(true);
  };

  const handleSaveCheckInConfig = async (configData) => {
    if (!user?.uid || !selectedSeniorForCheckIn?.id) {
      Alert.alert('Error', 'Missing required information');
      return false;
    }

    const result = await configureScheduledCheckIn(
      selectedSeniorForCheckIn.id,
      user.uid,
      configData
    );

    if (result.success) {
      Alert.alert(
        'Success',
        result.updated 
          ? 'Check-in configuration updated successfully!' 
          : 'Check-in configuration saved successfully!'
      );
      return true;
    } else {
      Alert.alert('Error', result.error || 'Failed to save configuration');
      return false;
    }
  };

  const handleDismissModal = () => {
    setCheckInModalVisible(false);
    setSelectedSeniorForCheckIn(null);
    setCheckInConfig(null);
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
              appName="Clover Care"
            />
          </View>
        </View>
      </View>

      <View className="px-4 py-4">
        {/* Title */}
        <Text className="text-2xl font-bold text-gray-900 mb-4 text-center">{translations.allSeniors}</Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Loading State */}
        {loading && (
          <View className="flex-1 justify-center items-center py-20">
            <Text className="text-gray-500 text-lg">{translations.loadingSeniors || 'Loading seniors...'}</Text>
          </View>
        )}
        
        {/* Error State */}
        {error && (
          <View className="flex-1 justify-center items-center py-20">
            <Text className="text-red-500 text-lg mb-2">{translations.errorLoadingSeniors || 'Error loading seniors'}</Text>
            <Text className="text-gray-500 text-sm">{error}</Text>
            <TouchableOpacity 
              onPress={onRefresh}
              className="mt-4 bg-primary px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-semibold">{translations.retry || 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* No Seniors State */}
        {!loading && !error && seniors.length === 0 && (
          <View className="flex-1 justify-center items-center py-20">
            <MaterialIcons name="elderly" size={64} color="#94a3b8" />
            <Text className="text-gray-500 text-lg mt-4">{translations.noSeniorsAssignedYet || 'No seniors assigned yet'}</Text>
            <Text className="text-gray-400 text-sm mt-2 text-center px-8">
              {translations.contactAdministrator || 'Contact your administrator to get seniors assigned to your care'}
            </Text>
          </View>
        )}
        
        {/* Seniors List */}
        {!loading && !error && seniors.length > 0 && (
          <View className="mb-32">
            {seniors.map((senior) => {
              const isExpanded = expandedSeniorId === senior.id;
              return (
                <View key={senior.id} className="bg-white rounded-xl mb-4 overflow-hidden">
                  {/* Senior Card Header */}
                  <TouchableOpacity
                    onPress={() => toggleExpand(senior.id)}
                    className="p-4"
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center">
                      {/* Avatar */}
                      <View className="mr-3">
                        <View className="w-16 h-16 rounded-full bg-primary items-center justify-center">
                          <Text className="text-white text-lg font-bold">
                            {senior.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Senior Info */}
                      <View className="flex-1">
                        <Text className="text-lg font-bold text-gray-900 mb-1">
                          {senior.name}
                        </Text>
                        <View
                          className="self-start px-2 py-1 rounded"
                          style={{ backgroundColor: senior.statusBg }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{ color: senior.statusTextColor }}
                          >
                            {senior.statusText}
                          </Text>
                        </View>
                      </View>

                      {/* Expand Icon */}
                      <MaterialIcons
                        name={isExpanded ? 'expand-less' : 'expand-more'}
                        size={28}
                        color="#94a3b8"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <View className="px-4 pb-4 border-t border-gray-100">
                      {/* Senior Details */}
                      <View className="mt-3 mb-3">
                        <View className="flex-row items-center mb-2">
                          <MaterialIcons name="cake" size={18} color="#64748b" />
                          <Text className="text-sm text-gray-600 ml-2">{translations.age}: {senior.age}</Text>
                        </View>
                        <View className="flex-row items-center mb-2">
                          <MaterialIcons name="phone" size={18} color="#64748b" />
                          <Text className="text-sm text-gray-600 ml-2">{senior.phone}</Text>
                        </View>
                        <View className="flex-row items-center mb-2">
                          <MaterialIcons name="schedule" size={18} color="#64748b" />
                          <Text className="text-sm text-gray-600 ml-2">
                            {translations.lastCheckIn}: {senior.lastCheckIn}
                          </Text>
                        </View>
                      </View>

                      {/* Stats */}
                      <View className="flex-row gap-2 mb-3">
                        <View className="flex-1 bg-orange-50 rounded-lg p-3">
                          <Text className="text-xs text-orange-700 mb-1">{translations.pendingTasks}</Text>
                          <Text className="text-xl font-bold text-gray-900">
                            {senior.pendingTasks}
                          </Text>
                        </View>
                        <View className="flex-1 bg-red-50 rounded-lg p-3">
                          <Text className="text-xs text-red-700 mb-1">{translations.missedTasks}</Text>
                          <Text className="text-xl font-bold text-gray-900">
                            {senior.missedTasks}
                          </Text>
                        </View>
                        <View className="flex-1 bg-primary-50 rounded-lg p-3">
                          <Text className="text-xs text-primary-700 mb-1">{translations.lastHealthLog}</Text>
                          <Text className="text-xs font-semibold text-gray-900">
                            {senior.lastHealthLog}
                          </Text>
                        </View>
                      </View>

                      {/* Recent Activity */}
                      <View className="mb-3">
                        <Text className="text-sm font-semibold text-gray-900 mb-2">
                          {translations.recentActivity}
                        </Text>
                        {senior.recentActivity.map((activity, index) => (
                          <View key={index} className="flex-row items-start mb-2">
                            <View className="w-2 h-2 rounded-full bg-primary mt-1.5 mr-2" />
                            <View className="flex-1">
                              <Text className="text-sm text-gray-700">{activity.message}</Text>
                            </View>
                          </View>
                        ))}
                      </View>

                      {/* Quick Actions - 4 Buttons in 2x2 Grid */}
                      <View className="flex-row flex-wrap gap-2 mb-2">
                        {/* Button 1: Call */}
                        <TouchableOpacity
                          className="bg-primary rounded-lg py-3 items-center"
                          style={{ width: '48%' }}
                          activeOpacity={0.7}
                          onPress={() => handleCall(senior.phone)}
                        >
                          <MaterialIcons name="phone" size={20} color="white" />
                          <Text className="text-white text-xs font-semibold mt-1">{translations.call}</Text>
                        </TouchableOpacity>
                        
                        {/* Button 2: View Routines */}
                        <TouchableOpacity
                          className="bg-primary-100 rounded-lg py-3 items-center"
                          style={{ width: '48%' }}
                          activeOpacity={0.7}
                          onPress={() => router.replace('/caremanager/routines')}
                        >
                          <MaterialIcons name="schedule" size={20} color="#5B718A" />
                          <Text className="text-primary text-xs font-semibold mt-1">{translations.viewRoutines || 'View Routines'}</Text>
                        </TouchableOpacity>
                        
                        {/* Button 3: Health Logs - NAVIGATES WITH ID */}
                        <TouchableOpacity
                          className="bg-green-100 rounded-lg py-3 items-center"
                          style={{ width: '48%' }}
                          activeOpacity={0.7}
                          onPress={() => {
                            router.push({ pathname: '/caremanager/healthlog', params: { seniorId: senior.id } });
                          }}
                        >
                          <MaterialIcons name="favorite" size={20} color="#10b981" />
                          <Text className="text-green-700 text-xs font-semibold mt-1">{translations.healthLogs || 'Health Logs'}</Text>
                        </TouchableOpacity>
                        
                        {/* Button 4: Add Task - NEW ORANGE STYLING & NAVIGATES WITH ID */}
                        <TouchableOpacity
                          className="bg-orange-100 rounded-lg py-3 items-center"
                          style={{ width: '48%' }}
                          activeOpacity={0.7}
                          onPress={() => router.push('/caremanager/tasks')}
                        >
                          <MaterialIcons name="add-task" size={20} color="#f97316" />
                          <Text className="text-orange-700 text-xs font-semibold mt-1">{translations.addTask}</Text>
                        </TouchableOpacity>
                      </View>
                      
                      {/* Configure Check-In Button */}
                      <TouchableOpacity
                        className="bg-green-500 rounded-lg py-3 items-center mb-2"
                        activeOpacity={0.7}
                        onPress={() => handleConfigureCheckIn(senior)}
                      >
                        <View className="flex-row items-center">
                          <MaterialIcons name="alarm" size={20} color="white" />
                          <Text className="text-white text-sm font-semibold ml-2">
                            {translations.configureCheckIn || 'Configure Check-In'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* See Full Senior Detail Button */}
                      <TouchableOpacity
                        className="bg-primary rounded-lg py-3 items-center"
                        activeOpacity={0.7}
                        onPress={() => router.push(`/caremanager/seniordetails/${senior.id}`)}
                      >
                        <View className="flex-row items-center">
                          <MaterialIcons name="visibility" size={20} color="white" />
                          <Text className="text-white text-sm font-semibold ml-2">
                            {translations.seeFullSeniorDetail}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <CareManagerBottomNav />

      {/* Configure Check-In Modal */}
      <ConfigureCheckInModal
        visible={checkInModalVisible}
        onDismiss={handleDismissModal}
        seniorId={selectedSeniorForCheckIn?.id}
        seniorName={selectedSeniorForCheckIn?.name}
        onSave={handleSaveCheckInConfig}
        existingConfig={checkInConfig}
        loading={false}
      />
    </SafeAreaView>
  );
}