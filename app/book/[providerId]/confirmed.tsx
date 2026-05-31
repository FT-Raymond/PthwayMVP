// app/book/[providerId]/confirmed.tsx
// Step 6 — Booking confirmed

import { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Calendar, Clock, CheckCircle } from 'lucide-react-native'

const { width } = Dimensions.get('window')

export default function ConfirmedScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    providerId: string
    serviceName: string
    selectedDate: string
    selectedTime: string
    serviceDuration: string
    bookingId: string
  }>()

  const scaleAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(40)).current

  useEffect(() => {
    // Check animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
      delay: 100,
    }).start()

    // Content fade in
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: 400, useNativeDriver: true }),
    ]).start()
  }, [])

  const dateDisplay = params.selectedDate
    ? new Date(params.selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : ''

  const duration = parseInt(params.serviceDuration ?? '60')
  const durationLabel = duration < 60
    ? `${duration} min`
    : `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}m` : ''}`

  return (
    <View style={s.container}>

      {/* Animated check */}
      <Animated.View style={[s.checkWrap, { transform: [{ scale: scaleAnim }] }]}>
        <View style={s.checkCircle}>
          <CheckCircle size={48} color="#fff" strokeWidth={1.5} />
        </View>
      </Animated.View>

      {/* Content */}
      <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={s.title}>You're booked!</Text>
        <Text style={s.subtitle}>
          Your booking request has been sent to the provider. You'll be notified once they confirm.
        </Text>

        {/* Booking details card */}
        <View style={s.detailsCard}>
          <Text style={s.detailsService}>{params.serviceName}</Text>

          <View style={s.detailRow}>
            <Calendar size={16} color="#888" />
            <Text style={s.detailText}>{dateDisplay}</Text>
          </View>
          <View style={s.detailRow}>
            <Clock size={16} color="#888" />
            <Text style={s.detailText}>{params.selectedTime} · {durationLabel}</Text>
          </View>
        </View>

        {/* Status pill */}
        <View style={s.statusPill}>
          <View style={s.statusDot} />
          <Text style={s.statusText}>Awaiting provider confirmation</Text>
        </View>
      </Animated.View>

      {/* CTAs */}
      <Animated.View style={[s.footer, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => router.push('/(tabs)' as any)}
          activeOpacity={0.88}
        >
          <Text style={s.primaryBtnText}>Back to home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={() => router.push(`/booking/${params.bookingId}` as any)}
          activeOpacity={0.8}
        >
          <Text style={s.secondaryBtnText}>View booking</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },

  checkWrap: { marginBottom: 32 },
  checkCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#111',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },

  content: { width: '100%', alignItems: 'center' },
  title: {
    fontSize: 32, fontWeight: '700', color: '#111',
    letterSpacing: -0.8, marginBottom: 12, textAlign: 'center',
  },
  subtitle: {
    fontSize: 15, color: '#888', lineHeight: 22,
    textAlign: 'center', marginBottom: 32, maxWidth: 280,
  },

  detailsCard: {
    width: '100%', borderWidth: 1, borderColor: '#f0f0f0',
    borderRadius: 20, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
    gap: 12,
  },
  detailsService: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { fontSize: 14, color: '#555' },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f9f9f9', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#ff9d00' },
  statusText: { fontSize: 13, fontWeight: '600', color: '#888' },

  footer: { position: 'absolute', bottom: 36, left: 32, right: 32, gap: 10 },
  primaryBtn: {
    height: 56, borderRadius: 16, backgroundColor: '#111',
    justifyContent: 'center', alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  secondaryBtn: {
    height: 52, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#e0e0e0',
    justifyContent: 'center', alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: '#111' },
})
