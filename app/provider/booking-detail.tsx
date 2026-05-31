import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Calendar, Clock, MapPin, Shield,
  CheckCircle, XCircle, MessageCircle, User,
} from 'lucide-react-native'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function BookingDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [booking, setBooking] = useState<any>(null)
  const [customer, setCustomer] = useState<any>(null)
  const [service, setService] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (id) loadBooking(id as string)
  }, [id])

  async function loadBooking(bookingId: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (error || !data) {
      console.log('Booking load error:', error)
      setLoading(false)
      return
    }

    setBooking(data)

    const [{ data: cust }, { data: opp }] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, location')
        .eq('id', data.customer_id)
        .single(),
      data.opportunity_id
        ? supabase
            .from('opportunities')
            .select('title, cancellation_policy_label, cancellation_window_hours, cancellation_fee_percent')
            .eq('id', data.opportunity_id)
            .single()
        : Promise.resolve({ data: null }),
    ])

    setCustomer(cust)
    setService(opp)
    setLoading(false)
  }

async function updateStatus(newStatus: 'confirmed' | 'cancelled') {
  const bookingId = Array.isArray(id) ? id[0] : id
  if (!bookingId || acting) return

  setActing(true)

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', bookingId)
    .select()
    .single()

  if (error) {
    console.log('Booking status update error:', error)
    Alert.alert('Error', error.message)
    setActing(false)
    return
  }

  setBooking(data)
  setActing(false)
}

function confirmAccept() {
  updateStatus('confirmed')
}

function confirmDecline() {
  updateStatus('cancelled')
}

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color="#ff5a1f" />
    </View>
  )

  if (!booking) return (
    <View style={s.center}>
      <Text style={{ color: '#888', fontSize: 14 }}>Booking not found</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
        <Text style={{ color: '#ff5a1f', fontSize: 14 }}>Go back</Text>
      </TouchableOpacity>
    </View>
  )

  const isPending = booking.status === 'pending'
  const isConfirmed = booking.status === 'confirmed'
  const isCancelled = booking.status === 'cancelled'

  const startsAt = booking.starts_at ? new Date(booking.starts_at) : null
  const dateDisplay = startsAt
    ? `${DAYS_FULL[startsAt.getDay()]}, ${startsAt.getDate()} ${MONTHS[startsAt.getMonth()]} ${startsAt.getFullYear()}`
    : '—'
  const timeDisplay = startsAt
    ? startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—'

  const duration = booking.duration_minutes
  const durationLabel = duration
    ? duration < 60 ? `${duration} min`
    : `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}m` : ''}`
    : null

  const amountPence = booking.amount_pence ?? 0
  const feePence = booking.fee_pence ?? 0
  const youReceive = amountPence - feePence

  const statusColors: Record<string, { bg: string; text: string }> = {
    pending:   { bg: '#fff9e6', text: '#d97706' },
    confirmed: { bg: '#e7f7ef', text: '#059669' },
    cancelled: { bg: '#fff0f0', text: '#dc2626' },
  }
  const sc = statusColors[booking.status] ?? statusColors.pending

  const answers: any[] = booking.booking_answers ?? []

  const cancellationDesc =
    service?.cancellation_policy_label === 'moderate' ? '50% fee if cancelled within 24 hours' :
    service?.cancellation_policy_label === 'strict' ? '100% fee if cancelled within 48 hours' :
    'Free cancellation any time'

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Booking request</Text>
        <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[s.statusBadgeText, { color: sc.text }]}>
            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* Customer card */}
        <View style={s.customerCard}>
          <View style={s.customerAvatar}>
            <Text style={s.customerAvatarText}>
              {(customer?.full_name ?? 'C').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={s.customerInfo}>
            <Text style={s.customerName}>{customer?.full_name ?? 'Customer'}</Text>
            {customer?.location && (
              <View style={s.customerMeta}>
                <MapPin size={12} color="#888" />
                <Text style={s.customerMetaText}>{customer.location}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={s.msgBtn}
            onPress={() => router.push(`/messages/${booking.customer_id}` as any)}
          >
            <MessageCircle size={18} color="#111" />
          </TouchableOpacity>
        </View>

        {/* Booking details */}
        <View style={s.detailsCard}>
          <Text style={s.detailsService}>
            {booking.service_name ?? service?.title ?? 'Service'}
          </Text>
          <View style={s.detailRow}>
            <Calendar size={15} color="#888" />
            <Text style={s.detailText}>{dateDisplay}</Text>
          </View>
          <View style={s.detailRow}>
            <Clock size={15} color="#888" />
            <Text style={s.detailText}>
              {timeDisplay}{durationLabel ? ` · ${durationLabel}` : ''}
            </Text>
          </View>
          <View style={s.divider} />
          <View style={s.priceRow}>
            <Text style={s.priceLabel}>Service fee</Text>
            <Text style={s.priceValue}>£{(amountPence / 100).toFixed(2)}</Text>
          </View>
          {feePence > 0 && (
            <View style={s.priceRow}>
              <Text style={s.priceLabel}>Platform fee</Text>
              <Text style={s.priceValue}>− £{(feePence / 100).toFixed(2)}</Text>
            </View>
          )}
          <View style={[s.priceRow, s.priceTotalRow]}>
            <Text style={s.priceTotalLabel}>You receive</Text>
            <Text style={s.priceTotalValue}>£{(youReceive / 100).toFixed(2)}</Text>
          </View>
        </View>

        {/* Answers */}
        {answers.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Customer answers</Text>
            {answers.map((a: any, i: number) => (
              <View key={i} style={s.answerItem}>
                <Text style={s.answerQ}>{a.question}</Text>
                {a.type === 'photo' && a.answer ? (
                  <Image source={{ uri: a.answer }} style={s.answerPhoto} resizeMode="cover" />
                ) : (
                  <Text style={s.answerA}>
                    {a.answer ? String(a.answer) : 'Not answered'}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {answers.length === 0 && (
          <View style={s.noAnswers}>
            <User size={18} color="#ddd" />
            <Text style={s.noAnswersText}>No booking questions for this service</Text>
          </View>
        )}

        {/* Cancellation policy */}
        <View style={s.policyCard}>
          <Shield size={16} color="#888" />
          <View style={s.policyInfo}>
            <Text style={s.policyTitle}>Cancellation policy</Text>
            <Text style={s.policyDesc}>{cancellationDesc}</Text>
          </View>
        </View>

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* Pending — accept / decline */}
      {isPending && (
        <View style={s.actions}>
          <TouchableOpacity
            style={s.declineBtn}
            onPress={confirmDecline}
            disabled={acting}
            activeOpacity={0.8}
          >
            {acting
              ? <ActivityIndicator size="small" color="#dc2626" />
              : <>
                  <XCircle size={18} color="#dc2626" />
                  <Text style={s.declineBtnText}>Decline</Text>
                </>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={s.acceptBtn}
            onPress={confirmAccept}
            disabled={acting}
            activeOpacity={0.88}
          >
            {acting
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <CheckCircle size={18} color="#fff" />
                  <Text style={s.acceptBtnText}>Accept booking</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Confirmed */}
      {isConfirmed && (
        <View style={s.confirmedFooter}>
          <View style={s.confirmedPill}>
            <CheckCircle size={16} color="#059669" />
            <Text style={s.confirmedPillText}>Booking confirmed</Text>
          </View>
          <TouchableOpacity
            style={s.msgFullBtn}
            onPress={() => router.push(`/messages/${booking.customer_id}` as any)}
          >
            <MessageCircle size={16} color="#111" />
            <Text style={s.msgFullBtnText}>Message</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cancelled */}
      {isCancelled && (
        <View style={s.cancelledFooter}>
          <Text style={s.cancelledText}>This booking was declined</Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },

  content: { paddingHorizontal: 20, paddingTop: 20 },

  customerCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#f9f9f9', borderRadius: 16, padding: 16, marginBottom: 16 },
  customerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  customerAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4 },
  customerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  customerMetaText: { fontSize: 12, color: '#888' },
  msgBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },

  detailsCard: { borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 20, padding: 20, marginBottom: 16 },
  detailsService: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  detailText: { fontSize: 14, color: '#444' },
  divider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 14 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  priceTotalRow: { borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 6, paddingTop: 12 },
  priceLabel: { fontSize: 14, color: '#666' },
  priceValue: { fontSize: 14, color: '#111' },
  priceTotalLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  priceTotalValue: { fontSize: 17, fontWeight: '700', color: '#111' },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 12 },
  answerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  answerQ: { fontSize: 12, color: '#888', marginBottom: 6 },
  answerA: { fontSize: 14, fontWeight: '500', color: '#111' },
  answerPhoto: { width: '100%', height: 180, borderRadius: 12, marginTop: 8 },

  noAnswers: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f9f9f9', borderRadius: 14, padding: 16, marginBottom: 16 },
  noAnswersText: { fontSize: 13, color: '#bbb' },

  policyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#f9f9f9', borderRadius: 14, padding: 16, marginBottom: 20 },
  policyInfo: { flex: 1 },
  policyTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 4 },
  policyDesc: { fontSize: 13, color: '#888', lineHeight: 18 },

  actions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: '#f5f5f5',
    flexDirection: 'row', gap: 12,
  },
  declineBtn: { flex: 1, height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: '#fca5a5', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  declineBtnText: { fontSize: 15, fontWeight: '600', color: '#dc2626' },
  acceptBtn: { flex: 2, height: 54, borderRadius: 14, backgroundColor: '#111', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  acceptBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  confirmedFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: '#f5f5f5',
    flexDirection: 'row', gap: 12, alignItems: 'center',
  },
  confirmedPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e7f7ef', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  confirmedPillText: { fontSize: 14, fontWeight: '600', color: '#059669' },
  msgFullBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#e0e0e0', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  msgFullBtnText: { fontSize: 14, fontWeight: '600', color: '#111' },

  cancelledFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: '#f5f5f5', alignItems: 'center',
  },
  cancelledText: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
})
