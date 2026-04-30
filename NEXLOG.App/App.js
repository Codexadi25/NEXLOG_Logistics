import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  AppState,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ActiveDeliveryScreen from './src/screens/ActiveDeliveryScreen';
import HistoryScreen from './src/screens/HistoryScreen';

import { LocationService } from './src/services/LocationService';
import { SocketService } from './src/services/SocketService';
import { AuthContext } from './src/context/AuthContext';

const Stack = createStackNavigator();

export default function App() {
  const [authToken, setAuthToken] = useState(null);
  const [deliveryPartner, setDeliveryPartner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Restore session on app launch
    (async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const partner = await AsyncStorage.getItem('deliveryPartner');
        if (token && partner) {
          setAuthToken(token);
          setDeliveryPartner(JSON.parse(partner));
          SocketService.connect(token);
        }
      } catch (e) {
        console.error('Session restore error:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    // Track app state changes (foreground/background)
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        // App came to foreground – reconnect socket if needed
        if (authToken) SocketService.reconnect();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [authToken]);

  const authContext = {
    authToken,
    deliveryPartner,
    signIn: async (token, partner) => {
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('deliveryPartner', JSON.stringify(partner));
      setAuthToken(token);
      setDeliveryPartner(partner);
      SocketService.connect(token);
    },
    signOut: async () => {
      LocationService.stopTracking();
      SocketService.disconnect();
      await AsyncStorage.multiRemove(['authToken', 'deliveryPartner']);
      setAuthToken(null);
      setDeliveryPartner(null);
    },
  };

  if (isLoading) return null;

  return (
    <AuthContext.Provider value={authContext}>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor="#0F1923" />
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={authToken ? 'Dashboard' : 'Login'}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="ActiveDelivery" component={ActiveDeliveryScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
