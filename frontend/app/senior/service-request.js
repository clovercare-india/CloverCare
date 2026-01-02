import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import SeniorBottomNav from '../../components/SeniorBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import { colors } from '../../theme/colors';
import '../../global.css';
import { translations as translationData, loadLanguage, addLanguageChangeListener } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { createTask } from '../../firestore/seniorFirestore';

export default function ServiceRequestScreen() {
  const [dialogVisible, setDialogVisible] = useState(false);
  const [raiseRequestDialogVisible, setRaiseRequestDialogVisible] = useState(false);
  const [customRequest, setCustomRequest] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(new Date());

  // Memoize minimum date to prevent unnecessary re-renders
  const minDate = useMemo(() => new Date(), []);

  const [selectedService, setSelectedService] = useState(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const translations = translationData[currentLanguage];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, userProfile } = useAuth();

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

  const onDateChange = useCallback((event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const newDate = new Date(scheduledAt);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setScheduledAt(newDate);
    }
  }, [scheduledAt]);

  const onTimeChange = useCallback((event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDate = new Date(scheduledAt);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setScheduledAt(newDate);
    }
  }, [scheduledAt]);

  const services = [
    {
      id: 1,
      title: translations.personalCare,
      description: translations.personalCareDesc,
      icon: 'person',
      type: 'personal_care',
    },
    {
      id: 2,
      title: translations.homeAssistance,
      description: translations.homeAssistanceDesc,
      icon: 'home',
      type: 'home_assistance',
    },
    {
      id: 3,
      title: translations.transportation,
      description: translations.transportationDesc,
      icon: 'directions-car',
      type: 'transportation',
    },
    {
      id: 4,
      title: translations.nursingCare,
      description: translations.nursingCareDesc,
      icon: 'favorite',
      type: 'nursing_care',
    },
  ];

  const handleServiceRequest = (service) => {
    setSelectedService(service);
    setScheduledAt(new Date());
    setConfirmModalVisible(true);
  };

  const confirmServiceRequest = async () => {
    if (!user?.uid || !selectedService) {
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    const taskData = {
      seniorId: user.uid,
      userId: user.uid,
      createdBy: user.uid,
      title: selectedService.title,
      description: selectedService.description,
      type: selectedService.type,
      careManagerId: userProfile?.careManagerId || null,
      seniorName: userProfile?.name || 'Unknown Senior',
      scheduledAt: scheduledAt
    };

    const result = await createTask(taskData);

    if (result.success) {
      setConfirmModalVisible(false);
      setDialogVisible(true);
    }

    setIsSubmitting(false);
  };

  const handleDialogClose = () => {
    setDialogVisible(false);
    // Navigate back to dashboard after successful request
    router.replace('/senior/dashboard');
  };

  const handleRaiseRequestOpen = () => {
    setScheduledAt(new Date());
    setRaiseRequestDialogVisible(true);
  };

  const handleRaiseRequestClose = () => {
    setRaiseRequestDialogVisible(false);
    setCustomRequest('');
    setScheduledAt(new Date());
  };

  const handleRaiseRequestSubmit = async () => {
    if (!customRequest.trim()) {
      return;
    }

    if (!user?.uid) {
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    const taskData = {
      seniorId: user.uid,  // Added explicit seniorId for clarity
      userId: user.uid,
      createdBy: user.uid,
      title: customRequest.trim(),
      description: 'Custom service request',
      type: 'service_request',
      careManagerId: userProfile?.careManagerId || null,
      seniorName: userProfile?.name || 'Unknown Senior',
      scheduledAt: scheduledAt
    };

    const result = await createTask(taskData);

    if (result.success) {
      setRaiseRequestDialogVisible(false);
      setDialogVisible(true);
      setCustomRequest('');
    }

    setIsSubmitting(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.lighter }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.lighter} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1">
            {/* Header with CloverCareNavbar */}
            <View style={{ backgroundColor: colors.white, borderBottomColor: colors.border.light, borderBottomWidth: 1 }}>
              <CloverCareNavbar
                showLogo={true}
                logoSize={32}
                appName="Clover Care"
                backgroundColor="white"
                showBackButton={true}
                onBackPress={() => router.replace('/senior/dashboard')}
              />
            </View>

            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
              {/* Title */}
              <View style={{ paddingVertical: 16 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text.primary }}>{translations.requestAService}</Text>
              </View>

              {/* Services List */}
              <View className="py-2">
                {services.map((service) => (
                  <Card
                    key={service.id}
                    style={{ marginBottom: 16, backgroundColor: colors.white }}
                    onPress={() => !isSubmitting && handleServiceRequest(service)}
                    disabled={isSubmitting}
                  >
                    <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }}>
                      <View style={{ width: 56, height: 56, backgroundColor: '#E8F0F6', borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialIcons name={service.icon} size={28} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text.primary }}>
                          {service.title}
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.text.secondary, marginTop: 4 }}>
                          {service.description}
                        </Text>
                      </View>
                    </Card.Content>
                  </Card>
                ))}
              </View>

              {/* Raise a Request Button */}
              <View className="py-4 pb-32">
                <Button
                  mode="outlined"
                  onPress={handleRaiseRequestOpen}
                  buttonColor="transparent"
                  textColor={colors.primary}
                  contentStyle={{ paddingVertical: 12 }}
                  labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                  style={{ borderColor: colors.primary, borderWidth: 2 }}
                  icon={() => <MaterialIcons name="add" size={24} color={colors.primary} />}
                  disabled={isSubmitting}
                >
                  {translations.raiseARequest}
                </Button>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Confirm Service Request Modal */}
      <Portal>
        <Dialog visible={confirmModalVisible} onDismiss={() => setConfirmModalVisible(false)} style={{ backgroundColor: 'white' }}>
          <Dialog.Title style={{ fontSize: 20, fontWeight: 'bold' }}>
            Confirm Request
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 16, color: colors.text.primary, marginBottom: 8 }}>
              {selectedService?.title}
            </Text>
            <Text style={{ fontSize: 14, color: colors.text.muted, marginBottom: 16 }}>
              {selectedService?.description}
            </Text>

            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: 8 }}>
              {translations.whenIsThisRequired}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity 
                onPress={() => {
                  Keyboard.dismiss();
                  setShowDatePicker(true);
                }}
                style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border.light, backgroundColor: '#f9fafb', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ fontSize: 12, color: colors.text.primary }}>
                  {format(scheduledAt, 'MMM dd')}
                </Text>
                <MaterialIcons name="calendar-today" size={16} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => {
                  Keyboard.dismiss();
                  setShowTimePicker(true);
                }}
                style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border.light, backgroundColor: '#f9fafb', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ fontSize: 12, color: colors.text.primary }}>
                  {format(scheduledAt, 'h:mm a')}
                </Text>
                <MaterialIcons name="access-time" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={scheduledAt}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                onChange={onDateChange}
                minimumDate={minDate}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={scheduledAt}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                onChange={onTimeChange}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: 'space-around', paddingHorizontal: 8, paddingBottom: 16 }}>
            <Button
              onPress={() => setConfirmModalVisible(false)}
              mode="outlined"
              textColor={colors.text.muted}
              style={{ flex: 1, marginRight: 8 }}
              disabled={isSubmitting}
            >
              {translations.cancel}
            </Button>
            <Button
              onPress={confirmServiceRequest}
              mode="contained"
              buttonColor={colors.primary}
              style={{ flex: 1, marginLeft: 8 }}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Success Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={handleDialogClose} dismissable={false} style={{ backgroundColor: 'white' }}>
          <Dialog.Icon icon="check-circle" size={56} color={colors.status.success} />
          <Dialog.Title style={{ textAlign: 'center', fontSize: 20, fontWeight: 'bold' }}>
            {translations.serviceAddedSuccessfully}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ textAlign: 'center', fontSize: 16, color: colors.text.muted }}>
              {translations.serviceRequestSubmitted}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: 'center', paddingBottom: 16 }}>
            <Button
              onPress={() => handleDialogClose()}
              mode="contained"
              buttonColor={colors.primary}
              style={{ paddingHorizontal: 32 }}
            >
              {translations.ok}
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Raise a Request Dialog */}
        <Dialog visible={raiseRequestDialogVisible} onDismiss={handleRaiseRequestClose} style={{ backgroundColor: 'white' }}>
          <Dialog.Title style={{ fontSize: 20, fontWeight: 'bold' }}>
            {translations.raiseARequest}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 14, color: colors.text.muted, marginBottom: 12 }}>
              {translations.describeYourNeed}
            </Text>
            <TextInput
              mode="outlined"
              placeholder={translations.enterYourRequest}
              value={customRequest}
              onChangeText={setCustomRequest}
              multiline
              numberOfLines={4}
              outlineColor={colors.border.light}
              activeOutlineColor={colors.primary}
              style={{ backgroundColor: '#fff' }}
            />

            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary, marginTop: 16, marginBottom: 8 }}>
              {translations.whenIsThisRequired}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity 
                onPress={() => {
                  Keyboard.dismiss();
                  setShowDatePicker(true);
                }}
                style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border.light, backgroundColor: '#f9fafb', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ fontSize: 12, color: colors.text.primary }}>
                  {format(scheduledAt, 'MMM dd')}
                </Text>
                <MaterialIcons name="calendar-today" size={16} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => {
                  Keyboard.dismiss();
                  setShowTimePicker(true);
                }}
                style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border.light, backgroundColor: '#f9fafb', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ fontSize: 12, color: colors.text.primary }}>
                  {format(scheduledAt, 'h:mm a')}
                </Text>
                <MaterialIcons name="access-time" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={scheduledAt}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                onChange={onDateChange}
                minimumDate={minDate}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={scheduledAt}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                onChange={onTimeChange}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: 'space-around', paddingHorizontal: 8, paddingBottom: 16 }}>
            <Button
              onPress={handleRaiseRequestClose}
              mode="outlined"
              textColor={colors.text.muted}
              style={{ flex: 1, marginRight: 8 }}
              disabled={isSubmitting}
            >
              {translations.cancel}
            </Button>
            <Button
              onPress={handleRaiseRequestSubmit}
              mode="contained"
              buttonColor={colors.primary}
              style={{ flex: 1, marginLeft: 8 }}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {translations.submit}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Bottom Navigation */}
      <SeniorBottomNav />
    </SafeAreaView>
  );
}
