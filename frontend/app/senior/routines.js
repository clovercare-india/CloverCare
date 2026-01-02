import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { ScrollView, StatusBar, View, Alert, Platform, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Checkbox,
  Dialog,
  Portal,
  Text,
  ActivityIndicator,
} from "react-native-paper";
import SeniorBottomNav from "../../components/SeniorBottomNav";
import CloverCareNavbar from "../../components/CloverCareNavbar";
import SeniorHistoryModal from "../../components/SeniorHistoryModal";
import { colors } from "../../theme/colors";
import "../../global.css";
import {
  translations as translationData,
  loadLanguage,
  addLanguageChangeListener,
} from "../../utils/i18n";
import { useAuth } from "../../contexts/AuthContext";
import {
  getRoutinesForSenior,
  createRoutineLog,
  getAllRemindersForSenior,
  updateReminderStatus,
} from "../../firestore/seniorFirestore";

// Helper function to convert time string to minutes for sorting
const timeToMinutes = (timeString) => {
  if (!timeString) return 0;
  
  // Clean the string and split by any whitespace
  const cleanTime = timeString.toString().trim().replace(/\s+/g, ' ');
  
  // Split by space to get time and period
  const parts = cleanTime.split(' ');
  
  if (parts.length !== 2) {
    return 0;
  }
  
  const [time, period] = parts;
  
  // Split time by colon
  const timeParts = time.split(":");
  if (timeParts.length !== 2) {
    return 0;
  }
  
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes)) {
    return 0;
  }
  
  let totalMinutes = hours * 60 + minutes;

  if (period === "PM" && hours !== 12) {
    totalMinutes += 12 * 60;
  } else if (period === "AM" && hours === 12) {
    totalMinutes = minutes; // 12 AM is 0 hours + minutes
  }

  return totalMinutes;
};

// Helper function to reorder tasks by status and time
const reorderTasks = (tasks) => {
  return tasks.sort((a, b) => {
    // First sort by status: pending first, then missed, then completed last
    const statusOrder = { pending: 0, missed: 1, completed: 2 };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    
    // Within same status, sort by time (AM first, then PM - earliest to latest)
    const timeA = timeToMinutes(a.time);
    const timeB = timeToMinutes(b.time);
    return timeA - timeB;
  });
};

export default function RoutinesScreen() {
  const { userProfile } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const translations = translationData[currentLanguage];
  const [forgotDialogVisible, setForgotDialogVisible] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState(null);
  const [completedTaskId, setCompletedTaskId] = useState(null);
  const [strikeThroughTasks, setStrikeThroughTasks] = useState(new Set());
  const [routines, setRoutines] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingTasks, setUpdatingTasks] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [itemListType, setItemListType] = useState('routines');
  const [historyVisible, setHistoryVisible] = useState(false);

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

  // Fetch routines from Firestore
  useEffect(() => {
    const fetchRoutines = async () => {
      if (!userProfile?.userId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      // Clear previous state to avoid showing stale data
      setRoutines([]);
      setStrikeThroughTasks(new Set());
      setUpdatingTasks(new Set());

      try {
        // Fetch routines
        const result = await getRoutinesForSenior(userProfile.userId);

        if (result.success) {
          

          // Format routines for display
          const formattedRoutines = result.routines.map((routine) => ({
            id: routine.routineId,
            time: formatTime(routine.scheduledTime),
            title: routine.title,
            status: routine.status || "pending",
            icon: getIconForRoutineType(routine.type),
            routineId: routine.routineId,
            notes: routine.notes || routine.description || '',
          }));

          // Apply sorting to ensure proper order on initial load
          const sortedRoutines = reorderTasks(formattedRoutines);
          setRoutines(sortedRoutines);

          // Set strike-through for completed routines using the sorted data
          const completedIds = sortedRoutines
            .filter((r) => r.status === "completed")
            .map((r) => r.id);
          setStrikeThroughTasks(new Set(completedIds));
        } else {
          Alert.alert('Error', 'Failed to load routines');
        }

        // Fetch reminders
        const remindersResult = await getAllRemindersForSenior(userProfile.userId);
        if (remindersResult.success) {
          setReminders(remindersResult.reminders);
        } else {
          setReminders([]);
        }
      } catch (_error) {
      } finally {
        setLoading(false);
      }
    };

    fetchRoutines();
  }, [userProfile]);



  // Helper function to format time
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Helper function to get icon for routine type
  const getIconForRoutineType = (type) => {
    const iconMap = {
      medication: "medication",
      meal: "restaurant",
      exercise: "directions-walk",
      therapy: "accessible",
      custom: "task-alt",
    };
    return iconMap[type] || "task-alt";
  };

  const handleToggleStatus = async (id) => {
    if (!userProfile?.userId) {
      return;
    }

    // Prevent multiple simultaneous updates on the same task
    if (updatingTasks.has(id)) {
      return;
    }

    const routine = routines.find((r) => r.id === id);
    if (!routine) {
      return;
    }

    // Only allow completing pending tasks
    // Once completed or missed, cannot be toggled back
    if (routine.status === "completed" || routine.status === "missed") {
      return;
    }

    const newStatus = "completed";

    // Mark this task as being updated
    setUpdatingTasks(prev => new Set([...prev, id]));

    // Store original states for potential revert
    const originalStrikeThroughTasks = new Set(strikeThroughTasks);
    const originalCompletedTaskId = completedTaskId;
    const originalRoutines = [...routines];

    try {
      // Update UI immediately
      setRoutines((prev) => {
        const updated = prev.map((r) =>
          r.id === id ? { ...r, status: newStatus } : r
        );
        return reorderTasks(updated);
      });

      // Handle animations - only for completing
      setCompletedTaskId(id);
      setStrikeThroughTasks((prev) => new Set([...prev, id]));
      setTimeout(() => setCompletedTaskId(null), 2500);

      // Log to Firestore
      const result = await createRoutineLog(
        userProfile.userId,
        routine.routineId,
        newStatus
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to update routine status");
      }
    } catch (error) {
      // Revert all UI changes on error
      setRoutines(reorderTasks(originalRoutines));
      setStrikeThroughTasks(originalStrikeThroughTasks);
      setCompletedTaskId(originalCompletedTaskId);
      
      Alert.alert("Error", error.message || "Failed to update routine status");
    } finally {
      // Remove task from updating set
      setUpdatingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleForgotPress = (id) => {
    setSelectedRoutineId(id);
    setForgotDialogVisible(true);
  };

  const handleForgotConfirm = async () => {
    if (!userProfile?.userId) {
      setForgotDialogVisible(false);
      return;
    }

    const routine = routines.find((r) => r.id === selectedRoutineId);
    if (!routine) {
      setForgotDialogVisible(false);
      return;
    }

    // Store original states for potential revert
    const originalStrikeThroughTasks = new Set(strikeThroughTasks);
    const originalStatus = routine.status;

    // Update UI
    setRoutines((prev) => {
      const updated = prev.map((r) =>
        r.id === selectedRoutineId ? { ...r, status: "missed" } : r
      );
      return reorderTasks(updated);
    });

    setStrikeThroughTasks((prev) => {
      const newSet = new Set(prev);
      newSet.delete(selectedRoutineId);
      return newSet;
    });

    // Log to Firestore
    const result = await createRoutineLog(
      userProfile.userId,
      routine.routineId,
      "missed"
    );

    if (!result.success) {
      // Revert all UI changes on error
      setRoutines((prev) => {
        const reverted = prev.map((r) =>
          r.id === selectedRoutineId ? { ...r, status: originalStatus } : r
        );
        return reorderTasks(reverted);
      });
      setStrikeThroughTasks(originalStrikeThroughTasks);
      Alert.alert("Error", result.error || "Failed to update routine status");
    }

    setForgotDialogVisible(false);
    setSelectedRoutineId(null);
  };

  const handleForgotCancel = () => {
    setForgotDialogVisible(false);
    setSelectedRoutineId(null);
  };

  const handleRaiseRequest = () => {
    router.replace("/senior/service-request");
  };

  const handleCompleteReminder = async (reminderId) => {
    const result = await updateReminderStatus(reminderId, 'completed');
    if (result.success) {
      // Update reminder status to completed instead of removing it
      setReminders(prev => prev.map(r => 
        r.reminderId === reminderId ? { ...r, status: 'completed' } : r
      ));
    } else {
      Alert.alert("Error", result.error || "Failed to update reminder");
    }
  };

  const formatReminderTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTextOpacity = (status) => {
    return status === "pending" ? 1 : 0.85; // Slightly dim text on colored backgrounds
  };

  const filterItems = (items) => {
    // Always filter out completed and missed items from the main view
    const activeItems = items.filter(item => 
      item.status !== 'completed' && item.status !== 'missed'
    );
    
    if (selectedFilter === 'all') {
      return activeItems;
    }
    return activeItems.filter(item => item.status === selectedFilter);
  };

  const filteredRoutines = filterItems(routines);
  const filteredReminders = reminders.filter(r => 
    r.status !== 'completed' && r.status !== 'missed'
  );

  // Map status to theme colors - single source of truth
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return {
          bg: colors.status.success,      // Teal (#8DAAA5) - from theme
          text: colors.text.dark,          // Dark gray (#2C3E50) - from theme
          border: colors.border.default,   // Teal border (#8DAAA5) - from theme
          icon: '#FFFFFF',                 // White icon for visibility on teal
        };
      case 'missed':
        return {
          bg: colors.status.error,         // Red (#E63946) - from theme
          text: colors.text.light,         // Light text (#FFFFFF) - from theme
          border: colors.status.error,     // Red border (#E63946) - from theme
          icon: '#FFFFFF',                 // White icon for visibility on red
        };
      case 'pending':
        return {
          bg: colors.status.warning,       // Golden yellow (#F7BC20) - from theme
          text: '#854d0e',                 // Dark brown - better contrast on yellow
          border: colors.status.warning,   // Yellow border (#F7BC20) - from theme
          icon: '#854d0e',                 // Dark brown icon for visibility on yellow
        };
      default:
        return {
          bg: colors.background.lighter,   // Light gray (#F8FAFC) - from theme
          text: colors.text.muted,         // Muted gray (#7A8FA3) - from theme
          border: colors.border.subtle,    // Subtle border (#E8EEF2) - from theme
          icon: colors.text.muted,         // Muted gray icon
        };
    }
  };

  // Memoized function to get card styling - moved outside map to avoid recreation
  const getCardStyle = useCallback((status) => {
    const statusColor = getStatusColor(status);
    return {
      borderWidth: 1,
      borderColor: statusColor.border,
      backgroundColor: colors.background.light,
    };
  }, []);

  // Tab button styling helper
  const getTabButtonStyles = (isActive, tabType) => {
    const isRoutines = tabType === 'routines';
    const borderColor = isActive ? (isRoutines ? colors.primary : colors.accent) : colors.border.subtle;
    const backgroundColor = isActive ? (isRoutines ? '#f0f4f7' : colors.background.accent) : colors.background.light;
    const textColor = isActive ? colors.text.dark : colors.text.muted;
    const iconColor = isActive ? (isRoutines ? colors.primary : colors.accent) : colors.text.muted;
    const secondaryTextColor = isActive ? (isRoutines ? colors.primary : colors.accent) : colors.border.subtle;

    return {
      containerStyle: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: borderColor,
        backgroundColor: backgroundColor,
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
      },
      iconColor: iconColor,
      textColor: textColor,
      secondaryTextColor: secondaryTextColor
    };
  };

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.lighter }}>
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
                  onPress: () => setHistoryVisible(true),
                  color: colors.primary
                }}
              />
            </View>
          </View>
        </View>

        {/* Filter Controls Section */}
        <View className="px-4 pt-4 pb-4 bg-white">
          {/* Items Dropdown - toggle between routines & reminders */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Routines Button */}
              {(() => {
                const isActive = itemListType === 'routines';
                const styles = getTabButtonStyles(isActive, 'routines');
                return (
                  <TouchableOpacity
                    onPress={() => setItemListType('routines')}
                    activeOpacity={0.7}
                    style={styles.containerStyle}
                  >
                    <MaterialIcons
                      name="schedule"
                      size={20}
                      color={styles.iconColor}
                      style={{ marginRight: 8 }}
                    />
                    <View>
                      <Text style={{
                        color: styles.textColor,
                        fontWeight: isActive ? '600' : '500',
                        fontSize: 13
                      }}>
                        Routines
                      </Text>
                      <Text style={{
                        color: styles.secondaryTextColor,
                        fontSize: 10,
                        marginTop: 2
                      }}>
                        {filteredRoutines.length} items
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })()}

              {/* Reminders Button */}
              {(() => {
                const isActive = itemListType === 'reminders';
                const styles = getTabButtonStyles(isActive, 'reminders');
                return (
                  <TouchableOpacity
                    onPress={() => setItemListType('reminders')}
                    activeOpacity={0.7}
                    style={styles.containerStyle}
                  >
                    <MaterialIcons
                      name="notifications-active"
                      size={20}
                      color={styles.iconColor}
                      style={{ marginRight: 8 }}
                    />
                    <View>
                      <Text style={{
                        color: styles.textColor,
                        fontWeight: isActive ? '600' : '500',
                        fontSize: 13
                      }}>
                        Reminders
                      </Text>
                      <Text style={{
                        color: styles.secondaryTextColor,
                        fontSize: 10,
                        marginTop: 2
                      }}>
                        {filteredReminders.length} items
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })()}
            </View>
        </View>

      <ScrollView 
        className="flex-1 bg-gray-50" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              // Re-fetch from Firestore to get latest data
              if (userProfile?.userId) {
                  try {
                  const result = await getRoutinesForSenior(userProfile.userId, true);
                  if (result.success) {
                    const formattedRoutines = result.routines.map((routine) => ({
                      id: routine.routineId,
                      time: formatTime(routine.scheduledTime),
                      title: routine.title,
                      status: routine.status || "pending",
                      icon: getIconForRoutineType(routine.type),
                      routineId: routine.routineId,
                      notes: routine.notes || routine.description || '',
                    }));
                    
                    const sortedRoutines = reorderTasks(formattedRoutines);
                    
                    setRoutines(sortedRoutines);
                    const completedIds = sortedRoutines.filter((r) => r.status === "completed").map((r) => r.id);
                    setStrikeThroughTasks(new Set(completedIds));
                  }
                } catch (error) {
                  // Error during refresh silently handled
                }
              }
              setRefreshing(false);
            }}
            colors={[colors.primary]}
          />
        }
      >
        {/* Loading State */}
        {loading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-gray-500 mt-4">{translations.loadingRoutines}</Text>
          </View>
        ) : itemListType === 'routines' ? (
          // Show routines only
          filteredRoutines.length === 0 ? (
            <View className="px-6 pt-12">
              <View 
                className="items-center rounded-3xl p-8"
                style={{
                  backgroundColor: 'white',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                <View 
                  className="w-24 h-24 rounded-3xl items-center justify-center mb-6"
                  style={{
                    backgroundColor: '#e0f2fe',
                    shadowColor: '#5B718A',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <MaterialIcons name="event-available" size={56} color="#5B718A" />
                </View>
                <Text className="text-xl font-bold text-gray-900 text-center">
                  {selectedFilter === 'all' ? translations.noRoutinesToday : `No ${selectedFilter} routines`}
                </Text>
                <Text className="text-sm text-gray-600 text-center mt-3 leading-6">
                  {selectedFilter === 'all' ? translations.youHaveNoRoutinesScheduledForToday : `You have no ${selectedFilter} routines at the moment.`}
                </Text>
              </View>
            </View>
          ) : (
            <View className="px-6 pb-6">
              <Text className="text-lg font-bold text-gray-900 mb-4">
                {itemListType === 'routines' ? translations.yourRoutines : (translations.reminders || "Reminders")}
              </Text>
              {filteredRoutines.map((routine, index) => {
                const statusColor = getStatusColor(routine.status);
                
                return (
                <View
                  key={routine.id}
                  className="mb-4 rounded-2xl p-5"
                  style={getCardStyle(routine.status)}
                >
                  {/* Top Section: Icon + Title + Time */}
                  <View className="flex-row items-start mb-4">
                    <View 
                      className="w-14 h-14 rounded-xl items-center justify-center mr-4"
                      style={{
                        backgroundColor: statusColor.bg,
                      }}
                    >
                      <MaterialIcons
                        name={routine.icon}
                        size={28}
                        color={statusColor.icon}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-base font-semibold text-gray-900"
                        style={{
                          opacity: getTextOpacity(routine.status),
                        }}
                      >
                        {routine.title}
                      </Text>
                      <View className="flex-row items-center mt-2">
                        <MaterialIcons name="access-time" size={14} color="#9ca3af" />
                        <Text
                          className="text-sm text-gray-500 ml-1"
                          style={{
                            opacity: getTextOpacity(routine.status),
                          }}
                        >
                          {routine.time}
                        </Text>
                        <View 
                          className="ml-2 px-2.5 py-0.5 rounded-md"
                          style={{
                            backgroundColor: statusColor.bg,
                          }}
                        >
                          <Text 
                            className="text-xs font-semibold"
                            style={{
                              color: statusColor.text,
                            }}
                          >
                            {routine.status.charAt(0).toUpperCase() + routine.status.slice(1)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Notes Section */}
                  {routine.notes && (
                    <View className="mb-3">
                      <Text 
                        className="text-sm text-gray-600 leading-5"
                        style={{
                          opacity: getTextOpacity(routine.status),
                        }}
                      >
                        {routine.notes}
                      </Text>
                    </View>
                  )}

                  {/* Bottom Section: Buttons + Checkbox */}
                  <View className="flex-row items-center justify-between pt-3"
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: '#f1f5f9',
                    }}
                  >
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <Button
                        mode="text"
                        onPress={() => handleForgotPress(routine.id)}
                        textColor="#64748b"
                        compact
                        disabled={
                          routine.status === "completed" ||
                          routine.status === "missed"
                        }
                        style={{ 
                          opacity: getTextOpacity(routine.status),
                        }}
                        labelStyle={{ fontSize: 13, fontWeight: '600' }}
                      >
                        {translations.missed}
                      </Button>
                      <Button
                        mode="contained"
                        onPress={handleRaiseRequest}
                        buttonColor="#5B718A"
                        compact
                        labelStyle={{ fontSize: 13, fontWeight: '600' }}
                        style={{ 
                          opacity: getTextOpacity(routine.status),
                          borderRadius: 8,
                        }}
                      >
                        {translations.raiseRequest}
                      </Button>
                    </View>
                    <Checkbox
                      status={
                        updatingTasks.has(routine.id) 
                          ? "indeterminate"
                          : routine.status === "completed"
                          ? "checked"
                          : "unchecked"
                      }
                      onPress={() => handleToggleStatus(routine.id)}
                      color="#22c55e"
                      disabled={routine.status === "completed" || routine.status === "missed" || updatingTasks.has(routine.id)}
                      style={{ opacity: getTextOpacity(routine.status) }}
                    />
                  </View>
                </View>
                );
              })}
            </View>
          )
        ) : (
          // Show reminders only
          filteredReminders.length === 0 ? (
            <View className="px-6 pt-12">
              <View 
                className="items-center rounded-3xl p-8"
                style={{
                  backgroundColor: 'white',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                <View 
                  className="w-24 h-24 rounded-3xl items-center justify-center mb-6"
                  style={{
                    backgroundColor: '#fef3c7',
                    shadowColor: '#F7BC20',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <MaterialIcons name="notifications-none" size={56} color="#F7BC20" />
                </View>
                <Text className="text-xl font-bold text-gray-900 text-center">
                  {selectedFilter === 'all' 
                    ? translations.noRemindersTitle 
                    : translations.noFilteredRemindersTitle?.replace('{filter}', selectedFilter) || `No ${selectedFilter} reminders`
                  }
                </Text>
                <Text className="text-sm text-gray-600 text-center mt-3 leading-6">
                  {selectedFilter === 'all' 
                    ? translations.noRemindersDesc 
                    : translations.noFilteredRemindersDesc?.replace('{filter}', selectedFilter) || `You have no ${selectedFilter} reminders.`
                  }
                </Text>
              </View>
            </View>
          ) : (
            <View className="px-6 pb-6">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-gray-900">
                  {translations.yourReminders || "Your Reminders"}
                </Text>
                <View 
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: '#fff7ed' }}
                >
                  <Text className="text-xs font-bold text-orange-600">
                    {filteredReminders.length}
                  </Text>
                </View>
              </View>
              {filteredReminders.map((reminder, index) => {
                const statusColor = getStatusColor(reminder.status);
                
                return (
                <View
                  key={reminder.reminderId}
                  className="mb-4 rounded-2xl p-5"
                  style={getCardStyle(reminder.status)}
                >
                  {/* Top Section: Icon + Title + Time */}
                  <View className="flex-row items-start mb-4">
                    <View 
                      className="w-14 h-14 rounded-xl items-center justify-center mr-4"
                      style={{
                        backgroundColor: statusColor.bg,
                      }}
                    >
                      <MaterialIcons
                        name="notifications-active"
                        size={28}
                        color={statusColor.icon}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-base font-semibold text-gray-900"
                        style={{
                          opacity: getTextOpacity(reminder.status),
                        }}
                      >
                        {reminder.title}
                      </Text>
                      <View className="flex-row items-center mt-2">
                        <MaterialIcons name="access-time" size={14} color="#9ca3af" />
                        <Text
                          className="text-sm text-gray-500 ml-1"
                          style={{
                            opacity: getTextOpacity(reminder.status),
                          }}
                        >
                          {formatReminderTime(reminder.scheduledTime)}
                        </Text>
                        <View 
                          className="ml-2 px-2.5 py-0.5 rounded-md"
                          style={{
                            backgroundColor: statusColor.bg,
                          }}
                        >
                          <Text 
                            className="text-xs font-semibold"
                            style={{
                              color: statusColor.text,
                            }}
                          >
                            {reminder.status.charAt(0).toUpperCase() + reminder.status.slice(1)}
                          </Text>
                        </View>
                      </View>
                      {/* Description inline */}
                      {reminder.description && (
                        <Text 
                          className="text-sm text-gray-600 leading-5 mt-2"
                          style={{
                            opacity: getTextOpacity(reminder.status),
                          }}
                          numberOfLines={3}
                        >
                          {reminder.description}
                        </Text>
                      )}
                    </View>
                    {/* Done Button on the right */}
                    {reminder.status !== "completed" && reminder.status !== "missed" && (
                      <Button
                        mode="contained"
                        onPress={() => handleCompleteReminder(reminder.reminderId)}
                        buttonColor="#22c55e"
                        compact
                        labelStyle={{ fontSize: 13, fontWeight: '600' }}
                        style={{ 
                          borderRadius: 8,
                          marginLeft: 8,
                        }}
                      >
                        {translations.done}
                      </Button>
                    )}
                  </View>
                </View>
                );
              })}
            </View>
          )
        )}
      </ScrollView>

      {/* Forgot Dialog */}
      <Portal>
        <Dialog visible={forgotDialogVisible} onDismiss={handleForgotCancel} style={{ backgroundColor: 'white' }}>
          <Dialog.Icon icon="help-circle" size={48} color="#f59e0b" />
          <Dialog.Title
            style={{ textAlign: "center", fontSize: 20, fontWeight: "bold" }}
          >
            {translations.missedThisTask}
          </Dialog.Title>
          <Dialog.Content>
            <Text
              style={{ textAlign: "center", fontSize: 16, color: "#64748b" }}
            >
              {translations.thisWillMarkTheTaskAsMissed}
            </Text>
          </Dialog.Content>
          <Dialog.Actions
            style={{ justifyContent: "space-around", paddingHorizontal: 8 }}
          >
            <Button
              onPress={handleForgotCancel}
              mode="outlined"
              textColor="#64748b"
              style={{ flex: 1, marginRight: 8 }}
            >
              {translations.cancel}
            </Button>
            <Button
              onPress={handleForgotConfirm}
              mode="contained"
              buttonColor="#f59e0b"
              style={{ flex: 1, marginLeft: 8 }}
            >
              {translations.yesMissed}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* History Modal */}
      <SeniorHistoryModal 
        visible={historyVisible}
        onDismiss={() => setHistoryVisible(false)}
        historyType={itemListType}
        userId={userProfile?.userId}
        translations={translations}
      />
      </SafeAreaView>

      {/* Bottom Navigation */}
      <SeniorBottomNav />
    </View>
  );
}