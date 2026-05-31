// app/provider/earnings.tsx
// Provider earnings overview — available balance, pending, transactions, payout

import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { ProviderNav } from '@/components/ProviderNav'
import {
  TrendingUp, ChevronRight, ArrowUpRight,
  Wallet, Clock, DollarSign, RefreshCw,
} from 'lucide-react-native'

const { width } = Dimensions.get('window')

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatPence(pence: number) {
  return `£${(pence / 100).toFixed(2)}`
}

function MiniBar({ value, max, isCurrentMonth }: { value: number; max: number; isCurrentMonth: boolean }) {
  const height = max > 0 ? Math.max(4, (value / max) * 48) : 4
  return (
    <View style={{ height: 48, justifyContent: 'flex-end' }}>
      <View style={{
        width: 8, height, borderRadius: 4,
        backgroundColor: isCurrentMonth ? '#111' : '#e0e0e0',
      }} />
    </View>
  )
}

export default function EarningsScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState({
    availablePence: 0,
    pendingPence: 0,
    totalEarned: 0,
    thisMonth: 0,
    lastMonth: 0,
    monthlyData: [] as { month: string; amount: number }[],
    recentTx: [] as any[],
  })

  useFocusEffect(useCallback(() => { loadData() }, []))

  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setRefreshing(false); return }

    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, amount_pence, fee_pence, payment_status, status, starts_at, service_name, customer_id, created_at')
      .eq('provider_id', user.id)
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false })

    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    const captured = (bookings ?? []).filter(b => b.payment_status === 'captured')
    const pending = (bookings ?? []).filter(b => b.payment_status === 'authorized' || b.payment_status === 'pending')

    const availablePence = captured.reduce((s: number, b: any) => s + ((b.amount_pence ?? 0) - (b.fee_pence ?? 0)), 0)
    const pendingPence = pending.reduce((s: number, b: any) => s + ((b.amount_pence ?? 0) - (b.fee_pence ?? 0)), 0)
    const totalEarned = availablePence

    const thisMonth = captured
      .filter((b: any) => new Date(b.created_at) >= thisMonthStart)
      .reduce((s: number, b: any) => s + ((b.amount_pence ?? 0) - (b.fee_pence ?? 0)), 0)

    const lastMonth = captured
      .filter((b: any) => {
        const d = new Date(b.created_at)
        return d >= lastMonthStart && d <= lastMonthEnd
      })
      .reduce((s: number, b: any) => s + ((b.amount_pence ?? 0) - (b.fee_pence ?? 0)), 0)

    // Build 6-month chart
    const monthlyData = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0)
      const amount = captured
        .filter((b: any) => {
          const bd = new Date(b.created_at)
          return bd >= d && bd <= end
        })
        .reduce((s: number, b: any) => s + ((b.amount_pence ?? 0) - (b.fee_pence ?? 0)), 0)
      return { month: MONTH_LABELS[d.getMonth()], amount }
    })

    // Fetch customer names for recent tx
    const ids = Array.from(new Set((bookings ?? []).slice(0, 10).map((b: any) => b.customer_id)))
    const names = new Map<string, string>()
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      ;(profiles ?? []).forEach((p: any) => names.set(p.id, p.full_name ?? 'Customer'))
    }

    const recentTx = (bookings ?? []).slice(0, 8).map((b: any) => ({
      ...b,
      customerName: names.get(b.customer_id) ?? 'Customer',
      net: (b.amount_pence ?? 0) - (b.fee_pence ?? 0),
    }))

    setData({ availablePence, pendingPence, totalEarned, thisMonth, lastMonth, monthlyData, recentTx })
    setLoading(false)
    setRefreshing(false)
  }

  const maxBar = Math.max(1, ...data.monthlyData.map(m => m.amount))
  const currentMonthIdx = 5 // last in array is current

  if (loading) return <View style={s.center}><ActivityIndicator color="#111" /></View>

  const growth = data.lastMonth > 0
    ? Math.round(((data.thisMonth - data.lastMonth) / data.lastMonth) * 100)
    : data.thisMonth > 0 ? 100 : 0

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor="#111" />}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Earnings</Text>
          <TouchableOpacity
            style={s.txBtn}
            onPress={() => router.push('/provider/transactions' as any)}
          >
            <Text style={s.txBtnText}>Transactions</Text>
            <ChevronRight size={14} color="#111" />
          </TouchableOpacity>
        </View>

        {/* Hero balance card */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>Available to pay out</Text>
          <Text style={s.heroBalance}>{formatPence(data.availablePence)}</Text>

          <View style={s.heroStats}>
            <View style={s.heroStat}>
              <Clock size={13} color="rgba(255,255,255,0.5)" />
              <Text style={s.heroStatLabel}>Pending</Text>
              <Text style={s.heroStatValue}>{formatPence(data.pendingPence)}</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStat}>
              <TrendingUp size={13} color="rgba(255,255,255,0.5)" />
              <Text style={s.heroStatLabel}>This month</Text>
              <Text style={s.heroStatValue}>{formatPence(data.thisMonth)}</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStat}>
              <Wallet size={13} color="rgba(255,255,255,0.5)" />
              <Text style={s.heroStatLabel}>Total earned</Text>
              <Text style={s.heroStatValue}>{formatPence(data.totalEarned)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.payoutBtn}
            onPress={() => router.push('/provider/payouts' as any)}
          >
            <Text style={s.payoutBtnText}>Payout settings</Text>
            <ArrowUpRight size={14} color="#111" />
          </TouchableOpacity>
        </View>

        {/* Chart card */}
        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <Text style={s.chartTitle}>Monthly earnings</Text>
            <View style={[s.growthBadge, { backgroundColor: growth >= 0 ? '#e7f7ef' : '#fff0f0' }]}>
              <Text style={[s.growthText, { color: growth >= 0 ? '#059669' : '#dc2626' }]}>
                {growth >= 0 ? '+' : ''}{growth}%
              </Text>
            </View>
          </View>
          <View style={s.chart}>
            {data.monthlyData.map((m, i) => (
              <View key={i} style={s.chartCol}>
                <MiniBar value={m.amount} max={maxBar} isCurrentMonth={i === currentMonthIdx} />
                <Text style={[s.chartLabel, i === currentMonthIdx && s.chartLabelActive]}>{m.month}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent transactions */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recent</Text>
            <TouchableOpacity onPress={() => router.push('/provider/transactions' as any)}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {data.recentTx.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            <View style={s.txList}>
              {data.recentTx.map((tx, i) => {
                const isCapture = tx.payment_status === 'captured'
                const isPending = tx.payment_status === 'authorized' || tx.payment_status === 'pending'
                return (
                  <TouchableOpacity
                    key={tx.id}
                    style={[s.txRow, i < data.recentTx.length - 1 && s.txRowBorder]}
                    onPress={() => router.push(`/provider/transactions?bookingId=${tx.id}` as any)}
                  >
                    <View style={s.txAvatar}>
                      <Text style={s.txAvatarText}>{tx.customerName.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={s.txInfo}>
                      <Text style={s.txName}>{tx.customerName}</Text>
                      <Text style={s.txService}>{tx.service_name ?? 'Service'}</Text>
                    </View>
                    <View style={s.txRight}>
                      <Text style={[s.txAmount, !isCapture && s.txAmountPending]}>
                        {isPending ? '' : ''}{formatPence(tx.net)}
                      </Text>
                      <View style={[s.txStatus, { backgroundColor: isCapture ? '#e7f7ef' : '#fff9e6' }]}>
                        <Text style={[s.txStatusText, { color: isCapture ? '#059669' : '#d97706' }]}>
                          {isCapture ? 'Paid' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      <ProviderNav />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f8f8' },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 120 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, color: '#111' },
  txBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txBtnText: { fontSize: 14, fontWeight: '600', color: '#111' },

  heroCard: { backgroundColor: '#111', borderRadius: 24, padding: 24, marginBottom: 16 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  heroBalance: { fontSize: 44, fontWeight: '700', color: '#fff', letterSpacing: -1.5, marginBottom: 24 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  heroStat: { flex: 1, alignItems: 'center', gap: 4 },
  heroStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  heroStatValue: { fontSize: 14, fontWeight: '700', color: '#fff', textAlign: 'center' },
  payoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12 },
  payoutBtnText: { fontSize: 14, fontWeight: '700', color: '#111' },

  chartCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  growthBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  growthText: { fontSize: 12, fontWeight: '700' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 4 },
  chartCol: { flex: 1, alignItems: 'center', gap: 6 },
  chartLabel: { fontSize: 10, color: '#bbb', fontWeight: '500' },
  chartLabelActive: { color: '#111', fontWeight: '700' },

  section: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  seeAll: { fontSize: 13, fontWeight: '600', color: '#ff5a1f' },
  emptyBox: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#bbb' },
  txList: { gap: 0 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  txRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  txAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  txAvatarText: { fontSize: 14, fontWeight: '700', color: '#111' },
  txInfo: { flex: 1 },
  txName: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  txService: { fontSize: 12, color: '#888' },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 15, fontWeight: '700', color: '#111' },
  txAmountPending: { color: '#888' },
  txStatus: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  txStatusText: { fontSize: 10, fontWeight: '700' },
})
