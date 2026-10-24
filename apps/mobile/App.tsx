import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getSession, Session } from './lib/api';
import LoginScreen from './components/LoginScreen';
import HomeScreen from './components/HomeScreen';

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {session ? (
        <HomeScreen session={session} onLogout={() => setSession(null)} />
      ) : (
        <LoginScreen onLogin={setSession} />
      )}
    </>
  );
}
