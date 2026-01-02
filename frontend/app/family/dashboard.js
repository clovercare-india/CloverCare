import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, useRef } from 'react';
import { colors } from '../../theme/colors';
import { RefreshControl, ScrollView, StatusBar, View, BackHandler, ToastAndroid, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import FamilyBottomNav from '../../components/FamilyBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import SeniorCard from '../../components/SeniorCard';
import '../../global.css';
import { useAuth } from '../../contexts/AuthContext';
import {
  getLinkedSeniorsWithDetails,
  getLatestCheckIn,
  getPendingTasksCount,
  getPendingRemindersCount,
  getLatestHealthLogSummary,
  getHealthLogsForLinkedSenior
} from '../../firestore/familyFirestore';
import { translations as translationData, loadLanguage, addLanguageChangeListener } from '../../utils/i18n';

export default function FamilyDashboard() {
  const { user } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translations, setTranslations] = useState(translationData.en);
  const [seniors, setSeniors] = useState([]);
  const [selectedSeniorIndex, setSelectedSeniorIndex] = useState(0);
  const [showSeniorSelector, setShowSeniorSelector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [healthLogs, setHealthLogs] = useState({});
  
  // Back button handler
  const backPressCount = useRef(0);
  const backPressTimer = useRef(null);

  // Helper function to format time and relative time
  const formatCheckInTime = (timestamp) => {
    if (!timestamp) return null;
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    // Format time as "8:30 AM"
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    
    // Format relative time
    let relativeStr = '';
    if (diffMins < 60) {
      relativeStr = `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      relativeStr = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      relativeStr = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
    
    return `${timeStr} (${relativeStr})`;
  };

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      setError(null);

      // Get linked seniors
      const seniorsResult = await getLinkedSeniorsWithDetails(user.uid);
      
      if (!seniorsResult.success) {
        throw new Error(seniorsResult.error || 'Failed to fetch seniors');
      }

      const linkedSeniors = seniorsResult.data || [];
      if (linkedSeniors.length === 0) {
        setSeniors([]);
        setLoading(false);
        return;
      }

      // Fetch details for each senior in parallel
      const seniorsWithDetails = await Promise.all(
        linkedSeniors.map(async (senior) => {
          try {
            // Fetch check-in, tasks, reminders, and health log in parallel
            const [checkInResult, tasksResult, remindersResult, healthLogResult] = await Promise.all([
              getLatestCheckIn(senior.userId),
              getPendingTasksCount(senior.userId),
              getPendingRemindersCount(senior.userId),
              getLatestHealthLogSummary(senior.userId)
            ]);

            const checkIn = checkInResult.success ? checkInResult.data : null;
            const tasksCount = tasksResult.success ? tasksResult.data : 0;
            const remindersCount = remindersResult.success ? remindersResult.data : 0;
            const healthLog = healthLogResult.success ? healthLogResult.data : null;

            return {
              id: senior.userId,
              name: senior.name || senior.fullName || 'Unknown Senior',
              phone: senior.phone || senior.phoneNumber || 'N/A',
              checkInStatus: checkIn ? 'completed' : 'pending',
              checkInTime: checkIn ? formatCheckInTime(checkIn.createdAt) : null,
              mood: checkIn?.mood || null,
              pendingReminders: remindersCount,
              activeRequests: tasksCount,
              lastHealthLog: healthLog || 'N/A',
            };
          } catch (_err) {
            // Return basic senior info if details fetch fails
            return {
              id: senior.userId,
              name: senior.name || senior.fullName || 'Unknown Senior',
              phone: senior.phone || senior.phoneNumber || 'N/A',
              checkInStatus: 'pending',
              checkInTime: null,
              mood: null,
              pendingReminders: 0,
              activeRequests: 0,
              lastHealthLog: null,
            };
          }
        })
      );

      setSeniors(seniorsWithDetails);

      // Fetch health logs for all seniors
      const logsMap = {};
      for (const senior of seniorsWithDetails) {
        const logsResult = await getHealthLogsForLinkedSenior(senior.id, 30);
        if (logsResult.success) {
          logsMap[senior.id] = logsResult.logs || [];
        }
      }
      setHealthLogs(logsMap);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  // Initial load
  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();

    // Listen for language changes
    const removeListener = addLanguageChangeListener((newLang) => {
      setCurrentLanguage(newLang);
    });

    return removeListener;
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

  useEffect(() => {
    setTranslations(translationData[currentLanguage]);
  }, [currentLanguage]);

  // Fetch data when user is available
  useEffect(() => {
    if (user?.uid) {
      fetchDashboardData();
    }
  }, [user?.uid, fetchDashboardData]);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  const handleAddRequest = (seniorId) => {
    router.replace(`/family/services?seniorId=${seniorId}`);
  };

  const handleViewAlerts = (seniorId) => {
    router.replace(`/family/alerts?seniorId=${seniorId}`);
  };

  const handleViewRoutines = (seniorId) => {
    router.replace(`/family/routines?seniorId=${seniorId}`);
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor={colors.background.lighter} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-base text-gray-600">
            {translations.loadingSeniors || 'Loading seniors...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor={colors.background.lighter} />
        <View className="flex-1 justify-center items-center px-4">
          <MaterialIcons name="error-outline" size={64} color={colors.status.error} />
          <Text className="mt-4 text-lg font-bold text-gray-900">
            {translations.errorLoading || 'Error Loading Data'}
          </Text>
          <Text className="mt-2 text-sm text-gray-600 text-center">
            {error}
          </Text>
          <Button
            mode="contained"
            onPress={fetchDashboardData}
            className="mt-6"
            buttonColor={colors.primary}
          >
            {translations.retry || 'Retry'}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View className="bg-white border-b border-gray-100">
        <View className="px-4 py-3">
          <CloverCareNavbar 
            showLogo={true}
            logoSize={36}
            backgroundColor="transparent"
       
            appName="Clover Care"
          />
        </View>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >


  
        {/* Empty state */}
        {seniors.length === 0 ? (
          <View className="px-6 pt-8 pb-6 bg-white">
            <View className="items-center">
              <View className="w-24 h-24 rounded-3xl items-center justify-center mb-6" style={{ backgroundColor: colors.background.lighter }}>
                <MaterialIcons name="people-outline" size={56} color={colors.primary} />
              </View>
              <Text className="text-2xl font-bold text-gray-900 text-center">
                {translations.noSeniorsLinked || 'No Seniors Linked'}
              </Text>
              <Text className="mt-3 text-sm text-gray-600 text-center leading-5 px-4">
                {translations.noSeniorsDesc || 'Register a new senior or link to an existing senior to get started.'}
              </Text>
              
              <View className="w-full mt-8">
                <Button
                  mode="contained"
                  onPress={() => router.replace('/family/register-senior')}
                  buttonColor={colors.primary}
                  icon="account-plus"
                  contentStyle={{ paddingVertical: 10 }}
                  labelStyle={{ fontSize: 15, fontWeight: '600' }}
                >
                  {translations.registerNewSenior || 'Register New Senior'}
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => router.replace('/family/link-senior')}
                  textColor={colors.primary}
                  style={{ borderColor: colors.primary, borderWidth: 2, marginTop: 12 }}
                  icon="link"
                  contentStyle={{ paddingVertical: 10 }}
                  labelStyle={{ fontSize: 15, fontWeight: '600' }}
                >
                  {translations.linkSenior || 'Link Existing Senior'}
                </Button>
              </View>
            </View>
          </View>
        ) : (
          /* Senior Display with Selector */
          <>
            {/* Senior Selector - Always show */}
            <View className="px-6 pt-6 pb-2 bg-white">
              <Text className="text-base font-bold text-gray-900 mb-4">{translations.yourSeniors || 'Your Seniors'}</Text>
              <TouchableOpacity 
                onPress={() => seniors.length > 1 && setShowSeniorSelector(!showSeniorSelector)}
                className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
                activeOpacity={seniors.length > 1 ? 0.7 : 1}
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.primary }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                      {seniors[selectedSeniorIndex].name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-gray-500 mb-0.5">{translations.viewing || 'Viewing'}</Text>
                    <Text className="text-sm font-bold text-gray-900">
                      {seniors[selectedSeniorIndex].name}
                    </Text>
                  </View>
                </View>
                {seniors.length > 1 && (
                  <MaterialIcons 
                    name={showSeniorSelector ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                    size={24} 
                    color={colors.text.muted} 
                  />
                )}
              </TouchableOpacity>

              {/* Dropdown List - Only show if multiple seniors */}
              {showSeniorSelector && seniors.length > 1 && (
                <View className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {seniors.map((senior, index) => (
                    <TouchableOpacity
                      key={senior.id}
                      onPress={() => {
                        setSelectedSeniorIndex(index);
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
                          {senior.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-bold" style={{
                          color: index === selectedSeniorIndex ? colors.primary : '#111827'
                        }}>
                          {senior.name}
                        </Text>
                        <Text className="text-xs text-gray-500 mt-0.5">{senior.phone}</Text>
                      </View>
                      {index === selectedSeniorIndex && (
                        <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            {/* Selected Senior Card */}
            <View className="px-6 pt-6 pb-6 bg-white">
              <SeniorCard
                key={seniors[selectedSeniorIndex].id}
                senior={seniors[selectedSeniorIndex]}
                translations={translations}
                onAddRequest={handleAddRequest}
                onViewAlerts={handleViewAlerts}
                onViewRoutines={handleViewRoutines}
              />
            </View>

            {/* Health Logs Section */}
            {(() => {
              const currentSeniorId = seniors[selectedSeniorIndex].id;
              const logsForSenior = healthLogs[currentSeniorId];
              
              return logsForSenior?.length > 0 ? (
                <View className="px-6 py-4 bg-white">
                  <Text className="text-base font-bold text-gray-900 mb-4">Recent Health Logs</Text>
                  <View className="gap-3">
                    {logsForSenior.slice(0, 3).map((log, index) => {
                    const logDate = log.createdAt?.toDate?.() || new Date(log.createdAt);
                    const timeStr = logDate.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit', 
                      hour12: true 
                    });
                    const dateStr = logDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    });

                    const bloodPressure = log.vitals?.bloodPressure;
                    const bloodSugar = log.vitals?.bloodSugar;
                    const heartRate = log.vitals?.heartRate;
                    const temperature = log.vitals?.temperature;
                    const notes = log.notes || '';

                    return (
                      <View key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <View className="flex-row justify-between items-start mb-2">
                          <View>
                            <Text className="text-sm font-semibold text-gray-900">{dateStr}</Text>
                            <Text className="text-xs text-gray-500 mt-0.5">{timeStr}</Text>
                          </View>
                          <View className="bg-primary rounded-full px-2 py-1">
                            <Text className="text-xs font-semibold text-white">
                              {log.loggedBy || 'Log'}
                            </Text>
                          </View>
                        </View>

                        {/* Vitals Grid */}
                        <View className="mt-3">
                          {bloodPressure && (
                            <View className="flex-row items-center py-1.5">
                              <MaterialIcons name="favorite" size={16} color="#ef4444" />
                              <Text className="text-xs font-medium text-gray-700 ml-2">{translations.bp || 'BP'}:</Text>
                              <Text className="text-sm font-bold text-gray-900 ml-1">{bloodPressure}</Text>
                            </View>
                          )}
                          {bloodSugar && (
                            <View className="flex-row items-center py-1.5">
                              <MaterialIcons name="bloodtype" size={16} color="#8b5cf6" />
                              <Text className="text-xs font-medium text-gray-700 ml-2">{translations.sugar || 'Sugar'}:</Text>
                              <Text className="text-sm font-bold text-gray-900 ml-1">{bloodSugar}</Text>
                            </View>
                          )}
                          {heartRate && (
                            <View className="flex-row items-center py-1.5">
                              <MaterialIcons name="favorite" size={16} color="#f97316" />
                              <Text className="text-xs font-medium text-gray-700 ml-2">{translations.hr || 'HR:'}</Text>
                              <Text className="text-sm font-bold text-gray-900 ml-1">{heartRate} bpm</Text>
                            </View>
                          )}
                          {temperature && (
                            <View className="flex-row items-center py-1.5">
                              <MaterialIcons name="thermostat" size={16} color="#06b6d4" />
                              <Text className="text-xs font-medium text-gray-700 ml-2">Temp:</Text>
                              <Text className="text-sm font-bold text-gray-900 ml-1">{temperature}°F</Text>
                            </View>
                          )}
                        </View>

                        {/* Notes */}
                        {notes && (
                          <View className="mt-2 pt-2 border-t border-gray-200">
                            <Text className="text-xs text-gray-600">{notes}</Text>
                          </View>
                        )}
                      </View>
                    );
                    })}
                  </View>
                </View>
              ) : (
                <View className="px-6 py-4 bg-white">
                  <View className="items-center py-4">
                    <MaterialIcons name="health-and-safety" size={40} color="#d1d5db" />
                    <Text className="text-sm text-gray-500 mt-2">{translations.noHealthLogsYet || 'No health logs yet'}</Text>
                  </View>
                </View>
              );
            })()}
          </>
        )}
      </ScrollView>
        <FamilyBottomNav />
    </SafeAreaView>
  );
}