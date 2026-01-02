import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, firestore } from '../../config/firebase';
import { PhoneAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { setTempData } from '../../utils/tempStorage';
import { 
  collection, 
  doc, 
  getDocs,
  updateDoc,
  deleteDoc,
  query, 
  where,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import { translations as translationData, loadLanguage } from '../../utils/i18n';
import { sendOTP, getUserProfile, createUserProfile, signOut } from '../../services/auth';

export default function CareManagerVerifyOTPScreen() {
  const params = useLocalSearchParams();
  const { phoneNumber, callingCode, confirmationResult } = params;

  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translations, setTranslations] = useState(translationData.en);
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6 digits for Firebase
  const [resendTimer, setResendTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [verificationId, setVerificationId] = useState(null);
  
  // Refs for OTP inputs (6 inputs)
  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ];

  // Load saved language preference
  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  // Update translations when language changes
  useEffect(() => {
    setTranslations(translationData[currentLanguage]);
  }, [currentLanguage]);

  // Parse verification ID from confirmation result
  useEffect(() => {
    if (confirmationResult) {
      try {
        const parsed = JSON.parse(confirmationResult);
        setVerificationId(parsed.verificationId);
      } catch (_error) {
      }
    }
  }, [confirmationResult]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);


  // Handle OTP input change
  const handleOtpChange = (value, index) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-verify when all 6 digits are entered
    if (index === 5 && value) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerifyOTP(fullOtp);
      }
    }
  };

  // Handle backspace
  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  // Handle Verify OTP
  const handleVerifyOTP = async (otpCode) => {
    const fullOtp = otpCode || otp.join('');
    
    if (fullOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP');
      return;
    }

    if (!verificationId) {
      Alert.alert('Error', 'Verification session expired. Please request a new OTP.');
      return;
    }

    setLoading(true);

    try {
      const credential = PhoneAuthProvider.credential(verificationId, fullOtp);
      const result = await signInWithCredential(auth, credential);
      
      // Store auth credentials in tempStorage for potential re-authentication
      setTempData('caremanagerAuthPhone', result.user.phoneNumber);
      setTempData('caremanagerAuthVerificationId', verificationId);
      setTempData('caremanagerAuthOtp', fullOtp);
      
      // Validate if user is a registered care manager
      
      const usersRef = collection(firestore, 'users');
      const cmQuery = query(
        usersRef,
        where('phone', '==', result.user.phoneNumber),
        where('role', '==', 'caremanager')
      );
      
      const cmSnapshot = await getDocs(cmQuery);
      
      if (cmSnapshot.empty) {
        Alert.alert(
          'Access Denied',
          'You are not registered as a Care Manager. Please contact your administrator.',
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
        // Sign out the user since they are not authorized
        await signOut();
        return;
      }
      
      // Check if user profile exists
      const profileResult = await getUserProfile(result.user.uid);
      
      // Look for existing admin-created care manager record by phone
      const adminCMQuery = query(
        usersRef,
        where('role', '==', 'caremanager'),
        where('phone', '==', result.user.phoneNumber)
      );
      
      const adminCMSnapshot = await getDocs(adminCMQuery);
      let adminCMData = null;
      let adminCMId = null;
      
      if (!adminCMSnapshot.empty) {
        adminCMData = adminCMSnapshot.docs[0].data();
        adminCMId = adminCMSnapshot.docs[0].id;
      }
      
      // Find seniors assigned to this care manager by careManagerId or phone
      const seniorsRef = collection(firestore, 'users');
      const assignedQuery = query(
        seniorsRef,
        where('role', '==', 'senior')
      );
      
      const seniorsSnapshot = await getDocs(assignedQuery);
      const assignedSeniorIds = [];
      const seniorsToUpdate = [];
      
      seniorsSnapshot.forEach(seniorDoc => {
        const seniorData = seniorDoc.data();
        // Check if senior is assigned to this CM by ID or phone
        if (seniorData.careManagerId === adminCMId || 
            seniorData.careManagerPhone === result.user.phoneNumber) {
          assignedSeniorIds.push(seniorDoc.id);
          if (seniorData.careManagerId !== result.user.uid) {
            seniorsToUpdate.push(seniorDoc.id);
          }
        }
      });
      
      if (profileResult.success && profileResult.exists) {
        // Update care manager profile with assigned seniors
        await updateDoc(doc(firestore, 'users', result.user.uid), {
          assignedSeniorIds: assignedSeniorIds,
          name: adminCMData?.name || adminCMData?.fullName || profileResult.profile.name,
          fullName: adminCMData?.fullName || adminCMData?.name || profileResult.profile.fullName,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create profile using Firebase Auth UID but with admin data
        const cmData = adminCMData || {};
        
        const careManagerProfile = {
          userId: result.user.uid,
          phone: result.user.phoneNumber,
          role: 'caremanager',
          name: cmData.name || cmData.fullName || 'Care Manager',
          fullName: cmData.fullName || cmData.name || 'Care Manager',
          assignedSeniorIds: assignedSeniorIds,
          status: 'active'
        };
        
        await createUserProfile(result.user.uid, careManagerProfile);
      }
      
      // Update all assigned seniors to point to the new Firebase Auth UID
      for (const seniorId of seniorsToUpdate) {
        await updateDoc(doc(firestore, 'users', seniorId), {
          careManagerId: result.user.uid,
          updatedAt: serverTimestamp()
        });
      }
      
      // Delete old admin-created CM record if it exists
      if (adminCMId && adminCMId !== result.user.uid) {
        await deleteDoc(doc(firestore, 'users', adminCMId));
      }
      
      router.replace('/caremanager/dashboard');
      
    } catch (error) {
      let errorMessage = 'Invalid OTP. Please try again.';
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid OTP. Please check and try again.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'OTP has expired. Please request a new one.';
      }
      
      Alert.alert('Verification Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOTP = async () => {
    if (resendTimer > 0) return;

    const fullPhoneNumber = `+${callingCode}${phoneNumber}`;
    
    setLoading(true);
    
    try {
      const result = await sendOTP(fullPhoneNumber);
      
      if (result.success) {
        
        // Update verification ID
        if (result.confirmationResult && result.confirmationResult.verificationId) {
          setVerificationId(result.confirmationResult.verificationId);
        }
        
        // Reset timer and OTP inputs
        setResendTimer(30);
        setOtp(['', '', '', '', '', '']);
        inputRefs[0].current?.focus();
        
        Alert.alert('OTP Sent', 'A new OTP has been sent to your phone');
      } else {
        Alert.alert('Error', result.error || 'Failed to resend OTP');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f6f7f8" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 px-6 justify-between">
            
            {/* Header */}
            <View className="flex-row justify-between items-center pt-4 mt-8">
              {/* Back Button */}
              <TouchableOpacity
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/caremanager/dashboard');
                  }
                }}
                className="p-2 active:bg-gray-100 rounded-lg"
                activeOpacity={0.7}
              >
                <MaterialIcons name="arrow-back" size={24} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* Main Content */}
            <View className="flex-1 justify-center items-center">
              
              {/* Logo */}
              <Image
                source={require('../../assets/logo.png')}
                style={{ width: 80, height: 80, marginBottom: 24, resizeMode: 'contain' }}
              />

              {/* Title */}
              <Text className="text-3xl font-bold text-gray-900 mb-2 text-center">
                {translations.verifyOTP}
              </Text>

              {/* Subtitle */}
              <Text className="text-base text-slate-600 mb-2 text-center">
                {translations.otpSentTo}
              </Text>
              <Text className="text-base font-semibold text-gray-900 mb-8">
                +{callingCode} {phoneNumber}
              </Text>

              {/* OTP Input */}
              <View className="w-full max-w-md mb-6">
                <Text className="text-sm text-slate-600 mb-4 text-center">
                  {translations.enterOTP}
                </Text>
                
                <View className="flex-row justify-center gap-2">
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={inputRefs[index]}
                      className="w-12 h-14 text-center text-2xl font-bold bg-white border border-gray-200 rounded-lg text-gray-900"
                      maxLength={1}
                      keyboardType="number-pad"
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      selectTextOnFocus
                      editable={!loading}
                    />
                  ))}
                </View>

                {/* Verify Button */}
                <TouchableOpacity
                  onPress={() => handleVerifyOTP()}
                  disabled={loading}
                  className="w-full h-14 bg-primary rounded-lg items-center justify-center mt-6 active:opacity-90"
                  style={{
                    shadowColor: '#5B718A',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                    elevation: 4,
                    opacity: loading ? 0.6 : 1,
                  }}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text className="text-white text-lg font-bold">
                      {translations.verifyAndContinue}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <View className="items-center mb-32">
              <Text className="text-sm text-slate-600 mb-2">
                {translations.didntReceiveCode}
              </Text>
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={resendTimer > 0}
                className="py-2"
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-medium ${
                    resendTimer > 0 ? 'text-slate-400' : 'text-primary underline'
                  }`}
                >
                  {resendTimer > 0
                    ? `${translations.resendOTP} (${resendTimer}s)`
                    : translations.resendOTP}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
