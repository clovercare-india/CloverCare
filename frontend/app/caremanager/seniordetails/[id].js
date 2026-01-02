import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Text } from "react-native-paper";
import CareManagerBottomNav from "../../../components/CareManagerBottomNav";
import "../../../global.css";
import {
  translations as translationData,
  loadLanguage,
} from "../../../utils/i18n";
import { useAuth } from "../../../contexts/AuthContext";
import {
  listenToCheckinsForAssignedSeniors,
  getHealthLogsForSenior,
  configureScheduledCheckIn,
  getScheduledCheckIn,
  listenToCarerTasksForAssignedSeniors,
  listenToRemindersForAssignedSeniors,
  listenToTasksCreatedByCareManager,
} from '../../../firestore/caremanagerFirestore';
import { getUserProfile } from "../../../firestore/sharedFirestore";
import ConfigureCheckInModal from '../../../components/ConfigureCheckInModal';
import CloverCareNavbar from '../../../components/CloverCareNavbar';

export default function SeniorDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const translations = translationData[currentLanguage];
  const [senior, setSenior] = useState(null);
  const [seniorProfile, setSeniorProfile] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [healthLogs, setHealthLogs] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [careManagerTasks, setCareManagerTasks] = useState([]);
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);
  const [checkInConfig, setCheckInConfig] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    // Initial language load
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  // Fetch senior profile
  useEffect(() => {
    const fetchSeniorProfile = async () => {
      if (!id) return;

      try {
        const profile = await getUserProfile(id);
        setSeniorProfile(profile);
      } catch (_error) {
      }
    };

    fetchSeniorProfile();
  }, [id]);

  // Load real senior data from Firestore
  useEffect(() => {
    if (!id) return;
    
    // Listen to check-ins for this senior
    const unsubscribeCheckins = listenToCheckinsForAssignedSeniors(
      [id],
      (checkinsList) => {
        setCheckins(checkinsList.filter((c) => c.userId === id));
      }
    );

    // Listen to service requests for this senior
    const unsubscribeServiceRequests = listenToCarerTasksForAssignedSeniors(
      [id],
      (serviceRequestsList) => {
        setServiceRequests(serviceRequestsList.filter((task) => task.seniorId === id));
      }
    );

    // Listen to reminders for this senior
    const unsubscribeReminders = listenToRemindersForAssignedSeniors(
      [id],
      (remindersList) => {
        setReminders(remindersList.filter((reminder) => reminder.userId === id));
      }
    );

    // Listen to care manager tasks for this senior
    let unsubscribeCareManagerTasks;
    if (user?.uid) {
      unsubscribeCareManagerTasks = listenToTasksCreatedByCareManager(
        user.uid,
        (tasksList) => {
          setCareManagerTasks(tasksList.filter((task) => task.seniorId === id));
        }
      );
    }

    return () => {
      if (unsubscribeCheckins) unsubscribeCheckins();
      if (unsubscribeServiceRequests) unsubscribeServiceRequests();
      if (unsubscribeReminders) unsubscribeReminders();
      if (unsubscribeCareManagerTasks) unsubscribeCareManagerTasks();
    };
  }, [id, user?.uid]);

  // Fetch health logs from healthLogs collection
  useEffect(() => {
    const fetchHealthLogs = async () => {
      if (!id) return;

      const result = await getHealthLogsForSenior(id, 30); // Last 30 days
      if (result.success) {
        setHealthLogs(result.logs);
      } else {
        setHealthLogs([]);
      }
    };

    fetchHealthLogs();
  }, [id]);

  // Fetch check-in configuration for this senior
  useEffect(() => {
    const fetchCheckInConfig = async () => {
      if (!id) return;

      const result = await getScheduledCheckIn(id);
      if (result.success && result.config) {
        setCheckInConfig(result.config);
      } else {
        setCheckInConfig(null);
      }
    };

    fetchCheckInConfig();
  }, [id]);

  // Transform real data into senior object
  useEffect(() => {
    if (!id) return;
    
    let seniorName = "Senior";
    if (seniorProfile) {
      if (seniorProfile.name && seniorProfile.name !== "Unknown")
        seniorName = seniorProfile.name;
      else if (seniorProfile.fullName && seniorProfile.fullName !== "Unknown")
        seniorName = seniorProfile.fullName;
      else if (seniorProfile.firstName && seniorProfile.lastName)
        seniorName = `${seniorProfile.firstName} ${seniorProfile.lastName}`;
      else if (seniorProfile.firstName) seniorName = seniorProfile.firstName;
    }

    const seniorPhone =
      seniorProfile?.phone ||
      seniorProfile?.phoneNumber ||
      "Not available";
    const seniorAge = seniorProfile?.age || null;
    const seniorGender = seniorProfile?.gender || "Not specified";

    // Filter check-ins for today by comparing createdAt date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCheckins = checkins.filter((c) => {
      const checkinDate = c.createdAt?.toDate?.() || new Date(c.createdAt);
      return checkinDate >= today && checkinDate < tomorrow;
    });

    // Determine check-in status based on scheduled vs completed check-ins
    let checkInStatus = "Pending";
    if (checkInConfig && checkInConfig.checkInTimes && checkInConfig.checkInTimes.length > 0) {
      const completedTimes = todayCheckins.map(ci => ci.scheduledTime).filter(Boolean);
      const allComplete = completedTimes.length >= checkInConfig.checkInTimes.length;
      checkInStatus = allComplete ? "Completed" : "Pending";
    } else if (todayCheckins.length > 0) {
      // If no config but has check-ins, consider completed
      checkInStatus = "Completed";
    }

    // Format last health log time
    let lastHealthLogDisplay = "No data";
    if (healthLogs.length > 0) {
      const lastLog = healthLogs[0]; // Health logs are sorted by date (most recent first)
      const logTime = lastLog.createdAt?.toDate?.()
        ? lastLog.createdAt.toDate()
        : new Date(lastLog.createdAt);

      const now = new Date();
      const diffMs = now - logTime;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (diffHours < 1) {
        lastHealthLogDisplay =
          diffMinutes <= 1 ? "Just now" : `${diffMinutes} mins ago`;
      } else if (diffHours < 24) {
        lastHealthLogDisplay =
          diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        lastHealthLogDisplay =
          diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
      }
    }

    // Calculate task counts
    const pendingTasks = [
      ...serviceRequests.filter(task => task.status === 'pending'),
      ...reminders.filter(reminder => reminder.status === 'pending'),
      ...careManagerTasks.filter(task => task.status === 'pending')
    ].length;

    const activeRequests = serviceRequests.filter(task => task.status === 'pending').length;

    setSenior({
      id: id,
      name: seniorName,
      avatar: null,
      age: seniorAge,
      gender: seniorGender,
      phone: seniorPhone,
      status: "Active",
      metrics: {
        todayCheckIn: checkInStatus,
        pendingTasks: pendingTasks,
        activeRequests: activeRequests,
        lastHealthLog: lastHealthLogDisplay,
        alerts24h: 0, // No alerts tracking implemented yet
      },
    });
  }, [
    id,
    checkins,
    seniorProfile,
    healthLogs,
    serviceRequests,
    reminders,
    careManagerTasks,
    checkInConfig,
  ]);

  const handleCall = async (phoneNumber) => {
    try {
      await Linking.openURL(`tel:${phoneNumber}`);
    } catch (error) {
      Alert.alert("Error", "Failed to initiate call", error);
    }
  };

  const handleConfigureCheckIn = async (senior) => {
    if (!senior?.id) return;
    
    const configResult = await getScheduledCheckIn(senior.id);
    if (configResult.success && configResult.config) {
      setCheckInConfig(configResult.config);
    }
    
    setCheckInModalVisible(true);
  };

  const handleSaveCheckInConfig = async (configData) => {
    if (!user?.uid || !id) {
      Alert.alert('Error', 'Missing required information');
      return false;
    }

    const result = await configureScheduledCheckIn(id, user.uid, configData);

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

  if (!senior) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <Text>{translations.loading || 'Loading...'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      <CloverCareNavbar 
        showBackButton={true}
        onBackPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/caremanager/seniors');
          }
        }}
        appName="Senior Profile"
      />

      <ScrollView
        className="flex-1"
        style={{ backgroundColor: '#f8fafc' }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header Card - Compact */}
        <View style={{ 
          backgroundColor: 'white', 
          marginHorizontal: 16, 
          marginTop: 16, 
          marginBottom: 12, 
          borderRadius: 16, 
          padding: 20,
          shadowColor: '#5B718A',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2
        }}>
          <View style={{ alignItems: 'center' }}>
            {/* Avatar - Smaller */}
            <View style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40, 
              backgroundColor: '#5B718A',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#5B718A',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 4,
              borderWidth: 3,
              borderColor: '#f0f4f7'
            }}>
              <Text style={{ color: 'white', fontSize: 30, fontWeight: '800' }}>
                {seniorProfile?.firstName && seniorProfile?.lastName 
                  ? `${seniorProfile.firstName[0]}${seniorProfile.lastName[0]}`.toUpperCase()
                  : seniorProfile?.name 
                    ? seniorProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'SN'}
              </Text>
            </View>
            
            {/* Name - Smaller */}
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 12 }}>
              {senior.name}
            </Text>
            
            {/* Age and Gender Pills - Compact */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
              <View style={{ 
                backgroundColor: '#f0f4f7', 
                paddingHorizontal: 12, 
                paddingVertical: 5, 
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: '#5B718A'
              }}>
                <Text style={{ color: '#5B718A', fontSize: 13, fontWeight: '700' }}>
                  {senior.age} {translations.years || 'years'}
                </Text>
              </View>
              <View style={{ 
                backgroundColor: '#f0f7f6', 
                paddingHorizontal: 12, 
                paddingVertical: 5, 
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: '#8DAAA5'
              }}>
                <Text style={{ color: '#8DAAA5', fontSize: 13, fontWeight: '700' }}>
                  {senior.gender}
                </Text>
              </View>
            </View>

            {/* Phone Button - Compact */}
            <TouchableOpacity
              onPress={() => handleCall(senior.phone)}
              activeOpacity={0.7}
              style={{
                marginTop: 12,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#5B718A',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 12,
                shadowColor: '#5B718A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 2
              }}
            >
              <MaterialIcons name="phone" size={18} color="white" />
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 14, marginLeft: 8 }}>
                {senior.phone}
              </Text>
            </TouchableOpacity>

            {/* Status Badge - Compact */}
            <View style={{ 
              marginTop: 10, 
              backgroundColor: '#d1fae5', 
              paddingHorizontal: 14, 
              paddingVertical: 5, 
              borderRadius: 16, 
              borderWidth: 1.5, 
              borderColor: '#10b981'
            }}>
              <Text style={{ color: '#065f46', fontWeight: '700', fontSize: 12, letterSpacing: 0.3 }}>
                ● {senior.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Stats - Enhanced */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 4, height: 24, backgroundColor: '#5B718A', borderRadius: 2, marginRight: 10 }} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>
              {translations.quickOverview || 'Quick Overview'}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
            {/* Today's Check-in */}
            <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
              <View style={{ 
                backgroundColor: 'white', 
                borderRadius: 16, 
                padding: 16, 
                shadowColor: '#5B718A', 
                shadowOffset: { width: 0, height: 2 }, 
                shadowOpacity: 0.08, 
                shadowRadius: 6, 
                elevation: 2, 
                borderWidth: 1.5, 
                borderColor: checkins.length > 0 && checkins[0].timestamp?.toDate().toDateString() === new Date().toDateString() ? '#10b981' : '#e5e7eb'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#f0f4f7', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="check-circle" size={24} color="#5B718A" />
                  </View>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: checkins.length > 0 && checkins[0].timestamp?.toDate().toDateString() === new Date().toDateString() ? '#10b981' : '#cbd5e1' }}>
                    {checkins.length > 0 && checkins[0].timestamp?.toDate().toDateString() === new Date().toDateString() ? '✓' : '—'}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 3 }}>{translations.todaysCheckIn || "Today's Check-in"}</Text>
                <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '500' }}>
                  {senior.metrics.todayCheckIn}
                </Text>
              </View>
            </View>

            {/* Pending Tasks */}
            <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
              <View style={{ 
                backgroundColor: 'white', 
                borderRadius: 16, 
                padding: 16, 
                shadowColor: '#8DAAA5', 
                shadowOffset: { width: 0, height: 2 }, 
                shadowOpacity: 0.08, 
                shadowRadius: 6, 
                elevation: 2,
                borderWidth: 1.5,
                borderColor: senior.metrics.pendingTasks > 0 ? '#8DAAA5' : '#e5e7eb'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#f0f7f6', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="task-alt" size={24} color="#8DAAA5" />
                  </View>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: '#8DAAA5' }}>
                    {senior.metrics.pendingTasks}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 3 }}>{translations.pendingTasks || 'Pending Tasks'}</Text>
                <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '500' }}>{translations.assignedToYou || 'Assigned to you'}</Text>
              </View>
            </View>

            {/* Active Service Requests */}
            <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
              <View style={{ 
                backgroundColor: 'white', 
                borderRadius: 16, 
                padding: 16, 
                shadowColor: '#F7BC20', 
                shadowOffset: { width: 0, height: 2 }, 
                shadowOpacity: 0.08, 
                shadowRadius: 6, 
                elevation: 2,
                borderWidth: 1.5,
                borderColor: senior.metrics.activeRequests > 0 ? '#F7BC20' : '#e5e7eb'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#fef9f0', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="room-service" size={24} color="#F7BC20" />
                  </View>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: '#F7BC20' }}>
                    {senior.metrics.activeRequests}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 3 }}>{translations.activeRequests || 'Active Requests'}</Text>
                <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '500' }}>{translations.serviceRequests || 'Service requests'}</Text>
              </View>
            </View>

            {/* Last Health Log */}
            <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
              <View style={{ 
                backgroundColor: 'white', 
                borderRadius: 16, 
                padding: 16, 
                shadowColor: '#10b981', 
                shadowOffset: { width: 0, height: 2 }, 
                shadowOpacity: 0.08, 
                shadowRadius: 6, 
                elevation: 2,
                borderWidth: 1.5,
                borderColor: healthLogs.length > 0 ? '#10b981' : '#e5e7eb'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="medical-services" size={24} color="#10b981" />
                  </View>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: healthLogs.length > 0 ? '#10b981' : '#cbd5e1' }}>
                    {healthLogs.length > 0 ? '✓' : '—'}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 3 }}>{translations.lastHealthLog || 'Last Health Log'}</Text>
                <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '500' }}>
                  {senior.metrics.lastHealthLog}
                </Text>
              </View>
            </View>
          </View>

          {/* Alerts displayed separately if any */}
          {senior.metrics.alerts24h > 0 && (
            <View style={{ 
              backgroundColor: 'white', 
              borderRadius: 16, 
              padding: 18, 
              marginTop: 4, 
              shadowColor: '#ef4444', 
              shadowOffset: { width: 0, height: 2 }, 
              shadowOpacity: 0.1, 
              shadowRadius: 8, 
              elevation: 3, 
              borderWidth: 2, 
              borderColor: '#ef4444' 
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <MaterialIcons name="warning" size={26} color="#ef4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 3 }}>
                    ⚠️ {translations.activeAlerts24h || 'Active Alerts (24h)'}
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#ef4444' }}>
                    {senior.metrics.alerts24h} {senior.metrics.alerts24h > 1 ? (translations.alerts || 'Alerts') : (translations.alert || 'Alert')}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Complete Profile Information */}
        {seniorProfile && (
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 4, height: 24, backgroundColor: '#8DAAA5', borderRadius: 2, marginRight: 10 }} />
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>
                {translations.completeProfile || 'Complete Profile'}
              </Text>
            </View>

            {/* Personal Details Card */}
            <View style={{ 
              backgroundColor: 'white', 
              borderRadius: 16, 
              padding: 18, 
              marginBottom: 12, 
              shadowColor: '#5B718A', 
              shadowOffset: { width: 0, height: 2 }, 
              shadowOpacity: 0.06, 
              shadowRadius: 6, 
              elevation: 2,
              borderTopWidth: 3,
              borderTopColor: '#5B718A'
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f4f7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <MaterialIcons name="person" size={20} color="#5B718A" />
                </View>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>{translations.personalDetails || 'Personal Details'}</Text>
              </View>
              
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.fullName || 'Full Name'}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'right' }}>
                    {seniorProfile.name || seniorProfile.fullName || seniorProfile.firstName + ' ' + (seniorProfile.lastName || '') || translations.na || 'N/A'}
                  </Text>
                </View>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.age || 'Age'}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'right' }}>
                    {seniorProfile.age || translations.na || 'N/A'}
                  </Text>
                </View>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.gender || 'Gender'}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'right' }}>
                    {seniorProfile.gender || translations.na || 'N/A'}
                  </Text>
                </View>

                {seniorProfile.dateOfBirth && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.dateOfBirth || 'Date of Birth'}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'right' }}>
                      {seniorProfile.dateOfBirth}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Contact Information Card */}
            <View style={{ 
              backgroundColor: 'white', 
              borderRadius: 16, 
              padding: 18, 
              marginBottom: 12, 
              shadowColor: '#8DAAA5', 
              shadowOffset: { width: 0, height: 2 }, 
              shadowOpacity: 0.06, 
              shadowRadius: 6, 
              elevation: 2,
              borderTopWidth: 3,
              borderTopColor: '#8DAAA5'
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f7f6', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <MaterialIcons name="contact-phone" size={20} color="#8DAAA5" />
                </View>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>{translations.contactInformation || 'Contact Information'}</Text>
              </View>
              
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.phone || 'Phone'}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'right' }}>
                    {seniorProfile.phone || seniorProfile.phoneNumber || translations.na || 'N/A'}
                  </Text>
                </View>

                {seniorProfile.email && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.email || 'Email'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'right' }}>
                      {seniorProfile.email}
                    </Text>
                  </View>
                )}

                {seniorProfile.address && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.address || 'Address'}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', flex: 2, textAlign: 'right' }}>
                      {typeof seniorProfile.address === 'string' 
                        ? seniorProfile.address 
                        : seniorProfile.address.fullAddress || translations.na || 'N/A'}
                    </Text>
                  </View>
                )}

                {(seniorProfile.city || seniorProfile.address?.city) && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.city || 'City'}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'right' }}>
                      {seniorProfile.city || seniorProfile.address?.city || translations.na || 'N/A'}
                    </Text>
                  </View>
                )}

                {(seniorProfile.state || seniorProfile.address?.state) && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.state || 'State'}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'right' }}>
                      {seniorProfile.state || seniorProfile.address?.state || translations.na || 'N/A'}
                    </Text>
                  </View>
                )}

                {(seniorProfile.pincode || seniorProfile.address?.pinCode) && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.pincode || 'Pincode'}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'right' }}>
                      {seniorProfile.pincode || seniorProfile.address?.pinCode || translations.na || 'N/A'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Health Logs History Card */}
            {healthLogs && healthLogs.length > 0 && (
              <View style={{ 
                backgroundColor: 'white', 
                borderRadius: 16, 
                padding: 18, 
                marginBottom: 12, 
                shadowColor: '#3b82f6', 
                shadowOffset: { width: 0, height: 2 }, 
                shadowOpacity: 0.06, 
                shadowRadius: 6, 
                elevation: 2,
                borderTopWidth: 3,
                borderTopColor: '#3b82f6'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <MaterialIcons name="show-chart" size={20} color="#3b82f6" />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>{translations.recentHealthLogs || 'Recent Health Logs'}</Text>
                </View>
                
                <View style={{ gap: 12 }}>
                  {healthLogs.slice(0, 3).map((log, idx) => {
                    const logDate = log.createdAt?.toDate?.() || new Date(log.createdAt);
                    const formattedDate = logDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const formattedTime = logDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

                    return (
                      <View key={idx} style={{ 
                        backgroundColor: '#f8fafc', 
                        borderRadius: 12, 
                        padding: 12
                      }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#6b7280' }}>
                            {formattedDate} • {formattedTime}
                          </Text>
                        </View>

                        <View style={{ gap: 8 }}>
                          {log.bloodPressure && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, color: '#6b7280' }}>{translations.bloodPressure || 'Blood Pressure'}</Text>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                                {log.bloodPressure.systolic}/{log.bloodPressure.diastolic} mmHg
                              </Text>
                            </View>
                          )}

                          {log.heartRate && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, color: '#6b7280' }}>{translations.heartRate || 'Heart Rate'}</Text>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                                {log.heartRate} bpm
                              </Text>
                            </View>
                          )}

                          {log.temperature && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, color: '#6b7280' }}>{translations.temperature || 'Temperature'}</Text>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                                {log.temperature}°C
                              </Text>
                            </View>
                          )}

                          {log.bloodSugar && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, color: '#6b7280' }}>{translations.bloodSugar || 'Blood Sugar'}</Text>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                                {log.bloodSugar} mg/dL
                              </Text>
                            </View>
                          )}

                          {log.weight && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, color: '#6b7280' }}>{translations.weight || 'Weight'}</Text>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                                {log.weight} kg
                              </Text>
                            </View>
                          )}

                          {log.oxygenSaturation && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, color: '#6b7280' }}>{translations.oxygenSaturation || 'O₂ Saturation'}</Text>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                                {log.oxygenSaturation}%
                              </Text>
                            </View>
                          )}

                          {log.notes && (
                            <View style={{ marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
                              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{translations.notes || 'Notes'}</Text>
                              <Text style={{ fontSize: 12, color: '#4b5563', fontStyle: 'italic' }}>
                                &ldquo;{log.notes}&rdquo;
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>

                {healthLogs.length > 3 && (
                  <TouchableOpacity
                    onPress={() => router.push(`/caremanager/healthlog?seniorId=${id}`)}
                    activeOpacity={0.7}
                    style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#3b82f6', textAlign: 'center' }}>
                      {translations.viewAll || 'View All'} {healthLogs.length} {translations.logs || 'Logs'} →
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Emergency Contact Card */}
            {seniorProfile.emergencyContact && (
              <View style={{ 
                backgroundColor: 'white', 
                borderRadius: 16, 
                padding: 18, 
                marginBottom: 12, 
                shadowColor: '#ef4444', 
                shadowOffset: { width: 0, height: 3 }, 
                shadowOpacity: 0.1, 
                shadowRadius: 8, 
                elevation: 3,
                borderWidth: 2,
                borderColor: '#fecaca'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <MaterialIcons name="emergency" size={20} color="#ef4444" />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: '#ef4444' }}>🚨 {translations.emergencyContact || 'Emergency Contact'}</Text>
                </View>
                
                <View style={{ gap: 10 }}>
                  {seniorProfile.emergencyContact.name && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.name || 'Name'}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'right' }}>
                        {seniorProfile.emergencyContact.name}
                      </Text>
                    </View>
                  )}

                  {seniorProfile.emergencyContact.relationship && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.relationship || 'Relationship'}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'right' }}>
                        {seniorProfile.emergencyContact.relationship}
                      </Text>
                    </View>
                  )}

                  {seniorProfile.emergencyContact.phone && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{translations.phone || 'Phone'}</Text>
                      <TouchableOpacity
                        onPress={() => handleCall(seniorProfile.emergencyContact.phone)}
                        activeOpacity={0.7}
                        style={{ backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      >
                        <MaterialIcons name="phone" size={16} color="#ef4444" />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#ef4444' }}>
                          {seniorProfile.emergencyContact.phone}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 4, height: 24, backgroundColor: '#F7BC20', borderRadius: 2, marginRight: 10 }} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>
              {translations.quickActions || 'Quick Actions'}
            </Text>
          </View>

          <View style={{ gap: 12, marginBottom: 100 }}>
            {/* Configure Check-In Button */}
            <TouchableOpacity
              onPress={() => handleConfigureCheckIn(senior)}
              activeOpacity={0.7}
              style={{
                backgroundColor: '#10b981',
                borderRadius: 16,
                padding: 18,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#10b981',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <MaterialIcons name="schedule" size={26} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: 'white', marginBottom: 2 }}>
                  {translations.configureCheckIn || 'Configure Check-In'}
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.85)', fontWeight: '500' }}>
                  {translations.setDailyCheckInSchedule || 'Set daily check-in schedule'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={28} color="white" />
            </TouchableOpacity>

            {/* Health Log Button */}
            <TouchableOpacity
              onPress={() => router.push('/caremanager/healthlog')}
              activeOpacity={0.7}
              style={{
                backgroundColor: '#5B718A',
                borderRadius: 16,
                padding: 18,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#5B718A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <MaterialIcons name="medical-services" size={26} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: 'white', marginBottom: 2 }}>
                  {translations.viewHealthLogs || 'View Health Logs'}
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.85)', fontWeight: '500' }}>
                  {translations.trackVitalsMedicalRecords || 'Track vitals and medical records'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={28} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Configure Check-In Modal */}
      <ConfigureCheckInModal
        visible={checkInModalVisible}
        onDismiss={() => setCheckInModalVisible(false)}
        seniorId={id}
        seniorName={seniorProfile?.name || seniorProfile?.fullName}
        onSave={handleSaveCheckInConfig}
        existingConfig={checkInConfig}
      />

      <CareManagerBottomNav />
    </SafeAreaView>
  );
}