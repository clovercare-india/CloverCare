import { getCityByPincode } from 'pincode-info';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { City, Country, State } from 'country-state-city';
import { useLocalSearchParams, router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TextInput as PaperTextInput, RadioButton } from 'react-native-paper';
import { colors } from '../../theme/colors';
import { translations as translationData, loadLanguage, toggleLanguage, addLanguageChangeListener } from '../../utils/i18n';
import logger from '../../utils/logger';
import { useAuth } from '../../contexts/AuthContext';
import { createUserProfile, generateLinkingCode } from '../../services/auth';
import { initializeNotifications } from '../../services/notifications';
import { firestore } from '../../config/firebase';
import { updateDoc, doc } from '@react-native-firebase/firestore';

export default function ProfileSetupScreen() {
  const params = useLocalSearchParams();
  const { phoneNumber, callingCode, fullPhoneNumber, userId } = params;
  const { setUserProfile } = useAuth();

  const [currentLanguage, setCurrentLanguage] = useState('en');
  const translations = translationData[currentLanguage];

  // Personal Info
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  
  // Use parsed phone number if available, otherwise use full phone number
  const displayPhone = fullPhoneNumber || `+${callingCode} ${phoneNumber}`;
  const [contactNum] = useState(displayPhone);

  // Address
  const [fullAddress, setFullAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [pinCode, setPinCode] = useState('');

  // Country/State/City data
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  // Preferences
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [livingStatus, setLivingStatus] = useState('');
  const [preferredLang, setPreferredLang] = useState(currentLanguage);
  const [locationLoading, setLocationLoading] = useState(false);

  // Load saved language preference
  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
      setPreferredLang(lang);
    };
    initLanguage();

    // Listen for language changes
    const removeListener = addLanguageChangeListener((newLang) => {
      setCurrentLanguage(newLang);
    });

    // Set default country to India
    const india = Country.getAllCountries().find(c => c.isoCode === 'IN');
    if (india) {
      setSelectedCountry(india);
      setCountry(india.name);
    }

    return removeListener;
  }, []);

  // Reset state and city when country changes
  useEffect(() => {
    if (selectedCountry) {
      setSelectedState(null);
      setSelectedCity(null);
      setState('');
      setCity('');
    }
  }, [selectedCountry]);

  // Reset city when state changes
  useEffect(() => {
    if (selectedState) {
      setSelectedCity(null);
      setCity('');
    }
  }, [selectedState]);

  // Handle PIN code change with geocoding
  const handlePinCodeChange = async (text) => {
    setPinCode(text);

    if (text.length === 6) {
      try {
        const postOffices = await getCityByPincode(text);
        
        if (postOffices && postOffices.length > 0) {
          const postOffice = postOffices[0];
          
          // Set country to India
          const india = Country.getAllCountries().find(c => c.isoCode === 'IN');
          if (india) {
            setSelectedCountry(india);
            setCountry(india.name);
          }

          // Set state
          const stateObj = State.getStatesOfCountry('IN').find(s => s.name === postOffice.state);
          if (stateObj) {
            setSelectedState(stateObj);
            setState(postOffice.state);
          }

          // Set city (district)
          if (stateObj) {
            const cityObj = City.getCitiesOfState('IN', stateObj.isoCode).find(c => c.name === postOffice.district);
            if (cityObj) {
              setSelectedCity(cityObj);
              setCity(postOffice.district);
            } else {
              // If exact match not found, try partial match or set district name directly
              setCity(postOffice.district);
              // Create a mock city object for display
              setSelectedCity({ name: postOffice.district });
            }
          }
        } else {
          // No data found, continue with manual entry
        }
      } catch (_error) {
        // Don't show error to user, just continue with manual entry
      }
    }
  };

  // Handle getting current location
  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          translations.permissionDenied,
          translations.locationPermissionRequired,
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if location services are enabled
      const locationEnabled = await Location.hasServicesEnabledAsync();
      if (!locationEnabled) {
        Alert.alert(
          translations.locationServicesDisabled,
          translations.deviceLocationServicesOff,
          [{ text: 'OK' }]
        );
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Reverse geocode to get address
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address && address.length > 0) {
        const place = address[0];
        // Set country
        const countryName = place.country || '';
        const countryObj = Country.getAllCountries().find(c => c.name === countryName);
        if (countryObj) {
          setSelectedCountry(countryObj);
          setCountry(countryObj.name);
        }

        // Set state/region
        const stateName = place.region || place.administrativeArea || '';
        if (countryObj) {
          const stateObj = State.getStatesOfCountry(countryObj.isoCode).find(s => s.name === stateName);
          if (stateObj) {
            setSelectedState(stateObj);
            setState(stateObj.name);
          }
        }

        // Set city
        const cityName = place.city || place.subregion || place.district || '';
        if (countryObj && stateName) {
          const stateObj = State.getStatesOfCountry(countryObj.isoCode).find(s => s.name === stateName);
          if (stateObj) {
            const cityObj = City.getCitiesOfState(countryObj.isoCode, stateObj.isoCode).find(c => c.name === cityName);
            if (cityObj) {
              setSelectedCity(cityObj);
              setCity(cityObj.name);
            } else {
              setCity(cityName);
              setSelectedCity({ name: cityName });
            }
          }
        }

        // Set full address
        const street = place.street || '';
        const streetNumber = place.streetNumber || '';
        const district = place.district || '';
        const postalCode = place.postalCode || '';
        const subregion = place.subregion || '';
        const region = place.region || '';

        let fullAddressText = '';
        
        // Build comprehensive address
        if (streetNumber && street) {
          fullAddressText += `${streetNumber} ${street}`;
        } else if (street) {
          fullAddressText += street;
        }

        // Add district/locality if available
        if (district && district !== cityName) {
          fullAddressText += fullAddressText ? `, ${district}` : district;
        } else if (subregion && subregion !== cityName) {
          fullAddressText += fullAddressText ? `, ${subregion}` : subregion;
        }

        // Add city if not already included
        if (cityName && !fullAddressText.includes(cityName)) {
          fullAddressText += fullAddressText ? `, ${cityName}` : cityName;
        }

        // Add state if not already included
        if (region && !fullAddressText.includes(region)) {
          fullAddressText += fullAddressText ? `, ${region}` : region;
        }

        // Add postal code if not already set separately
        if (postalCode && !fullAddressText.includes(postalCode)) {
          fullAddressText += fullAddressText ? ` - ${postalCode}` : postalCode;
        }

        setFullAddress(fullAddressText);

        // Set PIN code if available
        if (postalCode) {
          setPinCode(postalCode);
        }

        Alert.alert(translations.success, translations.currentLocationDetected);
      } else {
        Alert.alert(translations.locationDetected, translations.locationFoundAddressNotDetermined);
      }
    } catch (error) {
      // Check for specific location service errors
      if (error.message && error.message.includes('location services are enabled')) {
        Alert.alert(
          translations.locationServicesDisabled,
          translations.deviceLocationServicesOff,
          [{ text: 'OK' }]
        );
      } else if (error.message && error.message.includes('permission')) {
        Alert.alert(
          translations.permissionRequired,
          translations.locationPermissionRequiredForAddress,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          translations.locationError,
          translations.unableToGetCurrentLocation,
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLocationLoading(false);
    }
  };

  // Handle language toggle
  const handleLanguageToggle = async () => {
    const newLang = await toggleLanguage();
    setCurrentLanguage(newLang);
    setPreferredLang(newLang);
  };

  // Handle form submission
  const handleSaveProfile = async () => {
    // Validation
    if (!fullName.trim()) {
      Alert.alert('Error', translations.pleaseEnterYourFullName);
      return;
    }
    if (!age.trim()) {
      Alert.alert('Error', translations.pleaseEnterYourAge);
      return;
    }
    if (!gender) {
      Alert.alert('Error', translations.pleaseSelectYourGender);
      return;
    }

    try {
      // Prepare profile data
      const profileData = {
        name: fullName.trim(),
        age: parseInt(age),
        gender,
        phone: fullPhoneNumber || `+${callingCode}${phoneNumber}`,
        address: {
          fullAddress: fullAddress.trim(),
          city: selectedCity ? selectedCity.name : city.trim(),
          state: selectedState ? selectedState.name : state.trim(),
          country: selectedCountry ? selectedCountry.name : country.trim(),
          pinCode: pinCode.trim(),
        },
        employmentStatus,
        livingStatus,
        preferredLanguage: preferredLang,
        role: 'senior',
        linkedFamily: [],
        careManagerId: null,
        createdAt: new Date().toISOString(),
      };

      await createUserProfile(userId, profileData);
      
      // Initialize notifications for the newly created user
      try {
        await initializeNotifications(userId);
        logger.info('seniorProfileSetup', 'Notifications initialized successfully');
      } catch (notifErr) {
        logger.error('seniorProfileSetup', 'Failed to initialize notifications', notifErr);
      }
      
      // Generate and save linking code
      const linkingCode = generateLinkingCode();
      
      await updateDoc(doc(firestore, 'users', userId), {
        linkingCode: linkingCode
      });
      
      Alert.alert('Success', 'Profile saved successfully!');
      
      // Update the auth context with the new profile
      setUserProfile({ ...profileData, linkingCode });
      
      // Show success alert with linking code
      Alert.alert(
        translations.profileCreated,
        translations.profileCreatedSuccessfully.replace('{linkingCode}', linkingCode),
        [
          {
            text: translations.goToDashboard,
            onPress: () => router.replace('/senior/dashboard')
          }
        ]
      );
    } catch (_error) {
      Alert.alert('Error', translations.failedToSaveProfile);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View className="px-4 py-3 mt-10 border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: 24, height: 24, resizeMode: 'contain' }}
            />
            <Text className="text-lg font-bold text-slate-900">
              {translations.appName}
            </Text>
          </View>
           <TouchableOpacity
                onPress={handleLanguageToggle}
                className="flex-row items-center gap-1 px-3 py-2 rounded-lg active:bg-gray-100"
                activeOpacity={0.7}
              >
                <MaterialIcons name="language" size={18} color={colors.text.muted} />
                <Text className="text-sm font-semibold text-slate-600">
                  {currentLanguage === 'en' ? translations.english : translations.tamil}
                </Text>
              </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView className="flex-1 px-4 pb-32">
            {/* Personal Info Section */}
            <View className="mb-6 mt-6">
              <Text className="text-lg font-bold text-slate-900 mb-4">
                {translations.personalInfo}
              </Text>

              {/* Full Name */}
              <View className="mb-4">
                <PaperTextInput
                  mode="outlined"
                  label={translations.fullName}
                  value={fullName}
                  onChangeText={setFullName}
                  className="bg-primary-50"
                  theme={{ colors: { primary: '#5B718A' } }}
                />
              </View>

              {/* Age */}
              <View className="mb-4">
                <PaperTextInput
                  mode="outlined"
                  label={translations.age}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  className="bg-primary-50"
                  theme={{ colors: { primary: colors.primary } }}
                />
              </View>

              {/* Gender */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.gender}
                </Text>
                <RadioButton.Group onValueChange={setGender} value={gender}>
                  <View className="flex-row gap-2">
                    <View className="flex-row items-center">
                      <RadioButton value="male" color={colors.primary} />
                      <Text className="ml-1">{translations.male}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <RadioButton value="female" color={colors.primary} />
                      <Text className="ml-1">{translations.female}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <RadioButton value="other" color={colors.primary} />
                      <Text className="ml-1">{translations.other}</Text>
                    </View>
                  </View>
                </RadioButton.Group>
              </View>

              {/* Contact Number (Read-only) */}
              <View className="mb-4">
                <PaperTextInput
                  mode="outlined"
                  label={translations.contactNumber}
                  value={contactNum}
                  editable={false}
                  className="bg-gray-100"
                  theme={{ colors: { primary: colors.primary } }}
                />
              </View>
            </View>

            {/* Address Details Section */}
            <View className="mb-6">
              <Text className="text-lg font-bold text-slate-900 mb-4">
                {translations.addressDetails}
              </Text>

              {/* Select from my location button */}
              <View className="mb-4">
                <TouchableOpacity
                  onPress={handleGetCurrentLocation}
                  disabled={locationLoading}
                  className="flex-row items-center justify-center gap-2 bg-primary rounded-lg py-3 active:bg-blue-700"
                  activeOpacity={0.8}
                >
                  {locationLoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <MaterialIcons name="location-on" size={20} color={colors.white} />
                  )}
                  <Text className="text-white font-semibold text-base">
                    {locationLoading ? translations.gettingLocation : translations.selectFromMyLocation}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* PIN Code */}
              <View className="mb-4">
                <PaperTextInput
                  mode="outlined"
                  label={translations.pinCode}
                  value={pinCode}
                  onChangeText={handlePinCodeChange}
                  keyboardType="number-pad"
                  className="bg-primary-50"
                  theme={{ colors: { primary: colors.primary } }}
                />
              </View>

              {/* Add your whole address */}
              <View className="mb-4">
                <PaperTextInput
                  mode="outlined"
                  label={translations.addYourWholeAddress}
                  value={fullAddress}
                  onChangeText={setFullAddress}
                  multiline
                  numberOfLines={3}
                  className="bg-primary-50"
                  theme={{ colors: { primary: colors.primary } }}
                />
              </View>

              {/* Country */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.country}
                </Text>
                <View className="border border-gray-300 rounded-lg bg-primary-50">
                  <Picker
                    selectedValue={selectedCountry ? selectedCountry.isoCode : ''}
                    onValueChange={(value) => {
                      const country = Country.getAllCountries().find(c => c.isoCode === value);
                      setSelectedCountry(country);
                      setCountry(country ? country.name : '');
                    }}
                    className="h-12"
                  >
                    <Picker.Item label={translations.selectCountry} value="" />
                    {Country.getAllCountries().map((country) => (
                      <Picker.Item key={country.isoCode} label={country.name} value={country.isoCode} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* State */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.state}
                </Text>
                <View className="border border-gray-300 rounded-lg bg-primary-50">
                  <Picker
                    selectedValue={selectedState ? selectedState.isoCode : ''}
                    onValueChange={(value) => {
                      const state = State.getStatesOfCountry(selectedCountry?.isoCode || 'IN').find(s => s.isoCode === value);
                      setSelectedState(state);
                      setState(state ? state.name : '');
                    }}
                    enabled={!!selectedCountry}
                    className="h-12"
                  >
                    <Picker.Item label={translations.selectState} value="" />
                    {selectedCountry && State.getStatesOfCountry(selectedCountry.isoCode).map((state) => (
                      <Picker.Item key={state.isoCode} label={state.name} value={state.isoCode} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* City */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.city}
                </Text>
                <View className="border border-gray-300 rounded-lg bg-blue-50">
                  <Picker
                    selectedValue={selectedCity ? selectedCity.name : ''}
                    onValueChange={(value) => {
                      if (selectedCountry && selectedState) {
                        const city = City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode).find(c => c.name === value);
                        setSelectedCity(city || { name: value });
                        setCity(value);
                      }
                    }}
                    enabled={!!selectedState}
                    className="h-12"
                  >
                    <Picker.Item label={translations.selectCity} value="" />
                    {selectedCountry && selectedState && City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode).map((city) => (
                      <Picker.Item key={city.name} label={city.name} value={city.name} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            {/* Preferences Section */}
            <View className="mb-6">
              {/* Employment Status */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.employmentStatus}
                </Text>
                <RadioButton.Group onValueChange={setEmploymentStatus} value={employmentStatus}>
                  <View className="flex-row gap-2">
                    <View className="flex-row items-center">
                      <RadioButton value="employed" color={colors.primary} />
                      <Text className="ml-1">{translations.employed}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <RadioButton value="retired" color={colors.primary} />
                      <Text className="ml-1">{translations.retired}</Text>
                    </View>
                  </View>
                </RadioButton.Group>
              </View>

              {/* Living Status */}
              <View className="mb-40">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.livingStatus}
                </Text>
                <RadioButton.Group onValueChange={setLivingStatus} value={livingStatus}>
                  <View className="flex-row gap-2">
                    <View className="flex-row items-center">
                      <RadioButton value="alone" color={colors.primary} />
                      <Text className="ml-1">{translations.livingAlone}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <RadioButton value="withSomeone" color={colors.primary} />
                      <Text className="ml-1">{translations.livingWithSomeone}</Text>
                    </View>
                  </View>
                </RadioButton.Group>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Fixed Bottom Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-100">
        <Button
          mode="contained"
          onPress={handleSaveProfile}
          className="bg-primary"
          buttonColor={colors.primary}
          contentStyle={{ paddingVertical: 8 }}
        >
          {translations.saveContinue}
        </Button>
      </View>
    </SafeAreaView>
  );
}
