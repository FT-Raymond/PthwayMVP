import React, { useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons'

const INTERESTS = [
  { title: 'Football', icon: <Ionicons name="football-outline" size={20} color="#111" />, color: '#EFE4FF' },
  { title: 'Beauty & fashion', icon: <Feather name="shopping-bag" size={20} color="#111" />, color: '#FFEFE4' },
  { title: 'Entertainment', icon: <Ionicons name="film-outline" size={20} color="#111" />, color: '#FFF4D9' },
  { title: 'Pets', icon: <MaterialCommunityIcons name="paw-outline" size={20} color="#111" />, color: '#E8FFF0' },
  { title: 'Music', icon: <Ionicons name="musical-notes-outline" size={20} color="#111" />, color: '#EAF1FF' },
  { title: 'Funny', icon: <Ionicons name="happy-outline" size={20} color="#111" />, color: '#F4E8FF' },
  { title: 'Anime & cartoons', icon: <Ionicons name="sparkles-outline" size={20} color="#111" />, color: '#FFF1EA' },
  { title: 'DIY & home', icon: <Ionicons name="home-outline" size={20} color="#111" />, color: '#EEFFF2' },
  { title: 'Art', icon: <Ionicons name="brush-outline" size={20} color="#111" />, color: '#EDF3FF' },
  { title: 'Sports', icon: <Ionicons name="basketball-outline" size={20} color="#111" />, color: '#FFF0E7' },
  { title: 'Drama', icon: <Ionicons name="tv-outline" size={20} color="#111" />, color: '#FFF6D9' },
  { title: 'Science & tech', icon: <Ionicons name="flask-outline" size={20} color="#111" />, color: '#F4E9FF' },
  { title: 'Gaming', icon: <Ionicons name="game-controller-outline" size={20} color="#111" />, color: '#EEFFF2' },
  { title: 'Cars', icon: <Ionicons name="car-outline" size={20} color="#111" />, color: '#FFF0E8' },
]

export default function InterestsScreen() {
  const [selected, setSelected] = useState<string[]>([])

  function toggleInterest(title: string) {
    if (selected.includes(title)) {
      setSelected(selected.filter(item => item !== title))
    } else {
      setSelected([...selected, title])
    }
  }

  const buttonText = useMemo(() => `Next (${selected.length})`, [selected])

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.skipButton}
        activeOpacity={0.8}
        onPress={() => router.push('/(onboarding)/swipe-up' as any)}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>What are you{'\n'}interested in?</Text>
        <Text style={styles.subtitle}>
          We'll personalise your Pthway feed based on the topics you love.
        </Text>

        <View style={styles.grid}>
          {INTERESTS.map(item => {
            const active = selected.includes(item.title)
            return (
              <TouchableOpacity
                key={item.title}
                activeOpacity={0.8}
                style={[styles.card, active && styles.activeCard]}
                onPress={() => toggleInterest(item.title)}
              >
                <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
                  {item.icon}
                </View>
                <Text style={styles.cardText}>{item.title}</Text>
                <View style={[styles.plusCircle, active && styles.activePlus]}>
                  <Ionicons
                    name={active ? 'checkmark' : 'add'}
                    size={20}
                    color={active ? '#FFF' : '#111'}
                  />
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.nextButton}
          onPress={() => router.push('/(onboarding)/swipe-up' as any)}
        >
          <Text style={styles.nextText}>{buttonText}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  scrollContent: { paddingHorizontal: 28, paddingTop: 70, paddingBottom: 160 },
  skipButton: {
    position: 'absolute', top: 60, right: 28, zIndex: 10,
    width: 82, height: 48, borderRadius: 18, borderWidth: 1,
    borderColor: '#EFEFEF', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  skipText: { fontSize: 18, fontWeight: '500', color: '#9A9A9A' },
  title: { fontSize: 54, lineHeight: 56, fontWeight: '700', color: '#111', letterSpacing: -2.4 },
  subtitle: { marginTop: 24, fontSize: 20, lineHeight: 34, color: '#8A8A8A', letterSpacing: -0.4 },
  grid: { marginTop: 50, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%', minHeight: 88, borderRadius: 24, borderWidth: 1,
    borderColor: '#EFEFEF', paddingHorizontal: 18, marginBottom: 18,
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
  },
  activeCard: { borderColor: '#8B5CF6', backgroundColor: '#FAF7FF' },
  iconCircle: { width: 42, height: 42, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, marginLeft: 12, fontSize: 17, lineHeight: 22, fontWeight: '500', color: '#111' },
  plusCircle: { width: 32, height: 32, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  activePlus: { backgroundColor: '#8B5CF6' },
  footer: { position: 'absolute', left: 24, right: 24, bottom: 38 },
  nextButton: { height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8B5CF6' },
  nextText: { fontSize: 22, fontWeight: '600', color: '#FFF', letterSpacing: -0.6 },
})