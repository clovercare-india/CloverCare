import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StatusBar, View, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Text } from 'react-native-paper';
import SeniorBottomNav from '../../components/SeniorBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import TaskHistoryModal from '../../components/TaskHistoryModal';
import { colors } from '../../theme/colors';
import '../../global.css';
import { translations as translationData, loadLanguage, addLanguageChangeListener } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { getTasksForSenior } from '../../firestore/seniorFirestore';
import { format } from 'date-fns';

export default function RequestsScreen() {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const { user } = useAuth();
  
  const translations = translationData[currentLanguage];
  
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Infinite scroll state
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  const loadTasks = async () => {
    const result = await getTasksForSenior(user.uid, ['pending', 'in_progress']);
    if (result.success) {
      setAllTasks(result.data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  // Load active tasks (pending and in_progress)
  useEffect(() => {
    if (!user?.uid) return;
    loadTasks();
  }, [user?.uid]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTasks();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return colors.status.success; // Green
      case 'in_progress': return colors.primary; // Primary
      case 'pending': return colors.status.warning; // Orange
      case 'cancelled': return colors.status.error; // Red
      default: return colors.text.muted;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'in_progress': return translations.inProgress || 'In Progress';
      case 'cancelled': return translations.notCompleted || 'Cancelled';
      case 'completed': return translations.completed || 'Completed';
      case 'pending': return translations.pending || 'Pending';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Infinite Scroll Handler
  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 300; // Load when 300px from bottom
    
    // Calculate if we're near the bottom
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isNearBottom) {
      // Only load if not already loading and more items exist
      if (!isLoadingMore && displayCount < allTasks.length) {
        setIsLoadingMore(true);
        // Simulate delay for smooth UX
        setTimeout(() => {
          setDisplayCount(prevCount => prevCount + 5);
          setIsLoadingMore(false);
        }, 300);
      }
    }
  };

  const getServiceIcon = (type, isTask = false) => {
    if (isTask) return 'assignment';
    
    switch (type) {
      case 'personal_care': return 'person';
      case 'home_assistance': return 'home';
      case 'transportation': return 'directions-car';
      case 'nursing_care': return 'favorite';
      case 'meal_delivery': return 'restaurant';
      case 'companionship': return 'people';
      case 'medical_appointment': return 'local-hospital';
      case 'service_request': return 'build';
      default: return 'help-outline';
    }
  };

  const getServiceTitle = (type) => {
    const titleMap = {
      'personal_care': translations.personalCare || 'Personal Care',
      'home_assistance': translations.homeAssistance || 'Home Assistance',
      'transportation': translations.transportation || 'Transportation',
      'nursing_care': translations.nursingCare || 'Nursing Care',
      'meal_delivery': translations.mealDelivery || 'Meal Delivery',
      'companionship': translations.companionship || 'Companionship',
      'medical_appointment': translations.medicalAppointment || 'Medical Appointment',
      'service_request': translations.customRequest || 'Custom Request',
    };
    return titleMap[type] || type;
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

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.lighter} />

      {/* Header with Navbar */}
      <View className="bg-white">
        <CloverCareNavbar 
          showLogo={true}
          logoSize={36}
          backgroundColor="transparent"
          appName="Clover Care"
          rightAction={{
            icon: 'history',
            onPress: () => setHistoryVisible(true),
            color: colors.primary
          }}
        />
      </View>

      <ScrollView 
        className="flex-1 px-4" 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Request a Service Button */}
        <View className="py-4">
          <Button
            mode="contained"
            onPress={() => router.replace('/senior/service-request')}
            buttonColor={colors.primary}
            contentStyle={{ paddingVertical: 12 }}
            labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
            icon={() => <MaterialIcons name="add-circle" size={24} color="#fff" />}
          >
            {translations.requestAService}
          </Button>
        </View>

        {/* Loading State */}
        {loading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-slate-500 text-base mt-4">{translations.loadingRequests}</Text>
          </View>
        ) : (
          <View className="pb-4">
            {allTasks.length === 0 ? (
              <View className="items-center justify-center py-12">
                <MaterialIcons name="inbox" size={64} color="#cbd5e1" />
                <Text className="text-slate-500 text-base mt-4">
                  {translations.noActiveRequests || 'No active requests'}
                </Text>
              </View>
            ) : (
              allTasks.slice(0, displayCount).map((task) => {
                return (
                  <Card key={task.taskId || task.id} style={{ marginBottom: 16, backgroundColor: colors.white }}>
                    <Card.Content className="py-4">
                      <View className="flex-row items-start justify-between">
                        <View className="flex-row items-start gap-3 flex-1">
                        <View style={{
                          width: 56,
                          height: 56,
                          backgroundColor: colors.background.lighter,
                          borderRadius: 28,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                            <MaterialIcons 
                              name={getServiceIcon(task.type)} 
                              size={28} 
                              color={colors.primary} 
                            />
                          </View>
                          
                          <View className="flex-1">
                            <Text className="text-lg font-semibold text-gray-900 mb-1">
                              {getServiceTitle(task.type)}
                            </Text>
                            {task.description ? (
                              <Text className="text-sm text-slate-600 mb-2">
                                {task.description}
                              </Text>
                            ) : null}
                            {task.notes ? (
                              <Text className="text-sm text-slate-600 mb-2 italic">
                                <Text className="font-bold">Notes: </Text>{task.notes}
                              </Text>
                            ) : null}

                            <Text className="text-xs text-slate-500">
                              {formatDate(task.createdAt)}
                              {formatTime(task.createdAt) && ` at ${formatTime(task.createdAt)}`}
                            </Text>

                            {task.scheduledAt && (
                              <View className="flex-row items-center gap-1 mt-2 bg-blue-50 self-start px-2 py-1 rounded">
                                <MaterialIcons name="alarm" size={14} color={colors.primary} />
                                <Text className="text-xs font-bold text-blue-700">
                                  Required: {formatDate(task.scheduledAt)} {formatTime(task.scheduledAt)}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        <View
                          style={{
                            backgroundColor: `${getStatusColor(task.status)}20`,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 100
                          }}
                        >
                          <Text
                            style={{
                              color: getStatusColor(task.status),
                              fontSize: 12,
                              fontWeight: 'bold',
                              textAlign: 'center',
                              textTransform: 'uppercase'
                            }}
                          >
                            {getStatusLabel(task.status)}
                          </Text>
                        </View>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })
            )}
            
            {/* Loading Indicator - Shows only when auto-loading more items */}
            {isLoadingMore && (
              <Card style={{ marginBottom: 16, backgroundColor: colors.white }}>
                <Card.Content style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ marginTop: 12, color: colors.text.muted }}>
                    {translations.loadingMoreItems || 'Loading more items...'}
                  </Text>
                </Card.Content>
              </Card>
            )}
          </View>
        )}

        <View className="h-24" />
      </ScrollView>

      {/* History Modal */}
      <TaskHistoryModal 
        visible={historyVisible}
        onDismiss={() => setHistoryVisible(false)}
        role="senior"
        seniors={[{ id: user.uid, name: 'Me' }]}
        translations={translations}
        user={user}
      />

      {/* Bottom Navigation */}
      <SeniorBottomNav />
    </SafeAreaView>
  );
}