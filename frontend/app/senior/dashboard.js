import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  Alert, 
  Linking, 
  RefreshControl, 
  ScrollView, 
  StatusBar, 
  View, 
  BackHandler, 
  ToastAndroid, 
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ModalSelector from 'react-native-modal-selector';
import { Button, Card, Dialog, Portal, Text, ActivityIndicator } from 'react-native-paper';

import SeniorBottomNav from '../../components/SeniorBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import { colors } from '../../theme/colors';
import { translations as translationData, loadLanguage, addLanguageChangeListener } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';

import { 
  getRemindersForSenior, 
  createCheckInLog, 
  getTodayCheckIn, 
  createPanicAlert, 
  updateReminderStatus, 
  getMyScheduledCheckIn
} from '../../firestore/seniorFirestore';

import { getCareManager } from '../../firestore/caremanagerFirestore';


export default function SeniorDashboard() {

  // =====================================
  // STATE
  // =====================================
  const { userProfile } = useAuth();

  const [currentLanguage, setCurrentLanguage] = useState('en');
  const translations = translationData[currentLanguage];

  const [selectedMood, setSelectedMood] = useState('');
  const [panicDialogVisible, setPanicDialogVisible] = useState(false);

  const [reminders, setReminders] = useState([]);
  const [moods, setMoods] = useState([]);

  const [careManager, setCareManager] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);

  // Multi check-in state
  const [checkInTimes, setCheckInTimes] = useState([]);
  const [checkInOptions, setCheckInOptions] = useState([]);
  const [nextCheckInTime, setNextCheckInTime] = useState(null);
  const [currentCheckInTime, setCurrentCheckInTime] = useState(null);
  const [checkInStatus, setCheckInStatus] = useState(null); // 'available', 'missed', or null
  const [completedCheckInTimes, setCompletedCheckInTimes] = useState([]);

  // Reminder detail modal
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);

  // Back button handler state
  const backPressCount = useRef(0);
  const backPressTimer = useRef(null);

  // Care manager phone
  const careManagerPhone = careManager?.phone || careManager?.phoneNumber;


  // =====================================
  // LANGUAGE SETUP
  // =====================================
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


  // =====================================
  // ANDROID DOUBLE BACK EXIT
  // =====================================
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      backPressCount.current += 1;

      if (backPressCount.current === 1) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        }

        backPressTimer.current = setTimeout(() => {
          backPressCount.current = 0;
        }, 2000);

        return true;
      }

      if (backPressCount.current === 2) {
        BackHandler.exitApp();
        return false;
      }

      return true;
    });

    return () => {
      backHandler.remove();
      if (backPressTimer.current) clearTimeout(backPressTimer.current);
    };
  }, []);


  // =====================================
  // FETCH DASHBOARD DATA
  // =====================================
  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        await loadDashboard();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile, loadDashboard]);


  // =====================================
  // LIVE CHECK-IN STATUS UPDATER (every minute)
  // =====================================
  useEffect(() => {
    if (!checkInTimes || checkInTimes.length === 0) return;

    const updateCheckInStatus = () => {
      const { currentTime, nextTime, status } = calculateCheckInStatus(
        checkInTimes,
        completedCheckInTimes
      );
      setCurrentCheckInTime(currentTime);
      setNextCheckInTime(nextTime);
      setCheckInStatus(status);
    };

    updateCheckInStatus();
    const intervalId = setInterval(updateCheckInStatus, 60000); // Check every minute
    return () => clearInterval(intervalId);
  }, [checkInTimes, completedCheckInTimes]);



  // =====================================
  // LANGUAGE & CHECK-IN OPTIONS UPDATE
  // =====================================
  useEffect(() => {
    if (!hasCheckedInToday) {
      setSelectedMood(translationData[currentLanguage].myMood || 'Select Mood');
    }

    // Use configured check-in options or defaults
    if (checkInOptions && checkInOptions.length > 0) {
      setMoods(checkInOptions);
    } else {
      setMoods([
        { label: translationData[currentLanguage].happy || 'Happy', icon: 'sentiment-satisfied', color: colors.status.success },
        { label: translationData[currentLanguage].okay || 'Okay', icon: 'sentiment-neutral', color: colors.primary },
        { label: translationData[currentLanguage].sad || 'Sad', icon: 'sentiment-dissatisfied', color: colors.status.warning },
        { label: translationData[currentLanguage].unwell || 'Unwell', icon: 'sick', color: colors.status.error },
      ]);
    }
  }, [currentLanguage, hasCheckedInToday, checkInOptions]);



  // =====================================
  // HELPERS
  // =====================================
  const formatTime = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getIconForReminderType = (type) => {
    const iconMap = {
      custom: 'notifications',
      appointment: 'calendar-month',
      medication: 'medication',
      activity: 'directions-walk',
    };
    return iconMap[type] || 'notifications';
  };

  // HELPER: Calculate check-in window status (eliminates duplicate logic)
  const calculateCheckInStatus = (times, completed) => {
    if (!times || times.length === 0) {
      return { currentTime: null, nextTime: null, showReminder: false, status: null };
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let currentTime = null;
    let nextTime = null;
    let status = null;

    for (const timeStr of times) {
      if (completed.includes(timeStr)) continue;

      const [h, m] = timeStr.split(':');
      const scheduledMinutes = parseInt(h) * 60 + parseInt(m);
      const fifteenMinutesBefore = scheduledMinutes - 15;
      const ninetyMinutesAfter = scheduledMinutes + 90;

      if (currentMinutes >= fifteenMinutesBefore && currentMinutes < ninetyMinutesAfter) {
        currentTime = timeStr;
        status = 'available';
        break;
      } else if (currentMinutes >= ninetyMinutesAfter) {
        status = 'missed';
        continue;
      }

      if (currentMinutes < fifteenMinutesBefore && !nextTime) {
        nextTime = timeStr;
      }
    }

    if (!nextTime && !currentTime && times.length > 0) {
      nextTime = times[0];
    }

    return { currentTime, nextTime, status };
  };



  // =====================================
  // SHARED DASHBOARD DATA LOADER (memoized to prevent unnecessary effect re-runs)
  // =====================================
  const loadDashboard = useCallback(async () => {
    if (!userProfile?.userId) return;

    try {
      const seniorId = userProfile.userId;

      // Get reminders
      const remindersRes = await getRemindersForSenior(seniorId);
      if (remindersRes.success) {
        setReminders(remindersRes.reminders.filter(r => r.status === 'pending'));
      }

      // Get check-in configuration
      const scheduleRes = await getMyScheduledCheckIn(seniorId);
      if (scheduleRes.success && scheduleRes.config) {
        const config = scheduleRes.config;
        setCheckInTimes(config.checkInTimes || []);
        setCheckInOptions(config.checkInOptions || []);
      }

      // Get today's check-ins
      const todayRes = await getTodayCheckIn(seniorId);
      const todayCheckIns = todayRes.success ? todayRes.checkIns : [];
      const completedTimes = todayCheckIns.map(c => c.scheduledTime).filter(Boolean);

      setCompletedCheckInTimes(completedTimes);
      
      if (todayCheckIns.length > 0) {
        setSelectedMood(todayCheckIns[0].mood || 'okay');
      }

      // Calculate check-in status
      if (scheduleRes.success && scheduleRes.config && scheduleRes.config.checkInTimes) {
        const { currentTime, nextTime, status } = calculateCheckInStatus(
          scheduleRes.config.checkInTimes,
          completedTimes
        );
        setCurrentCheckInTime(currentTime);
        setNextCheckInTime(nextTime);
        setCheckInStatus(status);
      }

      // Determine if all check-ins are complete
      const allComplete = (scheduleRes.success && scheduleRes.config && 
                          scheduleRes.config.checkInTimes && 
                          scheduleRes.config.checkInTimes.length > 0 && 
                          completedTimes.length >= scheduleRes.config.checkInTimes.length);
      
      setHasCheckedInToday(allComplete);

      // Get care manager
      if (userProfile.careManagerId) {
        const cmRes = await getCareManager(userProfile.careManagerId);
        if (cmRes.success) setCareManager(cmRes.careManager);
      }
    } catch (err) {
      // Handle error silently
    }
  }, [userProfile]);



  // =====================================
  // REFRESH HANDLER
  // =====================================
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  };



  // =====================================
  // HANDLE CHECK-IN SELECT
  // =====================================
  const handleMoodSelect = async (option) => {
    if (!userProfile?.userId) {
      return;
    }

    if (!currentCheckInTime) {
      Alert.alert('Error', 'No check-in time is currently active');
      return;
    }

    setSelectedMood(option.label);

    const res = await createCheckInLog(userProfile.userId, option.label, currentCheckInTime);

    if (res.success) {
      
      const newCompletedTimes = [...completedCheckInTimes, currentCheckInTime];
      
      setCompletedCheckInTimes(newCompletedTimes);
      
      const allComplete = (checkInTimes.length > 0 && 
                          newCompletedTimes.length >= checkInTimes.length);
      
      setHasCheckedInToday(allComplete);
      setCurrentCheckInTime(null);
      
      // Find next check-in
      const { nextTime } = calculateCheckInStatus(checkInTimes, newCompletedTimes);
      setNextCheckInTime(nextTime);
      
      Alert.alert(
        'Success', 
        allComplete 
          ? 'All check-ins completed for today!' 
          : `Check-in recorded! Next check-in at ${nextTime || 'tomorrow'}`
      );
    } else {
      Alert.alert('Error', res.error || 'Failed to record check-in');
    }
  };


  // =====================================
  // CARE MANAGER PHONE CALL
  // =====================================
  const handleCallCareManager = () => {
    if (careManagerPhone) {
      Linking.openURL(`tel:${careManagerPhone}`);
    }
  };


  // =====================================
  // PANIC BUTTON
  // =====================================
  const handlePanicPress = () => setPanicDialogVisible(true);

  const handlePanicConfirm = async () => {
    if (!userProfile?.userId) return;

    setPanicDialogVisible(false);

    const r = await createPanicAlert(
      userProfile.userId,
      'Panic button pressed by user',
      userProfile.careManagerId,
      userProfile.name || userProfile.displayName
    );

    if (r.success) {
      Alert.alert('Emergency Alert Sent', 'Your family and care manager have been notified!');
    } else {
      Alert.alert('Error', r.error || 'Failed to send alert');
    }
  };

  const handlePanicCancel = () => setPanicDialogVisible(false);



  // =====================================
  // REMINDER MODAL HANDLING
  // =====================================
  const handleReminderPress = (r) => {
    setSelectedReminder(r);
    setReminderModalVisible(true);
  };

  const handleMarkReminderCompleted = async () => {
    if (!selectedReminder?.reminderId) return;

    const r = await updateReminderStatus(selectedReminder.reminderId, 'completed');
    if (r.success) {
      setReminderModalVisible(false);
      setReminders(prev => prev.filter(x => x.reminderId !== selectedReminder.reminderId));
      Alert.alert('Success', 'Reminder marked as completed');
    }
  };

  // =====================================
  // UI RENDER
  // =====================================
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.lighter }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      
      {/* Header with Navbar */}
      <View style={{ backgroundColor: colors.white }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <CloverCareNavbar 
              showLogo={true}
              logoSize={36}
              backgroundColor="transparent"
              appName="Clover Care"
            />
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >

        {/* Loading */}
        {loading ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.text.muted, marginTop: 16 }}>Loading dashboard...</Text>
          </View>
        ) : (
          <>
            {/* =======================================================
                CHECK-IN SECTION (MULTI-TIME SUPPORT)
            ======================================================= */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>{translations.dailyCheckIn}</Text>

              {/* Case 1 — All check-ins complete for today */}
              {hasCheckedInToday && (
                <Card style={{ backgroundColor: '#f0fdf4', borderColor: colors.status.success, borderWidth: 1, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                  <Card.Content style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <MaterialIcons name="check-circle" size={64} color={colors.status.success} />
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.status.success, marginTop: 8 }}>
                      All Check-Ins Complete!
                    </Text>
                    <Text style={{ fontSize: 16, color: colors.status.success, marginTop: 4, textAlign: 'center' }}>
                      You have completed all check-ins for today
                    </Text>

                    <Text style={{ fontSize: 14, color: colors.status.success, marginTop: 12 }}>
                      Latest mood: <Text style={{ fontWeight: 'bold' }}>{selectedMood}</Text>
                    </Text>

                    {completedCheckInTimes.length > 0 && (
                      <Text style={{ fontSize: 12, color: colors.status.success, marginTop: 8 }}>
                        Completed {completedCheckInTimes.length} of {checkInTimes.length} check-ins
                      </Text>
                    )}

                    {nextCheckInTime && (
                      <Text style={{ fontSize: 12, color: colors.status.success, marginTop: 8 }}>
                        Next check-in: {nextCheckInTime}
                      </Text>
                    )}
                  </Card.Content>
                </Card>
              )}

              {/* Case 2 — Check-ins configured but time not reached yet */}
              {!hasCheckedInToday && checkInTimes.length > 0 && currentCheckInTime === null && (
                <Card style={{ backgroundColor: '#eff6ff', borderColor: colors.primary, borderWidth: 1, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                  <Card.Content style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <MaterialIcons name="schedule" size={64} color={colors.primary} />
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary, marginTop: 8 }}>
                      {completedCheckInTimes.length > 0 ? translations.waitingForNextCheckIn : translations.checkInsScheduled}
                    </Text>
                    
                    {completedCheckInTimes.length > 0 && (
                      <View style={{ marginTop: 12, width: '100%', backgroundColor: '#dcfce7', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: 'semibold', color: colors.status.success, textAlign: 'center', marginBottom: 8 }}>
                          Completed Today ({completedCheckInTimes.length}/{checkInTimes.length})
                        </Text>
                        {completedCheckInTimes.map((time, index) => (
                          <View key={index} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                            <MaterialIcons name="check-circle" size={16} color={colors.status.success} />
                            <Text style={{ fontSize: 14, color: colors.status.success, marginLeft: 8 }}>{time}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {nextCheckInTime && (
                      <View style={{ marginTop: 8, width: '100%', backgroundColor: '#dbeafe', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: 'semibold', color: colors.primary, textAlign: 'center', marginBottom: 8 }}>
                          {translations.nextCheckIn}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialIcons name="access-time" size={24} color={colors.primary} />
                          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary, marginLeft: 8 }}>
                            {nextCheckInTime}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, color: colors.primary, marginTop: 8, textAlign: 'center' }}>
                          {translations.checkInWillBeAvailable}
                        </Text>
                      </View>
                    )}

                    {!nextCheckInTime && completedCheckInTimes.length > 0 && (
                      <Text style={{ fontSize: 14, color: colors.primary, marginTop: 12, textAlign: 'center' }}>
                        {translations.nextCheckInTomorrow}
                      </Text>
                    )}
                  </Card.Content>
                </Card>
              )}

              {/* Case 3 — No check-in configuration */}
              {!hasCheckedInToday && checkInTimes.length === 0 && (
                <Card style={{ backgroundColor: '#f9fafb', borderColor: colors.border.light, borderWidth: 1, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                  <Card.Content style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <MaterialIcons name="info" size={64} color={colors.text.muted} />
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text.primary, marginTop: 8 }}>
                      No Check-In Configured
                    </Text>
                    <Text style={{ fontSize: 16, color: colors.text.secondary, marginTop: 4, textAlign: 'center' }}>
                      Your care manager hasn&apos;t set up check-in times yet
                    </Text>
                  </Card.Content>
                </Card>
              )}

              {/* Case 4 — Time reached, show check-in selector or window closed message */}
              {!hasCheckedInToday && checkInTimes.length > 0 && (
                <>
                  {currentCheckInTime && checkInStatus === 'available' && (
                    <>
                      <View style={{ marginBottom: 12, backgroundColor: '#fed7aa', borderColor: colors.status.warning, borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                          <MaterialIcons name="notification-important" size={24} color={colors.status.warning} />
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.status.warning, marginLeft: 8 }}>
                            Check-In Time!
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                          <MaterialIcons name="access-time" size={20} color={colors.status.warning} />
                          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.status.warning, marginLeft: 8 }}>
                            {currentCheckInTime}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, color: colors.status.warning, textAlign: 'center' }}>
                          Please select how you&apos;re feeling (90-minute window)
                        </Text>
                        {completedCheckInTimes.length > 0 && (
                          <Text style={{ fontSize: 12, color: colors.status.warning, marginTop: 8, textAlign: 'center' }}>
                            {completedCheckInTimes.length} of {checkInTimes.length} completed today
                          </Text>
                        )}
                      </View>

                      <ModalSelector
                        data={moods}
                        initValue={translations.myMood || 'Select Mood'}
                        onChange={handleMoodSelect}
                        keyExtractor={x => x.id || x.label}
                        labelExtractor={x => x.label}
                        componentExtractor={(x) => (
                          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
                            <MaterialIcons name={x.icon} size={24} color={x.color} />
                            <Text style={{ marginLeft: 10, fontSize: 16 }}>{x.label}</Text>
                          </View>
                        )}
                      >
                        <Card style={{ backgroundColor: '#dcfce7', shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                          <Card.Content style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                              <MaterialIcons 
                                name={moods[0]?.icon || "sentiment-satisfied"} 
                                size={32} 
                                color={moods[0]?.color || colors.status.success} 
                              />
                              <Text style={{ fontSize: 18, fontWeight: 'semibold', color: colors.status.success }}>
                                {translations.myMood || 'Select Your Mood'}
                              </Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-down" size={24} color={colors.status.success} />
                          </Card.Content>
                        </Card>
                      </ModalSelector>
                    </>
                  )}

                  {checkInStatus === 'missed' && (
                    <View style={{ marginBottom: 12, backgroundColor: '#fee2e2', borderColor: colors.status.error, borderWidth: 2, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 20 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                        <MaterialIcons name="error-outline" size={28} color={colors.status.error} />
                        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.status.error, marginLeft: 12 }}>
                          {translations.checkInWindowEnded}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, color: colors.status.error, textAlign: 'center', lineHeight: 20 }}>
                        {translations.checkInWindowEndedMessage}
                      </Text>
                      {completedCheckInTimes.length > 0 && (
                        <Text style={{ fontSize: 12, color: colors.status.error, marginTop: 12, textAlign: 'center', fontWeight: '600' }}>
                          Completed: {completedCheckInTimes.length} of {checkInTimes.length}
                        </Text>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>


            {/* ===================================================================
                CALL CARE MANAGER
            =================================================================== */}
            <View style={{ marginBottom: 24 }}>
              <Button
                mode="contained"
                onPress={handleCallCareManager}
                buttonColor={colors.primary}
                icon={() => <MaterialIcons name="phone" size={24} color={colors.white} />}
                contentStyle={{ paddingVertical: 12 }}
                labelStyle={{ fontSize: 18, fontWeight: 'bold' }}
              >
                {translations.callCareManager}
              </Button>
            </View>


            {/* ===================================================================
                REMINDERS
            =================================================================== */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>{translations.todaysReminders}</Text>

              {reminders.length === 0 ? (
                <Card style={{ backgroundColor: colors.white, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                  <Card.Content style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <MaterialIcons name="check-circle" size={48} color={colors.status.success} />
                    <Text style={{ color: colors.text.muted, marginTop: 8 }}>{translations.noRemindersForToday || 'No reminders for today'}</Text>
                  </Card.Content>
                </Card>
              ) : reminders.map(r => (
                <Card
                  key={r.reminderId}
                  style={{ marginBottom: 12, backgroundColor: colors.white, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
                  onPress={() => handleReminderPress(r)}
                >
                  <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 }}>
                    <View style={{ width: 48, height: 48, backgroundColor: 'rgba(91, 113, 138, 0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name={getIconForReminderType(r.type)} size={24} color={colors.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: 'semibold' }}>{formatTime(r.scheduledTime)}</Text>
                      <Text style={{ fontSize: 14, color: colors.text.secondary }}>{r.title}</Text>
                    </View>

                    <MaterialIcons
                      name={r.status === 'completed' ? 'check-circle' : 'chevron-right'}
                      size={24}
                      color={r.status === 'completed' ? colors.status.success : colors.text.muted}
                    />
                  </Card.Content>
                </Card>
              ))}
            </View>

            {/* ===================================================================
                SERVICE REQUESTS
            =================================================================== */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>{translations.serviceRequests}</Text>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Card
                  style={{ flex: 1, backgroundColor: colors.white, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
                  onPress={() => router.replace('/senior/service-request')}
                >
                  <Card.Content style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <View style={{ width: 48, height: 48, backgroundColor: 'rgba(91, 113, 138, 0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                      <MaterialIcons name="add-circle" size={28} color={colors.primary} />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: 'semibold', textAlign: 'center' }}>
                      {translations.requestService}
                    </Text>
                  </Card.Content>
                </Card>

                <Card
                  style={{ flex: 1, backgroundColor: colors.white, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
                  onPress={() => router.replace('/senior/requests')}
                >
                  <Card.Content style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <View style={{ width: 48, height: 48, backgroundColor: 'rgba(91, 113, 138, 0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                      <MaterialIcons name="list-alt" size={28} color={colors.primary} />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: 'semibold', textAlign: 'center' }}>
                      {translations.viewActiveRequests}
                    </Text>
                  </Card.Content>
                </Card>
              </View>
            </View>


            {/* ===================================================================
                PANIC BUTTON
            =================================================================== */}
            <Button
              mode="contained"
              onPress={handlePanicPress}
              buttonColor={colors.status.error}
              style={{ marginBottom: 192 }}
              icon={() => <MaterialIcons name="emergency" size={28} color={colors.white} />}
              contentStyle={{ paddingVertical: 12 }}
              labelStyle={{ fontSize: 20, fontWeight: 'bold' }}
            >
              {translations.panicAlert}
            </Button>
          </>
        )}
      </ScrollView>



      {/* =========================================================
          PANIC DIALOG
      ========================================================= */}
      <Portal>
        <Dialog visible={panicDialogVisible} onDismiss={handlePanicCancel} style={{ backgroundColor: 'white' }}>
          <Dialog.Icon icon="alert" size={48} color={colors.status.error} />

          <Dialog.Title style={{ textAlign: 'center', fontWeight: 'bold' }}>
            {translations.emergencyAlert}
          </Dialog.Title>

          <Dialog.Content>
            <Text style={{ textAlign: 'center' }}>
              {translations.emergencyAlertMessage}
            </Text>
          </Dialog.Content>

          <Dialog.Actions style={{ justifyContent: 'space-around' }}>
            <Button mode="outlined" onPress={handlePanicCancel}>
              {translations.cancel}
            </Button>

            <Button mode="contained" buttonColor={colors.status.error} onPress={handlePanicConfirm}>
              {translations.sendAlert}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>



      {/* =========================================================
          REMINDER DETAILS MODAL
      ========================================================= */}
      <Portal>
        <Dialog visible={reminderModalVisible} onDismiss={() => setReminderModalVisible(false)} style={{ backgroundColor: 'white' }}>
          <Dialog.Title style={{ textAlign: 'center', fontWeight: 'bold' }}>
            {translations.reminders}
          </Dialog.Title>

          <Dialog.Content>
            {selectedReminder && (
              <View>
                {/* Icon */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    backgroundColor: '#dbeafe',
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <MaterialIcons
                      name={getIconForReminderType(selectedReminder.type)}
                      size={24}
                      color={colors.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                      {selectedReminder.title}
                    </Text>
                    <Text style={{ color: colors.text.muted }}>
                      {formatTime(selectedReminder.scheduledTime)}
                    </Text>
                  </View>
                </View>

                {/* Type */}
                <Text style={{ fontWeight: '600' }}>
                  {translations.reminderType}
                </Text>
                <Text style={{ marginBottom: 16 }}>
                  {selectedReminder.type}
                </Text>

                {/* Description */}
                {selectedReminder.description && (
                  <>
                    <Text style={{ fontWeight: '600' }}>
                      {translations.reminderDescription}
                    </Text>
                    <Text style={{ marginBottom: 16 }}>
                      {selectedReminder.description}
                    </Text>
                  </>
                )}

                {/* Status */}
                <Text style={{ fontWeight: '600' }}>
                  {translations.status}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <View style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: selectedReminder.status === 'completed'
                      ? colors.status.success
                      : colors.status.warning,
                    marginRight: 8
                  }} />
                  <Text>
                    {selectedReminder.status === 'completed' ? translations.reminderCompleted : translations.pending}
                  </Text>
                </View>
              </View>
            )}
          </Dialog.Content>

          <Dialog.Actions style={{ justifyContent: 'space-around' }}>
            <Button mode="outlined" onPress={() => setReminderModalVisible(false)}>
              {translations.cancel}
            </Button>

            {selectedReminder?.status !== 'completed' && (
              <Button mode="contained" buttonColor={colors.status.success} onPress={handleMarkReminderCompleted}>
                {translations.markCompleted}
              </Button>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <SeniorBottomNav />
    </SafeAreaView>
  );
}