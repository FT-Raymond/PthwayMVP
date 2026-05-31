// app/(tabs)/payments.tsx
// Customer payment history + refund requests

import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import {
  ChevronRight, X, Shield, RefreshCw,
  CheckCircle, Clock, AlertCircle,
} from 'lucide-react-native'

function formatPence(p: number) { return `£${(p / 100).toFixed(2)}` }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const REFUND_REASONS = [
  'Provider cancelled',
  'Service not as described',
  'Did not receive service',
  'Duplicate charge',
  'Other',
]

const REFUND_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: 'Under review', bg: '#fff9e6', color: '#d97706' },
  approved: { label: 'Refunded',     bg: '#e7f7ef', color: '#059669' },
  denied:   { label: 'Denied',       bg: '#fff0f0', color: '#dc2626' },
}

export default function CustomerPaymentsScreen() {
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<any[]>([])
  const [refundRequests, setRefundRequests] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [showRefundFlow, setShowRefundFlow] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundMessage, setRefundMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: bk }, { data: refunds }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, provider_id, service_name, amount_pence, fee_pence, payment_status, status, starts_at, created_at')
        .eq('customer_id', user.id)
        .not('payment_status', 'eq', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('refund_requests')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    const ids = Array.from(new Set((bk ?? []).map((b: any) => b.provider_id)))
    const names = new Map<string, string>()
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      ;(profiles ?? []).forEach((p: any) => names.set(p.id, p.full_name ?? 'Provider'))
    }

    setBookings((bk ?? []).map((b: any) => ({
      ...b,
      providerName: names.get(b.provider_id) ?? 'Provider',
      total: b.amount_pence ?? 0,
    })))
    setRefundRequests(refunds ?? [])
    setLoading(false)
  }

  async function submitRefundRequest() {
    if (!refundReason) { Alert.alert('Select a reason'); return }
    if (!selected) return

    setSubmitting(true)
    try {
      const resp = await supabase.functions.invoke('request-refund', {
        body: {
          action: 'request',
          bookingId: selected.id,
          reason: refundReason,
          message: refundMessage,
        },
      })
      if (resp.error) throw new Error(resp.error.message)
      Alert.alert('Request submitted', 'The provider will review your refund request.')
      setShowRefundFlow(false)
      setSelected(null)
      setRefundReason('')
      setRefundMessage('')
      loadData()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong')
    }
    setSubmitting(false)
  }

  const totalSpent = bookings
    .filter(b => b.payment_status === 'captured')
    .reduce((s, b) => s + b.total, 0)

  const pendingRefundCount = refundRequests.filter(r => r.status === 'pending').length

  if (loading) return <View style={s.center}><ActivityIndicator color="#111" /></View>

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* Header */}
        <Text style={s.title}>Payments</Text>

        {/* Summary cards */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Total spent</Text>
            <Text style={s.summaryValue}>{formatPence(totalSpent)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Transactions</Text>
            <Text style={s.summaryValue}>{bookings.length}</Text>
          </View>
        </View>

        {/* Pending refunds */}
        {pendingRefundCount > 0 && (
          <View style={s.refundBanner}>
            <Clock size={15} color="#d97706" />
            <Text style={s.refundBannerText}>
              {pendingRefundCount} refund request{pendingRefundCount > 1 ? 's' : ''} under review
            </Text>
          </View>
        )}

        {/* Protection note */}
        <View style={s.protectionCard}>
          <Shield size={16} color="#059669" />
          <Text style={s.protectionText}>
            All payments are protected by Pthway. Contact support if you have an issue.
          </Text>
        </View>

        {/* Transaction list */}
        <Text style={s.sectionTitle}>Payment history</Text>
        {bookings.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No payments yet</Text>
          </View>
        ) : (
          <View style={s.txList}>
            {bookings.map((b, i) => {
              const refund = refundRequests.find(r => r.booking_id === b.id)
              const rs = refund ? REFUND_STATUS[refund.status] : null
              const isPaid = b.payment_status === 'captured'
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[s.txCard, i < bookings.length - 1 && s.txCardBorder]}
                  onPress={() => setSelected(b)}
                  activeOpacity={0.85}
                >
                  <View style={s.txServiceIcon}>
                    <Text style={s.txServiceIconText}>{(b.service_name ?? 'S').slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={s.txInfo}>
                    <Text style={s.txService}>{b.service_name ?? 'Service'}</Text>
                    <Text style={s.txProvider}>{b.providerName}</Text>
                    <Text style={s.txDate}>{fmtDate(b.created_at)}</Text>
                    {rs && (
                      <View style={[s.refundBadge, { backgroundColor: rs.bg }]}>
                        <Text style={[s.refundBadgeText, { color: rs.color }]}>{rs.label}</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.txRight}>
                    <Text style={s.txAmount}>{formatPence(b.total)}</Text>
                    <ChevronRight size={14} color="#ccc" />
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Transaction detail modal */}
      <Modal visible={!!selected && !showRefundFlow} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={m.overlay}>
          <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={() => setSelected(null)} />
          <View style={m.sheet}>
            <View style={m.handle} />
            {selected && (() => {
              const refund = refundRequests.find(r => r.booking_id === selected.id)
              const canRefund = selected.payment_status === 'captured' && !refund
              return (
                <ScrollView style={m.scroll} showsVerticalScrollIndicator={false}>
                  <View style={m.sheetHeader}>
                    <Text style={m.sheetTitle}>{selected.service_name ?? 'Service'}</Text>
                    <TouchableOpacity style={m.closeBtn} onPress={() => setSelected(null)}>
                      <X size={16} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <Text style={m.providerName}>with {selected.providerName}</Text>
                  <Text style={m.date}>{fmtDate(selected.created_at)}</Text>

                  <View style={m.divider} />

                  <View style={m.priceRow}>
                    <Text style={m.priceLabel}>Service</Text>
                    <Text style={m.priceValue}>{formatPence((selected.amount_pence ?? 0) - (selected.fee_pence ?? 0))}</Text>
                  </View>
                  <View style={m.priceRow}>
                    <Text style={m.priceLabel}>Platform fee</Text>
                    <Text style={m.priceValue}>{formatPence(selected.fee_pence ?? 0)}</Text>
                  </View>
                  <View style={[m.priceRow, m.priceTotalRow]}>
                    <Text style={m.priceTotalLabel}>Total paid</Text>
                    <Text style={m.priceTotalValue}>{formatPence(selected.total)}</Text>
                  </View>

                  {refund && (
                    <View style={[m.statusCard, { backgroundColor: REFUND_STATUS[refund.status]?.bg ?? '#f5f5f5' }]}>
                      <Text style={[m.statusCardText, { color: REFUND_STATUS[refund.status]?.color ?? '#888' }]}>
                        Refund {REFUND_STATUS[refund.status]?.label?.toLowerCase() ?? refund.status}
                      </Text>
                      {refund.provider_response && (
                        <Text style={m.statusCardNote}>Provider note: {refund.provider_response}</Text>
                      )}
                    </View>
                  )}

                  {canRefund && (
                    <TouchableOpacity
                      style={m.refundBtn}
                      onPress={() => setShowRefundFlow(true)}
                    >
                      <RefreshCw size={16} color="#111" />
                      <Text style={m.refundBtnText}>Request a refund</Text>
                    </TouchableOpacity>
                  )}

                  <View style={{ height: 40 }} />
                </ScrollView>
              )
            })()}
          </View>
        </View>
      </Modal>

      {/* Refund request flow */}
      <Modal visible={showRefundFlow} animationType="slide" transparent onRequestClose={() => setShowRefundFlow(false)}>
        <View style={m.overlay}>
          <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={() => setShowRefundFlow(false)} />
          <View style={m.sheet}>
            <View style={m.handle} />
            <ScrollView style={m.scroll} showsVerticalScrollIndicator={false}>
              <View style={m.sheetHeader}>
                <Text style={m.sheetTitle}>Request refund</Text>
                <TouchableOpacity style={m.closeBtn} onPress={() => setShowRefundFlow(false)}>
                  <X size={16} color="#666" />
                </TouchableOpacity>
              </View>

              <Text style={m.refundSubtitle}>What's the reason for your refund?</Text>

              <View style={m.reasonList}>
                {REFUND_REASONS.map(reason => (
                  <TouchableOpacity
                    key={reason}
                    style={[m.reasonBtn, refundReason === reason && m.reasonBtnActive]}
                    onPress={() => setRefundReason(reason)}
                  >
                    <Text style={[m.reasonText, refundReason === reason && m.reasonTextActive]}>{reason}</Text>
                    {refundReason === reason && <CheckCircle size={16} color="#111" />}
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={m.messageInput}
                value={refundMessage}
                onChangeText={setRefundMessage}
                placeholder="Additional details (optional)..."
                placeholderTextColor="#bbb"
                multiline
              />

              <View style={m.refundEligibility}>
                <Shield size={14} color="#059669" />
                <Text style={m.refundEligibilityText}>
                  Refund requests are reviewed within 48 hours. The provider will respond first.
                </Text>
              </View>

              <TouchableOpacity
                style={[m.submitBtn, !refundReason && m.submitBtnDisabled]}
                onPress={submitRefundRequest}
                disabled={!refundReason || submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={m.submitBtnText}>Submit request</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, color: '#111', marginBottom: 20 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: '#f9f9f9', borderRadius: 16, padding: 16 },
  summaryLabel: { fontSize: 12, color: '#888', marginBottom: 6 },
  summaryValue: { fontSize: 22, fontWeight: '700', color: '#111', letterSpacing: -0.5 },
  refundBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff9e6', borderRadius: 14, padding: 14, marginBottom: 12 },
  refundBannerText: { fontSize: 13, fontWeight: '600', color: '#d97706' },
  protectionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0faf4', borderRadius: 14, padding: 14, marginBottom: 24 },
  protectionText: { flex: 1, fontSize: 13, color: '#059669', lineHeight: 18 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 14 },
  emptyBox: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#bbb' },
  txList: {},
  txCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  txCardBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  txServiceIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,90,31,0.1)', justifyContent: 'center', alignItems: 'center' },
  txServiceIconText: { fontSize: 12, fontWeight: '700', color: '#ff5a1f' },
  txInfo: { flex: 1 },
  txService: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  txProvider: { fontSize: 12, color: '#888', marginBottom: 2 },
  txDate: { fontSize: 11, color: '#bbb', marginBottom: 4 },
  refundBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  refundBadgeText: { fontSize: 10, fontWeight: '700' },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 15, fontWeight: '700', color: '#111' },
})

const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#e0e0e0', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  scroll: { paddingHorizontal: 24 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  providerName: { fontSize: 14, color: '#888', marginBottom: 4 },
  date: { fontSize: 12, color: '#bbb', marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#f5f5f5', marginBottom: 16 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  priceTotalRow: { borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 4, paddingTop: 12 },
  priceLabel: { fontSize: 14, color: '#666' },
  priceValue: { fontSize: 14, color: '#111' },
  priceTotalLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  priceTotalValue: { fontSize: 17, fontWeight: '700', color: '#111' },
  statusCard: { borderRadius: 14, padding: 14, marginTop: 16 },
  statusCardText: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  statusCardNote: { fontSize: 12, color: '#666', lineHeight: 17 },
  refundBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, padding: 14, marginTop: 16 },
  refundBtnText: { fontSize: 14, fontWeight: '600', color: '#111' },
  refundSubtitle: { fontSize: 15, color: '#666', marginBottom: 16, lineHeight: 21 },
  reasonList: { gap: 8, marginBottom: 16 },
  reasonBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, padding: 14 },
  reasonBtnActive: { borderColor: '#111', backgroundColor: '#f9f9f9' },
  reasonText: { fontSize: 14, color: '#666' },
  reasonTextActive: { fontWeight: '600', color: '#111' },
  messageInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, padding: 14, fontSize: 14, color: '#111', minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  refundEligibility: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#f0faf4', borderRadius: 12, padding: 14, marginBottom: 20 },
  refundEligibilityText: { flex: 1, fontSize: 12, color: '#059669', lineHeight: 17 },
  submitBtn: { height: 56, borderRadius: 16, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#f0f0f0' },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
