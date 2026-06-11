import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import AdminMode from '../components/AdminMode';
import UserMode from '../components/UserMode';
import { LevelId } from '../constants/levels';

export default function MainMenu() {
  const [mode, setMode] = useState<'menu' | 'admin' | 'level-select' | 'playing'>('menu');
  const [selectedLevelId, setSelectedLevelId] = useState<LevelId | null>(null);

  if (mode === 'admin') {
    return <AdminMode onBack={() => setMode('menu')} />;
  }

  if (mode === 'playing' && selectedLevelId) {
    return <UserMode levelId={selectedLevelId} onBack={() => setMode('level-select')} />;
  }

  if (mode === 'level-select') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.navbar}>
          <TouchableOpacity style={styles.btnNav} onPress={() => setMode('menu')}>
            <Text style={styles.btnTextNav}>← Back to Menu</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Select Level</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnLevel]}
            onPress={() => { setSelectedLevelId('level1'); setMode('playing'); }}
          >
            <Text style={styles.btnText}>Level 1</Text>
            <Text style={styles.btnSub}>Play the first level</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnLevel]}
            onPress={() => { setSelectedLevelId('level2'); setMode('playing'); }}
          >
            <Text style={styles.btnText}>Level 2</Text>
            <Text style={styles.btnSub}>Play the second level</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
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

        <TouchableOpacity style={[styles.btn, styles.btnUser]} onPress={() => setMode('level-select')}>
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
  btnLevel: {
    backgroundColor: '#8b5cf6',
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
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#1e1e1e',
    height: 70,
  },
  btnNav: {
    padding: 8,
  },
  btnTextNav: {
    color: '#ccc',
    fontSize: 16,
  },
  navTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
