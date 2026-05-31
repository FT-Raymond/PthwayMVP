import React from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function SwipeUpScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Swipe up to start{'\n'}exploring Pthway</Text>
        <Text style={styles.subtitle}>Connect, discover and grow.</Text>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.swipeButton}
          onPress={() => router.replace('/(tabs)' as any)}
        >
          <Text style={styles.swipeText}>Swipe up</Text>
          <View style={styles.arrowCircle}>
            <Ionicons name="chevron-up" size={28} color="#111" />
          </View>
        </TouchableOpacity>
        
        </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFC' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 120 },
  title: { textAlign: 'center', fontSize: 50, lineHeight: 56, fontWeight: '700', color: '#111', letterSpacing: -2 },
  subtitle: { marginTop: 18, fontSize: 22, color: '#8A8A8A', letterSpacing: -0.4 },
  heroWrapper: { marginTop: 90, width: '100%', alignItems: 'center', justifyContent: 'center' },
  phone: {
    width: 240, height: 200, borderRadius: 50, backgroundColor: '#FFF',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 }, elevation: 8,
    transform: [{ rotate: '-8deg' }],
  },
  phoneGradient: { flex: 1, borderRadius: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  logo: { fontSize: 34, fontWeight: '700', color: '#111', letterSpacing: -1.2 },
  floatingCardLeft: { position: 'absolute', left: 0, top: 90, width: 120, height: 160, borderRadius: 26, overflow: 'hidden', opacity: 0.9, backgroundColor: '#F1F1F4' },
  floatingCardRight: { position: 'absolute', right: 0, top: 120, width: 120, height: 160, borderRadius: 26, overflow: 'hidden', opacity: 0.7, backgroundColor: '#ECECF2' },
  floatingIcon: {
    position: 'absolute', bottom: 12, right: 12, width: 42, height: 42,
    borderRadius: 100, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
  },
  swipeButton: { marginTop: 525, alignItems: 'center' },
  swipeText: { fontSize: 28, fontWeight: '500', color: '#111', marginBottom: 16 },
  arrowCircle: {
    width: 74, height: 74, borderRadius: 100, backgroundColor: '#FFF',
    borderWidth: 1, borderColor: '#ECECEC', alignItems: 'center', justifyContent: 'center',
  },

})