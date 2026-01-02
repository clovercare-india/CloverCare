import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, StatusBar, TouchableOpacity, View, Alert, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native-paper';
import { colors } from '../../theme/colors';
import '../../global.css';
import { getHealthLogsForLinkedSenior } from '../../firestore/familyFirestore';

export default function HealthLogsScreen() {
  const { seniorId, seniorName } = useLocalSearchParams();
  
  const [healthLogs, setHealthLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState([]);
  
  // Pagination
  const [page, setPage] = useState(1);
  const logsPerPage = 7;
  
  // Filter states
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  // Compute filtered and displayed logs instead of storing state
  const getFilteredLogs = () => {
    let filtered = [...healthLogs];

    // Apply date filter
    if (selectedFilter !== 'all') {
      const now = new Date();
      const daysMap = { '7days': 7, '30days': 30, '90days': 90 };
      const days = daysMap[selectedFilter];
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      filtered = filtered.filter(log => {
        const logDate = log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt);
        return logDate >= cutoffDate;
      });
    }

    // Apply sort order
    filtered.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  };

  const filteredLogs = getFilteredLogs();
  const displayedLogs = filteredLogs.slice(0, page * logsPerPage);

  // Fetch health logs
  const fetchHealthLogs = useCallback(async () => {
    try {
      if (!seniorId) {
        setLoading(false);
        return;
      }

      const result = await getHealthLogsForLinkedSenior(seniorId, 365);
      
      if (result.success) {
        const logs = result.logs || result.data || [];
        setHealthLogs(logs);
      } else {
        Alert.alert('Error', 'Failed to load health logs');
      }
    } catch (err) {
      Alert.alert('Error', 'An error occurred while loading health logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seniorId]);

  // Initial load
  useEffect(() => {
    fetchHealthLogs();
  }, [fetchHealthLogs]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHealthLogs();
  };

  // Load more logs
  const handleLoadMore = () => {
    if (displayedLogs.length < filteredLogs.length) {
      setPage(prev => prev + 1);
    }
  };

  // Toggle log expansion
  const toggleLogExpansion = (logId) => {
    setExpandedLogs(prev => 
      prev.includes(logId) 
        ? prev.filter(id => id !== logId)
        : [...prev, logId]
    );
  };

  // Format date/time
  const formatLogTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });

    let relativeStr = '';
    if (diffMins < 60) {
      relativeStr = `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      relativeStr = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      relativeStr = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      relativeStr = dateStr;
    }

    return `${timeStr} • ${relativeStr}`;
  };

  // Get filter label
  const getFilterLabel = () => {
    const labels = {
      'all': 'All Time',
      '7days': 'Last 7 Days',
      '30days': 'Last 30 Days',
      '90days': 'Last 90 Days'
    };
    return labels[selectedFilter];
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-base text-gray-600">Loading health logs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#f9fafb' }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View className="px-4 py-4" style={{ backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', zIndex: 100, overflow: 'visible' }}>
        <View className="flex-row items-center mb-3">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="mr-3 rounded-full items-center justify-center"
            style={{ width: 36, height: 36, backgroundColor: colors.background.lighter }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.primary} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold" style={{ color: colors.text.dark }}>Health Logs</Text>
            <Text className="text-sm mt-0.5" style={{ color: colors.text.muted }}>{seniorName || 'Senior'}</Text>
          </View>
        </View>

        {/* Filters Bar */}
        <View className="flex-row items-center justify-between mt-2" style={{ zIndex: 100, overflow: 'visible' }}>
          <View className="flex-row items-center gap-2">
            <View className="relative">
              <TouchableOpacity 
                onPress={() => setFilterMenuVisible(!filterMenuVisible)}
                className="flex-row items-center px-3 py-2 rounded-lg"
                style={{ backgroundColor: '#f0f4f7', borderWidth: 1, borderColor: colors.primary }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="filter-list" size={16} color={colors.primary} />
                <Text className="text-xs font-bold ml-1" style={{ color: colors.primary }}>
                  {getFilterLabel()}
                </Text>
                <MaterialIcons name={filterMenuVisible ? "arrow-drop-up" : "arrow-drop-down"} size={16} color={colors.primary} />
              </TouchableOpacity>

              {filterMenuVisible && (
                <View style={{ 
                  marginTop: 4, 
                  backgroundColor: 'white', 
                  borderWidth: 1, 
                  borderColor: '#e5e7eb', 
                  borderRadius: 12, 
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 8,
                  zIndex: 1000,
                  position: 'absolute',
                  top: 35,
                  left: 0,
                  width: 160
                }}>
                  {[
                    { id: 'all', label: 'All Time' },
                    { id: '7days', label: 'Last 7 Days' },
                    { id: '30days', label: 'Last 30 Days' },
                    { id: '90days', label: 'Last 90 Days' }
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => {
                        setSelectedFilter(item.id);
                        setFilterMenuVisible(false);
                      }}
                      style={{ 
                        padding: 12, 
                        flexDirection: 'row', 
                        alignItems: 'center',
                        backgroundColor: selectedFilter === item.id ? colors.primary + '10' : 'transparent',
                        borderBottomWidth: 1,
                        borderBottomColor: '#f1f5f9'
                      }}
                    >
                      {selectedFilter === item.id && (
                        <MaterialIcons name="check" size={14} color={colors.primary} style={{ marginRight: 8 }} />
                      )}
                      <Text style={{ 
                        color: selectedFilter === item.id ? colors.primary : colors.text.dark,
                        fontWeight: selectedFilter === item.id ? 'bold' : 'normal',
                        fontSize: 13,
                        marginLeft: selectedFilter === item.id ? 0 : 22
                      }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity 
              onPress={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="flex-row items-center px-3 py-2 rounded-lg"
              style={{ backgroundColor: '#f0f7f6', borderWidth: 1, borderColor: colors.secondary }}
              activeOpacity={0.7}
            >
              <MaterialIcons 
                name={sortOrder === 'newest' ? 'arrow-downward' : 'arrow-upward'} 
                size={14} 
                color={colors.secondary} 
              />
              <Text className="text-xs font-bold ml-1" style={{ color: colors.secondary }}>
                {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="px-2 py-1 rounded-full" style={{ backgroundColor: '#f0f4f7' }}>
            <Text className="text-xs font-bold" style={{ color: colors.primary }}>
              {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Health Logs List */}
      <ScrollView 
        className="flex-1"
        style={{ backgroundColor: '#f9fafb' }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View className="px-4 pt-4 pb-6">
          {displayedLogs.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center">
              <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: '#fef2f2' }}>
                <MaterialIcons name="favorite" size={32} color="#ef4444" />
              </View>
              <Text className="text-gray-900 font-bold text-lg">No Health Logs</Text>
              <Text className="text-gray-600 mt-1 text-center">
                {selectedFilter === 'all' 
                  ? 'No health records found'
                  : `No health records found for ${getFilterLabel().toLowerCase()}`
                }
              </Text>
            </View>
          ) : (
            <>
              {displayedLogs.map((log, logIndex) => {
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
                            <View className="flex-1">
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
                          <View className="mb-2">
                            <View className="flex-row mb-2">
                              <View className="flex-1 rounded-lg p-2.5 mr-2" style={{ backgroundColor: '#fef2f2' }}>
                                <View className="flex-row items-center mb-1">
                                  <MaterialIcons name="favorite" size={14} color="#ef4444" />
                                  <Text className="text-xs font-semibold ml-1 text-gray-600">BP</Text>
                                </View>
                                <Text className="text-sm font-bold text-gray-900">
                                  {typeof log.vitals.bloodPressure === 'string' || typeof log.vitals.bloodPressure === 'number' ? String(log.vitals.bloodPressure) : 'N/A'}
                                </Text>
                              </View>

                              <View className="flex-1 rounded-lg p-2.5" style={{ backgroundColor: '#fffbeb' }}>
                                <View className="flex-row items-center mb-1">
                                  <MaterialIcons name="water-drop" size={14} color="#f59e0b" />
                                  <Text className="text-xs font-semibold ml-1 text-gray-600">Sugar</Text>
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
                                    <Text className="text-xs font-semibold ml-1 text-gray-600">Temperature</Text>
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
                              <View className="mb-3 bg-gray-50 rounded-lg p-3">
                                <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                  Notes
                                </Text>
                                <Text className="text-sm text-gray-700 leading-5">
                                  {String(log.notes || '')}
                                </Text>
                              </View>
                            )}
                            
                            {log.loggedBy && (
                              <View className="bg-gray-50 rounded-lg p-3">
                                <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">
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

              {/* Load More Button */}
              {displayedLogs.length < filteredLogs.length && (
                <TouchableOpacity 
                  onPress={handleLoadMore}
                  className="rounded-xl py-3 items-center mt-2 mb-4"
                  style={{ backgroundColor: '#f0f4f7', borderWidth: 1, borderColor: colors.primary }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <MaterialIcons name="expand-more" size={20} color={colors.primary} />
                    <Text className="font-bold text-sm ml-2" style={{ color: colors.primary }}>
                      Load More ({filteredLogs.length - displayedLogs.length} remaining)
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {displayedLogs.length === filteredLogs.length && filteredLogs.length > 0 && (
                <View className="py-4 items-center">
                  <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: '#f0f4f7' }}>
                    <Text className="text-xs font-semibold" style={{ color: colors.text.muted }}>
                      ✓ All logs loaded • {filteredLogs.length} total
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
