import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import AdminMode from '../components/AdminMode';
import UserMode from '../components/UserMode';

export default function MainMenu() {
  const [mode, setMode] = useState<'menu' | 'admin' | 'user'>('menu');

  if (mode === 'admin') {
    return <AdminMode onBack={() => setMode('menu')} />;
  }

  if (mode === 'user') {
    return <UserMode onBack={() => setMode('menu')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Room Sticker Game</Text>
        <Text style={styles.subtitle}>Mobile Level Editor & Game</Text>
      </View>

      <View style={styles.menuContainer}>
        <TouchableOpacity style={[styles.btn, styles.btnAdmin]} onPress={() => setMode('admin')}>
          <Text style={styles.btnText}>Admin Mode</Text>
          <Text style={styles.btnSub}>Create new levels (Drag & Drop)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.btnUser]} onPress={() => setMode('user')}>
          <Text style={styles.btnText}>User Mode</Text>
          <Text style={styles.btnSub}>Play the levels</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
  },
  menuContainer: {
    paddingHorizontal: 32,
    gap: 20,
  },
  btn: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  btnAdmin: {
    backgroundColor: '#3b82f6',
  },
  btnUser: {
    backgroundColor: '#10b981',
  },
  btnText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  btnSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  }
});
