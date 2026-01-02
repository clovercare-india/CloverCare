import { getCityByPincode } from 'pincode-info';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
  import { colors } from '../../theme/colors';
import { City, Country, State } from 'country-state-city';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TextInput as PaperTextInput, RadioButton } from 'react-native-paper';
import '../../global.css';
import { translations as translationData, loadLanguage } from '../../utils/i18n';
import { sendOTP } from '../../services/auth';
import { setTempData } from '../../utils/tempStorage';
import { useAuth } from '../../contexts/AuthContext';
import CloverCareNavbar from '../../components/CloverCareNavbar';

export default function RegisterSeniorScreen() {
  const params = useLocalSearchParams();
  const { user, userProfile } = useAuth();
  const { familyUID } = params;
  
  // Use familyUID from params, or fallback to current user
  const actualFamilyUID = familyUID || user?.uid || userProfile?.userId;

  const [currentLanguage, setCurrentLanguage] = useState('en');
  const translations = translationData[currentLanguage];

  // Personal Info
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [callingCode, setCallingCode] = useState('91');
  const [phoneNumber, setPhoneNumber] = useState('');

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

  // Loading
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  // Load language
  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
      setPreferredLang(lang);
    };
    initLanguage();

    // Set default country to India
    const india = Country.getAllCountries().find(c => c.isoCode === 'IN');
    if (india) {
      setSelectedCountry(india);
      setCountry(india.name);
    }
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
          const postOffice = postOffices[0]; // Use the first post office
          
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
          // No data found
        }
      } catch (_error) {
        // Don't show error to user
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
          'Permission Denied',
          'Location permission is required to get your current address. Please enable location access in your device settings and try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if location services are enabled
      const locationEnabled = await Location.hasServicesEnabledAsync();
      if (!locationEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Your device\'s location services are turned off. Please go to Settings > Location and enable location services, then try again.',
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
        let stateObj = null;
        if (countryObj && stateName) {
          stateObj = State.getStatesOfCountry(countryObj.isoCode).find(s => s.name === stateName);
          if (stateObj) {
            setSelectedState(stateObj);
            setState(stateObj.name);
          } else {
            // State name from location doesn't match our database, set manually
            setState(stateName);
            setSelectedState(null);
          }
        } else if (countryObj) {
          // No state name from location
          setSelectedState(null);
          setState('');
        }

        // Set city
        const cityName = place.city || place.subregion || place.district || '';
        if (stateObj) {
          const cityObj = City.getCitiesOfState(countryObj.isoCode, stateObj.isoCode).find(c => c.name === cityName);
          if (cityObj) {
            setSelectedCity(cityObj);
            setCity(cityObj.name);
          } else if (cityName) {
            setCity(cityName);
            setSelectedCity(null);
          }
        } else if (cityName) {
          setCity(cityName);
          setSelectedCity(null);
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
        Alert.alert('Success', 'Your current location has been detected and address fields have been filled.');
      } else {
        Alert.alert('Location Detected', 'Location found but address could not be determined. Please enter your address manually.');
      }
    } catch (error) {
      // Check for specific location service errors
      if (error.message && error.message.includes('location services are enabled')) {
        Alert.alert(
          'Location Services Disabled',
          'Your device\'s location services are turned off. Please go to Settings > Location and enable location services, then try again.',
          [{ text: 'OK' }]
        );
      } else if (error.message && error.message.includes('permission')) {
        Alert.alert(
          'Permission Required',
          'Location permission is required to get your current address. Please enable location access in your device settings.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Location Error',
          'Unable to get your current location. Please check your GPS settings and try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSendOTP = async () => {
    // Validation
    if (!actualFamilyUID) {
      Alert.alert('Authentication Error', 'Unable to identify family member. Please log in again.');
      return;
    }
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter senior\'s full name');
      return;
    }
    if (!phoneNumber || phoneNumber.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number');
      return;
    }
    if (!age || parseInt(age) < 1) {
      Alert.alert('Invalid Age', 'Please enter a valid age');
      return;
    }
    if (!gender) {
      Alert.alert('Required Field', 'Please select senior\'s gender');
      return;
    }

    setLoading(true);

    try {
      const fullPhone = `+${callingCode}${phoneNumber}`;
      const result = await sendOTP(fullPhone);

      if (result.success) {
        
        // Store confirmationResult in temp storage (can't be serialized)
        setTempData('seniorConfirmationResult', result.confirmationResult);
        
        // Navigate to OTP verification with senior data
        router.replace({
          pathname: '/family/verify-senior-otp',
          params: {
            familyUID: actualFamilyUID,
            seniorName: fullName,
            seniorPhone: phoneNumber,
            seniorCallingCode: callingCode,
            seniorAge: age,
            seniorGender: gender,
            seniorFullAddress: fullAddress,
            seniorCity: selectedCity ? selectedCity.name : city,
            seniorState: selectedState ? selectedState.name : state,
            seniorCountry: selectedCountry ? selectedCountry.name : country,
            seniorPinCode: pinCode,
            seniorEmploymentStatus: employmentStatus,
            seniorLivingStatus: livingStatus,
            seniorPreferredLang: preferredLang,
          }
        });
      } else {
        Alert.alert('Error', result.error || 'Failed to send OTP');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header with CloverCareNavbar */}
      <View className="bg-white border-b border-gray-100">
        <CloverCareNavbar
          showLogo={true}
          logoSize={32}
          appName="Clover Care"
          backgroundColor="white"
          showBackButton={true}
          onBackPress={() => {
            // Navigate back to family settings
            router.back();
          }}
        />
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
                  className="bg-blue-50"
                  theme={{ colors: { primary: colors.primary } }}
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
                  className="bg-blue-50"
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

              {/* Phone Number */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.seniorPhone}
                </Text>
                <View className="flex-row gap-3">
                  <View className="w-24">
                    <PaperTextInput
                      mode="outlined"
                      label="Code"
                      value={callingCode}
                      onChangeText={setCallingCode}
                      keyboardType="phone-pad"
                      className="bg-blue-50"
                      theme={{ colors: { primary: colors.primary } }}
                    />
                  </View>
                  <View className="flex-1">
                    <PaperTextInput
                      mode="outlined"
                      label={translations.mobileNumber}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      maxLength={10}
                      className="bg-blue-50"
                      theme={{ colors: { primary: colors.primary } }}
                    />
                  </View>
                </View>
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
                    {locationLoading ? 'Getting Location...' : 'Select from my location'}
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
                  className="bg-blue-50"
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
                  className="bg-blue-50"
                  theme={{ colors: { primary: colors.primary } }}
                />
              </View>

              {/* Country */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.country}
                </Text>
                <View className="border border-gray-300 rounded-lg bg-blue-50">
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
                <View className="border border-gray-300 rounded-lg bg-blue-50">
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
                      const city = City.getCitiesOfState(selectedCountry?.isoCode || 'IN', selectedState?.isoCode).find(c => c.name === value);
                      setSelectedCity(city || { name: value });
                      setCity(value);
                    }}
                    enabled={!!selectedState}
                    className="h-12"
                  >
                    <Picker.Item label={translations.selectCity} value="" />
                    {selectedState && City.getCitiesOfState(selectedCountry?.isoCode || 'IN', selectedState.isoCode).map((city) => (
                      <Picker.Item key={city.name} label={city.name} value={city.name} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            {/* Preferences Section */}
            <View className="mb-40">
              {/* Employment Status */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  Employment Status
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
                  Living Status
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
          onPress={handleSendOTP}
          disabled={loading}
          className="bg-primary"
          buttonColor={colors.primary}
          contentStyle={{ paddingVertical: 8 }}
        >
          {loading ? 'Sending OTP...' : translations.sendOTPToSenior}
        </Button>
      </View>
    </SafeAreaView>
  );
}
