import React, {useState} from 'react';
import {View, TextInput, Button, Alert} from 'react-native';
import {authService} from '../services/api';
import {useAuthContext} from '../contexts/AuthContext';

export default function LoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const {setUser} = useAuthContext();

  const handleLogin = async () => {
    try {
      const userData = await authService.login(phoneNumber, pin);
      setUser(userData);
    } catch (error) {
      Alert.alert('Error', 'Invalid credentials');
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Phone Number"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
      />
      <TextInput
        placeholder="PIN"
        value={pin}
        onChangeText={setPin}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}
