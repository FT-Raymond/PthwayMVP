// app/provider/transactions.tsx
// Full transaction history + refund management for providers

import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Search, Filter, ChevronDown,
  X, CheckCircle, XCircle, AlertCircle,
} from 'lucide-react-native'

const { width } = Dimensions.get('window')

function formatPence(p: number) { return `£${(p / 100).toFixed(2)}` }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TX_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  captured:  { label: 'Paid',     bg: '#e7f7ef', color: '#059669' },
  authorized:{ label: 'Pending',  bg: '#fff9e6', color: '#d97706' },
  pending:   { label: 'Pending',  bg: '#fff9e6', color: '#d97706' },
  refunded:  { label: 'Refunded', bg: '#f0f0f0', color: '#666'    },
  cancelled: { label: 'Void',     bg: '#fff0f0', color: '#dc2626' },
}

export default function TransactionsScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [refundRequests, setRefundRequests] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [refundModalVisible, setRefundModalVisible] = useState(false)
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'refunds'>('all')
  const [acting, setActing] = useState(false)
  const [refundNote, setRefundNote] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: bookings }, { data: refunds }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, customer_id, service_name, amount_pence, fee_pence, payment_status, status, starts_at, created_at')
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('refund_requests')
        .select('*')
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    const ids = Array.from(new Set((bookings ?? []).map((b: any) => b.customer_id)))
    const names = new Map<string, string>()
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      ;(profiles ?? []).forEach((p: any) => names.set(p.id, p.full_name ?? 'Customer'))
    }

    setTransactions((bookings ?? []).map((b: any) => ({
      ...b,
      customerName: names.get(b.customer_id) ?? 'Customer',
      net: (b.amount_pence ?? 0) - (b.fee_pence ?? 0),
    })))

    setRefundRequests(refunds ?? [])
    setLoading(false)
  }

  const pendingRefunds = refundRequests.filter(r => r.status === 'pending')

  const filtered = transactions.filter(tx => {
    if (filter === 'paid') return tx.payment_status === 'captured'
    if (filter === 'pending') return tx.payment_status === 'authorized' || tx.payment_status === 'pending'
    if (filter === 'refunds') return tx.payment_status === 'refunded'
    return true
  })

  async function handleRefundAction(action: 'approve' | 'deny', refundId: string) {
    setActing(true)
    try {
      const resp = await supabase.functions.invoke('request-refund', {
        body: {
          action,
          refundRequestId: refundId,
          responseNote: refundNote,
        },
      })
      if (resp.error) throw new Error(resp.error.message)
      Alert.alert(action === 'approve' ? 'Refund approved' : 'Refund denied', '')
      setRefundModalVisible(false)
      setRefundNote('')
      loadData()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong')
    }
    setActing(false)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#111" /></View>

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Transactions</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Pending refunds banner */}
      {pendingRefunds.length > 0 && (
        <TouchableOpacity
          style={s.refundBanner}
          onPress={() => { setSelected(pendingRefunds[0]); setRefundModalVisible(true) }}
        >
          <AlertCircle size={16} color="#d97706" />
          <Text style={s.refundBannerText}>
            {pendingRefunds.length} refund request{pendingRefunds.length > 1 ? 's' : ''} need your response
          </Text>
          <ChevronDown size={14} color="#d97706" />
        </TouchableOpacity>
      )}

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filters}
        contentContainerStyle={s.filtersContent}
      >
        {(['all', 'paid', 'pending', 'refunds'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterChip, filter === f && s.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterChipText, filter === f && s.filterChipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {filtered.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No transactions</Text>
          </View>
        ) : (
          <View style={s.txList}>
            {filtered.map((tx, i) => {
              const sc = TX_STATUS[tx.payment_status] ?? TX_STATUS.pending
              return (
                <TouchableOpacity
                  key={tx.id}
                  style={[s.txCard, i < filtered.length - 1 && s.txCardBorder]}
                  onPress={() => setSelected(tx)}
                  activeOpacity={0.85}
                >
                  <View style={s.txAvatar}>
                    <Text style={s.txAvatarText}>{tx.customerName.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={s.txInfo}>
                    <Text style={s.txName}>{tx.customerName}</Text>
                    <Text style={s.txService}>{tx.service_name ?? 'Service'}</Text>
                    <Text style={s.txDate}>{fmtDate(tx.created_at)}</Text>
                  </View>
                  <View style={s.txRight}>
                    <Text style={s.txNet}>{formatPence(tx.net)}</Text>
                    <View style={[s.txStatusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.txStatusText, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Transaction detail modal */}
      <Modal visible={!!selected && !refundModalVisible} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={m.overlay}>
          <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={() => setSelected(null)} />
          <View style={m.sheet}>
            <View style={m.handle} />
            <ScrollView style={m.scroll} showsVerticalScrollIndicator={false}>
              {selected && (() => {
                const sc = TX_STATUS[selected.payment_status] ?? TX_STATUS.pending
                const pendingRefund = refundRequests.find(r => r.booking_id === selected.id && r.status === 'pending')
                return (
                  <>
                    <View style={m.sheetHeader}>
                      <Text style={m.sheetTitle}>{selected.service_name ?? 'Service'}</Text>
                      <TouchableOpacity style={m.closeBtn} onPress={() => setSelected(null)}>
                        <X size={16} color="#666" />
                      </TouchableOpacity>
                    </View>

                    <Text style={m.customerName}>{selected.customerName}</Text>
                    <Text style={m.date}>{fmtDate(selected.created_at)}</Text>

                    <View style={m.divider} />

                    <View style={m.priceRow}>
                      <Text style={m.priceLabel}>Gross amount</Text>
                      <Text style={m.priceValue}>{formatPence(selected.amount_pence ?? 0)}</Text>
                    </View>
                    <View style={m.priceRow}>
                      <Text style={m.priceLabel}>Platform fee (3% + 40p)</Text>
                      <Text style={m.priceValue}>− {formatPence(selected.fee_pence ?? 0)}</Text>
                    </View>
                    <View style={[m.priceRow, m.priceTotalRow]}>
                      <Text style={m.priceTotalLabel}>Net earnings</Text>
                      <Text style={m.priceTotalValue}>{formatPence(selected.net)}</Text>
                    </View>

                    <View style={[m.statusBadge, { backgroundColor: sc.bg, alignSelf: 'flex-start', marginTop: 16 }]}>
                      <Text style={[m.statusText, { color: sc.color }]}>{sc.label}</Text>
                    </View>

                    {pendingRefund && (
                      <TouchableOpacity
                        style={m.refundActionBtn}
                        onPress={() => { setRefundModalVisible(true) }}
                      >
                        <AlertCircle size={16} color="#d97706" />
                        <Text style={m.refundActionText}>Refund request pending — tap to respond</Text>
                      </TouchableOpacity>
                    )}

                    <View style={{ height: 40 }} />
                  </>
                )
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Refund action modal */}
      <Modal visible={refundModalVisible} animationType="slide" transparent onRequestClose={() => setRefundModalVisible(false)}>
        <View style={m.overlay}>
          <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={() => setRefundModalVisible(false)} />
          <View style={m.sheet}>
            <View style={m.handle} />
            <ScrollView style={m.scroll}>
              {(() => {
                const refund = selected && refundRequests.find(r => r.booking_id === (selected.id ?? selected.booking_id) && r.status === 'pending')
                  || (selected?.status !== undefined ? selected : null)
                if (!refund) return null
                return (
                  <>
                    <View style={m.sheetHeader}>
                      <Text style={m.sheetTitle}>Refund request</Text>
                      <TouchableOpacity style={m.closeBtn} onPress={() => setRefundModalVisible(false)}>
                        <X size={16} color="#666" />
                      </TouchableOpacity>
                    </View>

                    <View style={m.refundReasonCard}>
                      <Text style={m.refundLabel}>Customer's reason</Text>
                      <Text style={m.refundReason}>{refund.reason ?? 'No reason provided'}</Text>
                      {refund.message && <Text style={m.refundMessage}>{refund.message}</Text>}
                    </View>

                    <Text style={m.refundAmount}>
                      Refund amount: {formatPence(refund.amount_pence ?? 0)}
                    </Text>

                    <TextInput
                      style={m.noteInput}
                      value={refundNote}
                      onChangeText={setRefundNote}
                      placeholder="Add a response note (optional)..."
                      placeholderTextColor="#bbb"
                      multiline
                    />

                    <View style={m.refundActions}>
                      <TouchableOpacity
                        style={m.denyBtn}
                        onPress={() => handleRefundAction('deny', refund.id)}
                        disabled={acting}
                      >
                        {acting ? <ActivityIndicator size="small" color="#dc2626" /> : (
                          <>
                            <XCircle size={16} color="#dc2626" />
                            <Text style={m.denyBtnText}>Deny</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={m.approveBtn}
                        onPress={() => handleRefundAction('approve', refund.id)}
                        disabled={acting}
                      >
                        {acting ? <ActivityIndicator size="small" color="#fff" /> : (
                          <>
                            <CheckCircle size={16} color="#fff" />
                            <Text style={m.approveBtnText}>Approve refund</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                    <View style={{ height: 40 }} />
                  </>
                )
              })()}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  refundBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff9e6', paddingHorizontal: 20, paddingVertical: 12 },
  refundBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#d97706' },
  filters: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  filtersContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
  filterChipActive: { backgroundColor: '#111', borderColor: '#111' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterChipTextActive: { color: '#fff' },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  emptyBox: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#bbb' },
  txList: {},
  txCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  txCardBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  txAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  txAvatarText: { fontSize: 15, fontWeight: '700', color: '#111' },
  txInfo: { flex: 1 },
  txName: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  txService: { fontSize: 12, color: '#888', marginBottom: 2 },
  txDate: { fontSize: 11, color: '#bbb' },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txNet: { fontSize: 15, fontWeight: '700', color: '#111' },
  txStatusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  txStatusText: { fontSize: 10, fontWeight: '700' },
})

const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '80%' },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#e0e0e0', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  scroll: { paddingHorizontal: 24 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 14, color: '#888', marginBottom: 4 },
  date: { fontSize: 12, color: '#bbb', marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#f5f5f5', marginBottom: 16 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  priceTotalRow: { borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 4, paddingTop: 12 },
  priceLabel: { fontSize: 14, color: '#666' },
  priceValue: { fontSize: 14, color: '#111' },
  priceTotalLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  priceTotalValue: { fontSize: 17, fontWeight: '700', color: '#111' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: '700' },
  refundActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff9e6', borderRadius: 14, padding: 14, marginTop: 16 },
  refundActionText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#d97706' },
  refundReasonCard: { backgroundColor: '#f9f9f9', borderRadius: 14, padding: 16, marginBottom: 16 },
  refundLabel: { fontSize: 11, color: '#888', marginBottom: 6 },
  refundReason: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 4 },
  refundMessage: { fontSize: 13, color: '#666', lineHeight: 18 },
  refundAmount: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 16 },
  noteInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, padding: 14, fontSize: 14, color: '#111', minHeight: 80, textAlignVertical: 'top', marginBottom: 20 },
  refundActions: { flexDirection: 'row', gap: 12 },
  denyBtn: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: '#fca5a5', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  denyBtnText: { fontSize: 15, fontWeight: '600', color: '#dc2626' },
  approveBtn: { flex: 2, height: 52, borderRadius: 14, backgroundColor: '#111', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  approveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
