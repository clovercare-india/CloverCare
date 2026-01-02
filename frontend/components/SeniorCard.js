import { MaterialIcons } from '@expo/vector-icons';
import { View, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { colors } from '../theme/colors';

export default function SeniorCard({ senior, translations, onAddRequest, onViewAlerts, onViewRoutines, onViewReminders, onViewRequests, onViewHealthLog }) {
  // Determine check-in status color and icon
  const getCheckInStatus = () => {
    switch (senior.checkInStatus) {
      case 'completed':
        return { color: '#22c55e', bgColor: '#dcfce7', icon: 'check-circle', text: translations.checkedIn };
      case 'pending':
        return { color: '#f59e0b', bgColor: '#fef3c7', icon: 'schedule', text: translations.pending };
      case 'missed':
        return { color: '#dc2626', bgColor: '#fee2e2', icon: 'cancel', text: translations.missed };
      default:
        return { color: '#64748b', bgColor: '#f1f5f9', icon: 'help', text: translations.unknown };
    }
  };

  const checkInStatus = getCheckInStatus();

  return (
    <View className="mb-4 bg-white rounded-2xl p-5 border border-gray-100">
      {/* Senior Info Header */}
      <View className="flex-row items-center mb-4">
        <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: '#5B718A' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' }}>
            {(senior.name || senior.fullName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1 ml-4">
          <Text className="text-lg font-bold text-gray-900">
            {senior.name || senior.fullName || 'Unknown Senior'}
          </Text>
          <View className="flex-row items-center mt-1">
            <MaterialIcons name="phone" size={14} color="#6b7280" />
            <Text className="text-sm text-gray-600 ml-1">
              {senior.phone || senior.phoneNumber || 'No phone'}
            </Text>
          </View>
        </View>
      </View>

      {/* Check-in Status Card */}
      <View 
        className="rounded-xl p-4 mb-4 border"
        style={{ 
          backgroundColor: checkInStatus.bgColor,
          borderColor: checkInStatus.color + '40'
        }}
      >
        <View className="flex-row items-center">
          <View 
            className="w-10 h-10 rounded-xl items-center justify-center mr-3"
            style={{ backgroundColor: checkInStatus.color + '20' }}
          >
            <MaterialIcons name={checkInStatus.icon} size={22} color={checkInStatus.color} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {translations.todaysCheckIn}
            </Text>
            <Text className="text-sm font-bold text-gray-900 mt-0.5">
              {checkInStatus.text}
            </Text>
            {senior.checkInTime && (
              <Text className="text-xs text-gray-600 mt-0.5">{senior.checkInTime}</Text>
            )}
          </View>
          {senior.mood && (
            <View 
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ 
                backgroundColor: senior.mood === 'happy' ? '#dcfce7' :
                                 senior.mood === 'okay' ? '#dbeafe' :
                                 senior.mood === 'sad' ? '#fef3c7' : '#fee2e2'
              }}
            >
              <MaterialIcons
                name={
                  senior.mood === 'happy' ? 'sentiment-satisfied' :
                  senior.mood === 'okay' ? 'sentiment-neutral' :
                  senior.mood === 'sad' ? 'sentiment-dissatisfied' : 'sick'
                }
                size={22}
                color={
                  senior.mood === 'happy' ? '#22c55e' :
                  senior.mood === 'okay' ? '#3b82f6' :
                  senior.mood === 'sad' ? '#f59e0b' : '#dc2626'
                }
              />
            </View>
          )}
        </View>
      </View>

      {/* Stats Row */}
      <View className="flex-row mb-4 gap-2">
        <TouchableOpacity 
          onPress={() => onViewRoutines && onViewRoutines(senior.id)}
          className="flex-1 rounded-xl p-3.5"
          style={{ backgroundColor: '#f3f0f7', borderColor: colors.secondary, borderWidth: 1 }}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center justify-between mb-1">
            <MaterialIcons name="notifications-active" size={18} color={colors.secondary} />
            <Text className="text-xl font-bold text-gray-900">
              {senior.pendingReminders}
            </Text>
          </View>
          <Text className="text-xs font-medium text-gray-600">Reminders</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => onAddRequest && onAddRequest(senior.id)}
          className="flex-1 rounded-xl p-3.5"
          style={{ backgroundColor: '#f0f4f7', borderColor: colors.primary, borderWidth: 1 }}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center justify-between mb-1">
            <MaterialIcons name="inbox" size={18} color={colors.primary} />
            <Text className="text-xl font-bold text-gray-900">
              {senior.activeRequests}
            </Text>
          </View>
          <Text className="text-xs font-medium text-gray-600">Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => onViewRoutines && onViewRoutines(senior.id)}
          className="flex-1 rounded-xl p-3.5"
          style={{ backgroundColor: '#fef5f5', borderColor: colors.status.error, borderWidth: 1 }}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center justify-between mb-1">
            <MaterialIcons name="favorite" size={18} color={colors.status.error} />
            <Text className="text-xs font-bold text-gray-900">
              {senior.lastHealthLog || 'N/A'}
            </Text>
          </View>
          <Text className="text-xs font-medium text-gray-600">Health Log</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View className="flex-row gap-2">
        <TouchableOpacity 
          onPress={() => onAddRequest(senior.id)}
          className="flex-1 rounded-xl py-3 items-center"
          style={{ backgroundColor: '#f0f4f7', borderColor: colors.primary, borderWidth: 1 }}
          activeOpacity={0.8}
        >
          <View className="flex-row items-center">
            <MaterialIcons name="add" size={18} color={colors.primary} />
            <Text className="font-semibold ml-1 text-sm" style={{ color: colors.primary }}>Request</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => onViewAlerts(senior.id)}
          className="flex-1 rounded-xl py-3 items-center"
          style={{ backgroundColor: '#fef9f0', borderColor: colors.status.warning, borderWidth: 1 }}
          activeOpacity={0.8}
        >
          <View className="flex-row items-center">
            <MaterialIcons name="notifications" size={18} color={colors.status.warning} />
            <Text className="font-semibold ml-1 text-sm" style={{ color: colors.status.warning }}>Alerts</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => onViewRoutines(senior.id)}
          className="flex-1 rounded-xl py-3 items-center"
          style={{ backgroundColor: '#f0f7f6', borderColor: colors.secondary, borderWidth: 1 }}
          activeOpacity={0.8}
        >
          <View className="flex-row items-center">
            <MaterialIcons name="list" size={18} color={colors.secondary} />
            <Text className="font-semibold ml-1 text-sm" style={{ color: colors.secondary }}>Routines</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}