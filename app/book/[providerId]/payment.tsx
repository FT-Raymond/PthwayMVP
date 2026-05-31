// app/book/[providerId]/payment.tsx
// Uses create-booking edge function for atomic booking creation

import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Lock } from 'lucide-react-native'

export default function PaymentScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    providerId: string
    serviceId: string
    serviceName: string
    servicePrice: string
    serviceDuration: string
    selectedDate: string
    selectedTime: string
    selectedTimeUTC: string
    selectedEndUTC: string
    answers: string
  }>()

  const [paying, setPaying] = useState(false)

  const price = parseInt(params.servicePrice ?? '0')
  const platformFee = price > 0 ? Math.round(price * 0.03 + 40) : 0
  const total = price + platformFee

  const dateDisplay = params.selectedDate
    ? new Date(params.selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : ''

  function formatTime(t: string) {
    const [h, m] = t.split(':').map(Number)
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
  }

  async function handlePay() {
    setPaying(true)

    try {
      const answers = params.answers ? JSON.parse(params.answers) : []

      // Use the create-booking edge function for atomic booking
      const { data, error } = await supabase.functions.invoke('create-booking', {
        body: {
          opportunityId: params.serviceId,
          startsAtUTC: params.selectedTimeUTC,
          endsAtUTC: params.selectedEndUTC,
          answers,
        },
      })

      if (error) {
        // Slot conflict
        if (error.message?.includes('409') || error.message?.includes('taken') || error.message?.includes('booked')) {
          Alert.alert(
            'Slot taken',
            'Someone just booked this time. Please go back and choose another slot.',
            [{ text: 'Go back', onPress: () => router.back() }]
          )
          setPaying(false)
          return
        }
        throw new Error(error.message)
      }

      const booking = data?.booking
      if (!booking) throw new Error('No booking returned')

      router.replace({
        pathname: '/book/[providerId]/confirmed' as any,
        params: {
          providerId: params.providerId,
          serviceId: params.serviceId,
          serviceName: params.serviceName,
          servicePrice: params.servicePrice,
          serviceDuration: params.serviceDuration,
          selectedDate: params.selectedDate,
          selectedTime: params.selectedTime,
          answers: params.answers ?? '[]',
          totalPence: String(total),
          bookingId: booking.id,
        },
      })
    } catch (err: any) {
      console.error('Payment error:', err)
      Alert.alert('Something went wrong', err.message ?? 'Please try again.')
      setPaying(false)
    }
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#222" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Confirm booking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* Booking summary */}
        <View style={s.summaryCard}>
          <Text style={s.summaryService}>{params.serviceName}</Text>
          <View style={s.summaryRow}>
            <Text style={s.summaryMeta}>{dateDisplay}</Text>
            <Text style={s.summaryDot}>·</Text>
            <Text style={s.summaryMeta}>{formatTime(params.selectedTime ?? '')}</Text>
            <Text style={s.summaryDot}>·</Text>
            <Text style={s.summaryMeta}>{params.serviceDuration ?? 60} min</Text>
          </View>
        </View>

        {/* Price breakdown */}
        {total > 0 && (
          <View style={s.priceCard}>
            <Text style={s.priceCardTitle}>Price breakdown</Text>
            <View style={s.priceRow}>
              <Text style={s.priceLabel}>{params.serviceName}</Text>
              <Text style={s.priceValue}>£{(price / 100).toFixed(2)}</Text>
            </View>
            <View style={s.priceRow}>
              <Text style={s.priceLabel}>Platform fee</Text>
              <Text style={s.priceValue}>£{(platformFee / 100).toFixed(2)}</Text>
            </View>
            <View style={s.priceDivider} />
            <View style={s.priceRow}>
              <Text style={[s.priceLabel, { fontWeight: '700', color: '#222' }]}>Total</Text>
              <Text style={[s.priceValue, { fontWeight: '700', color: '#222', fontSize: 17 }]}>£{(total / 100).toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* How it works */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>How it works</Text>
          <Text style={s.infoText}>
            Your booking is sent to the provider for confirmation. {total > 0 ? 'Payment is held securely and only released once they accept.' : 'This is a free service — no payment needed.'}
          </Text>
        </View>

        <View style={s.secureRow}>
          <Lock size={13} color="#888" strokeWidth={1.5} />
          <Text style={s.secureText}>Secured by Pthway. Your details are never shared without consent.</Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.payBtn, paying && s.payBtnLoading]}
          onPress={handlePay}
          disabled={paying}
          activeOpacity={0.88}
        >
          {paying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.payBtnText}>
              {total === 0 ? 'Request booking' : `Request · £${(total / 100).toFixed(2)}`}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={s.footerNote}>By confirming you agree to Pthway's terms and the provider's cancellation policy.</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  content: { paddingHorizontal: 20, paddingTop: 24 },
  summaryCard: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 16, padding: 20, marginBottom: 16 },
  summaryService: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryMeta: { fontSize: 14, color: '#888' },
  summaryDot: { fontSize: 14, color: '#ccc' },
  priceCard: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 16, padding: 20, marginBottom: 16, gap: 12 },
  priceCardTitle: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { fontSize: 14, color: '#888' },
  priceValue: { fontSize: 14, color: '#444' },
  priceDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 4 },
  infoCard: { backgroundColor: '#f9f9f9', borderRadius: 14, padding: 16, marginBottom: 14 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#222', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#888', lineHeight: 20 },
  secureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  secureText: { fontSize: 12, color: '#bbb', flex: 1, lineHeight: 18 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36 },
  payBtn: { height: 56, borderRadius: 16, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  payBtnLoading: { opacity: 0.7 },
  payBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  footerNote: { fontSize: 11, color: '#bbb', textAlign: 'center', lineHeight: 16 },
})
