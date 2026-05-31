// app/book/[providerId]/review.tsx
// Step 4 — Review & confirm

import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Calendar, Clock, MapPin, Shield, ChevronRight,
} from 'lucide-react-native'

export default function ReviewScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    providerId: string
    serviceId: string
    serviceName: string
    servicePrice: string
    serviceDuration: string
    selectedDate: string
    selectedTime: string
    answers: string
  }>()

  const [provider, setProvider] = useState<any>(null)
  const [service, setService] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [{ data: profile }, { data: opp }] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, location, provider_profiles(category)')
        .eq('id', params.providerId)
        .single(),
      supabase
        .from('opportunities')
        .select('*')
        .eq('id', params.serviceId)
        .single(),
    ])

    setProvider(profile)
    setService(opp)
    setLoading(false)
  }

  const answers = params.answers ? JSON.parse(params.answers) : []
  const visibleAnswers = answers.filter((a: any) => a.answer !== null)
  const price = parseInt(params.servicePrice ?? '0')
  const platformFee = price > 0 ? Math.round(price * 0.03 + 40) : 0
  const total = price + platformFee

  const dateDisplay = params.selectedDate
    ? new Date(params.selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  const duration = parseInt(params.serviceDuration ?? '60')
  const durationLabel = duration < 60
    ? `${duration} min`
    : `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}m` : ''}`

  const cancellationPolicy = service?.cancellation_policy_label
    ? service.cancellation_policy_label.charAt(0).toUpperCase() + service.cancellation_policy_label.slice(1)
    : 'Flexible'

  function goToPayment() {
    router.push({
      pathname: '/book/[providerId]/payment' as any,
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
      },
    })
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#111" />
      </View>
    )
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Review booking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={s.summaryCard}>
          <Text style={s.summaryCardTitle}>{params.serviceName}</Text>
          <Text style={s.summaryCardProvider}>with {provider?.full_name ?? 'Provider'}</Text>

          <View style={s.divider} />

          <View style={s.summaryRow}>
            <Calendar size={16} color="#888" />
            <Text style={s.summaryRowText}>{dateDisplay}</Text>
          </View>

          <View style={s.summaryRow}>
            <Clock size={16} color="#888" />
            <Text style={s.summaryRowText}>{params.selectedTime} · {durationLabel}</Text>
          </View>

          {provider?.location ? (
            <View style={s.summaryRow}>
              <MapPin size={16} color="#888" />
              <Text style={s.summaryRowText}>{provider.location}</Text>
            </View>
          ) : null}
        </View>

        {visibleAnswers.length > 0 ? (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Your answers</Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={s.changeText}>Change</Text>
              </TouchableOpacity>
            </View>

            {visibleAnswers.map((a: any, i: number) => (
              <View key={i} style={s.answerRow}>
                <Text style={s.answerQuestion}>{a.question}</Text>
                <Text style={s.answerValue}>
                  {a.type === 'photo' ? 'Photo attached' : String(a.answer)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Price details</Text>

          <View style={s.priceRow}>
            <Text style={s.priceLabel}>{params.serviceName}</Text>
            <Text style={s.priceValue}>£{(price / 100).toFixed(2)}</Text>
          </View>

          <View style={s.priceRow}>
            <Text style={s.priceLabel}>Platform fee</Text>
            <Text style={s.priceValue}>£{(platformFee / 100).toFixed(2)}</Text>
          </View>

          <View style={[s.priceRow, s.priceTotalRow]}>
            <Text style={s.priceTotalLabel}>Total</Text>
            <Text style={s.priceTotalValue}>£{(total / 100).toFixed(2)}</Text>
          </View>
        </View>

        <View style={s.policyCard}>
          <Shield size={18} color="#888" />
          <View style={s.policyInfo}>
            <Text style={s.policyTitle}>Cancellation policy</Text>
            <Text style={s.policyDesc}>
              {cancellationPolicy === 'Flexible'
                ? 'Free cancellation any time'
                : cancellationPolicy === 'Moderate'
                ? '50% fee if cancelled within 24 hours'
                : '100% fee if cancelled within 48 hours'}
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={s.footer}>
        <View style={s.footerPrice}>
          <Text style={s.footerTotal}>£{(total / 100).toFixed(2)}</Text>
          <Text style={s.footerTotalLabel}>total</Text>
        </View>

        <TouchableOpacity
          style={s.continueBtn}
          onPress={goToPayment}
          activeOpacity={0.88}
        >
          <Text style={s.continueBtnText}>Continue to payment</Text>
          <ChevronRight size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111' },

  content: { paddingHorizontal: 20, paddingTop: 20 },

  summaryCard: {
    borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 20,
    padding: 20, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  summaryCardTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 4 },
  summaryCardProvider: { fontSize: 14, color: '#888', marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#f5f5f5', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  summaryRowText: { fontSize: 14, color: '#444', flex: 1 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  changeText: { fontSize: 14, fontWeight: '600', color: '#ff5a1f' },

  answerRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  answerQuestion: { fontSize: 12, color: '#888', marginBottom: 4 },
  answerValue: { fontSize: 14, fontWeight: '500', color: '#111' },

  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  priceTotalRow: { borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 4, paddingTop: 14 },
  priceLabel: { fontSize: 14, color: '#666' },
  priceValue: { fontSize: 14, color: '#111' },
  priceTotalLabel: { fontSize: 16, fontWeight: '700', color: '#111' },
  priceTotalValue: { fontSize: 18, fontWeight: '700', color: '#111' },

  policyCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#f9f9f9', borderRadius: 14, padding: 16, marginBottom: 20,
  },
  policyInfo: { flex: 1 },
  policyTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 4 },
  policyDesc: { fontSize: 13, color: '#888', lineHeight: 18 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: '#f5f5f5',
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  footerPrice: { alignItems: 'flex-start' },
  footerTotal: { fontSize: 20, fontWeight: '700', color: '#111' },
  footerTotalLabel: { fontSize: 12, color: '#888' },
  continueBtn: {
    flex: 1, height: 56, borderRadius: 16, backgroundColor: '#111',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})