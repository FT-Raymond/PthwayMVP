import { useState, useEffect, useMemo, type ReactNode } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { ProviderNav } from '@/components/ProviderNav'
import {
  ChevronRight, Calendar, PoundSterling, Users, Star,
  Plus, X, UserPlus, Link2, Pencil, Activity,
  TrendingUp, Bell, ChevronDown, Clock, Wallet, Briefcase, Shield,
} from 'lucide-react-native'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function SoftIcon({ children, tone = 'orange' }: { children: ReactNode; tone?: 'orange' | 'green' | 'purple' }) {
  const bg = tone === 'orange' ? '#fff0e8' : tone === 'green' ? '#e7f7ef' : '#f3e5ff'
  return <View style={[s.softIcon, { backgroundColor: bg }]}>{children}</View>
}

export default function StudioPage() {
  const [fabOpen, setFabOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [displayName, setDisplayName] = useState('there')
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single()
    if (profile?.full_name) setDisplayName(profile.full_name.split(' ')[0])

    const start = new Date()
    start.setDate(start.getDate() - 60)
    const { data } = await supabase
      .from('bookings')
      .select('id, customer_id, starts_at, status, amount_paid, created_at')
      .eq('provider_id', user.id)
      .gte('starts_at', start.toISOString())
      .order('starts_at', { ascending: false })

    if (data) {
      const ids = Array.from(new Set(data.map((b: any) => b.customer_id)))
      const names = new Map<string, string>()
      if (ids.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids)
        ;(profiles ?? []).forEach((p: any) => names.set(p.id, p.full_name ?? 'Client'))
      }
      setBookings(data.map((b: any) => ({ ...b, client_name: names.get(b.customer_id) ?? 'Client' })))
    }
    setLoading(false)
  }

  const stats = useMemo(() => {
    const active = bookings.filter(b => b.status !== 'cancelled')
    const now = new Date()
    const dow = (now.getDay() + 6) % 7
    const weekStart = new Date(now)
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(now.getDate() - dow)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    const weekBookings = active.filter(b => new Date(b.starts_at) >= weekStart)
    const monthActive = active.filter(b => new Date(b.starts_at) >= monthStart)
    const lastMonthActive = active.filter(b => { const d = new Date(b.starts_at); return d >= lastMonthStart && d <= lastMonthEnd })

    const monthEarnings = monthActive.reduce((s: number, b: any) => s + (b.amount_paid ?? 0), 0)
    const lastMonthEarnings = lastMonthActive.reduce((s: number, b: any) => s + (b.amount_paid ?? 0), 0)
    const earningsChange = lastMonthEarnings > 0
      ? Math.round(((monthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100)
      : monthEarnings > 0 ? 100 : 0

    const week = DAY_LABELS.map((day, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      const key = d.toDateString()
      const value = active.filter(b => new Date(b.starts_at).toDateString() === key)
        .reduce((s: number, b: any) => s + (b.amount_paid ?? 0), 0)
      return { day, value }
    })

    const clientCount = new Set(active.map((b: any) => b.customer_id)).size
    const pendingBookings = active.filter(b => b.status === 'pending')
    const pendingAmount = pendingBookings.reduce((s: number, b: any) => s + (b.amount_paid ?? 0), 0)

    return {
      week,
      weekBookings: weekBookings.length,
      monthEarnings,
      monthCount: monthActive.length,
      clientCount,
      pending: pendingBookings.length,
      pendingAmount,
      earningsChange,
      activeDays: week.filter(d => d.value > 0).length,
      hoursWorkedMinutes: monthActive.length * 60,
    }
  }, [bookings])

  const maxVal = Math.max(1, ...stats.week.map(d => d.value))
  const todayKey = new Date().toDateString()
  const todayBookings = bookings
    .filter(b => new Date(b.starts_at).toDateString() === todayKey && b.status !== 'cancelled')
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  const payments = bookings.filter(b => b.status !== 'cancelled' && (b.amount_paid ?? 0) > 0).slice(0, 3)

  if (loading) return <View style={s.center}><ActivityIndicator color="#ff5a1f" /></View>

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{greeting()}, {displayName}</Text>
            <Text style={s.title}>Your studio</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity style={s.avatar} onPress={() => setShowMenu(true)}>
              <Text style={s.avatarText}>{initials(displayName)}</Text>
            </TouchableOpacity>
            <ChevronDown size={16} color="#999" />
            <TouchableOpacity onPress={() => router.push('/provider/bookings' as any)} style={s.bellWrap}>
              <Bell size={22} color="#555" />
              {stats.pending > 0 && <View style={s.badge} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Earnings card ── */}
        <View style={s.darkCard}>
          <View style={s.darkCardTop}>
            <View style={s.row}>
              <TrendingUp size={16} color="#ff5a1f" />
              <Text style={s.darkCardLabel}>Earnings</Text>
            </View>
            <View style={s.pill}>
              <Text style={s.pillText}>{stats.earningsChange >= 0 ? '+' : ''}{stats.earningsChange}%</Text>
            </View>
          </View>

          <View style={s.darkCardMiddle}>
            <View>
              <Text style={s.earningsNum}>£{stats.monthEarnings.toFixed(0)}</Text>
              <Text style={s.earningsSub}>This month</Text>
            </View>
            <View style={s.chartWrap}>
              <Text style={s.vsText}>vs last month</Text>
              <View style={s.bars}>
                {stats.week.map((d, i) => {
                  const h = Math.max(8, (d.value / maxVal) * 44)
                  const isToday = i === ((new Date().getDay() + 6) % 7)
                  return (
                    <View key={i} style={s.barCol}>
                      <View style={[s.bar, { height: h, backgroundColor: isToday ? '#ff5a1f' : '#c24c08' }]} />
                      <Text style={[s.barLabel, isToday && s.barLabelToday]}>{d.day}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          </View>

          <View style={s.darkDivider} />

          <View style={s.darkStats}>
            <View style={s.darkStat}>
              <Calendar size={18} color="#ff5a1f" />
              <View style={{ marginLeft: 8 }}>
                <Text style={s.darkStatNum}>{stats.monthCount}</Text>
                <Text style={s.darkStatLabel}>Bookings</Text>
              </View>
            </View>
            <View style={s.darkStatDivider} />
            <View style={s.darkStat}>
              <Wallet size={18} color="#ff5a1f" />
              <View style={{ marginLeft: 8 }}>
                <Text style={s.darkStatNum}>£{stats.pendingAmount.toFixed(0)}</Text>
                <Text style={s.darkStatLabel}>Pending payout</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Activity ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Your activity</Text>
            <View style={s.filterPill}>
              <Text style={s.filterText}>This week</Text>
              <ChevronDown size={13} color="#555" />
            </View>
          </View>
          <View style={s.activityRow}>
            <View style={s.activityItem}>
              <SoftIcon><Calendar size={18} color="#ff5a1f" /></SoftIcon>
              <Text style={s.activityNum}>{stats.activeDays}/7</Text>
              <Text style={s.activityLabel}>Active days</Text>
            </View>
            <View style={s.activityDivider} />
            <View style={s.activityItem}>
              <SoftIcon tone="green"><Clock size={18} color="#10a65a" /></SoftIcon>
              <Text style={s.activityNum}>{formatHours(stats.hoursWorkedMinutes)}</Text>
              <Text style={s.activityLabel}>Hours worked</Text>
            </View>
            <View style={s.activityDivider} />
            <View style={s.activityItem}>
              <SoftIcon tone="purple"><Users size={18} color="#a020f0" /></SoftIcon>
              <Text style={s.activityNum}>{stats.clientCount}</Text>
              <Text style={s.activityLabel}>Clients served</Text>
            </View>
          </View>
        </View>

        {/* ── Bookings + Payments grid ── */}
        <View style={s.grid}>
          {/* Bookings */}
          <View style={s.halfCard}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Bookings</Text>
              <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/provider/bookings' as any)}>
                <Calendar size={16} color="#ff5a1f" />
              </TouchableOpacity>
              <ChevronRight size={16} color="#bbb" />
            </View>
            {todayBookings.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>No bookings today</Text>
              </View>
            ) : todayBookings.slice(0, 2).map(b => (
              <View key={b.id} style={s.bookingRow}>
                <View style={s.clientAvatar}>
                  <Text style={s.clientAvatarText}>{initials(b.client_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.row}>
                    <Text style={s.bookingTime}>{formatTime(b.starts_at)}</Text>
                    {b.status === 'pending' && <View style={s.orangeDot} />}
                  </View>
                  <Text style={s.bookingName}>{b.client_name}</Text>
                </View>
              </View>
            ))}
            {todayBookings.length > 2 && (
              <TouchableOpacity style={s.moreBtn} onPress={() => router.push('/provider/bookings' as any)}>
                <Text style={s.moreBtnText}>+{todayBookings.length - 2} more</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Payments */}
          <View style={s.halfCard}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Payments</Text>
              <TouchableOpacity style={[s.iconBtn, { backgroundColor: '#e7f7ef' }]} onPress={() => router.push('/provider/earnings' as any)}>
                <Wallet size={16} color="#0aa65a" />
              </TouchableOpacity>
              <ChevronRight size={16} color="#bbb" />
            </View>
            {payments.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>No payments yet</Text>
              </View>
            ) : payments.map((p, i) => (
              <View key={p.id} style={[s.payRow, i < payments.length - 1 && s.payRowBorder]}>
                <View style={[s.payAvatar, { backgroundColor: i % 2 === 0 ? '#eaf4ff' : '#e7f7ef' }]}>
                  <Text style={s.payInitials}>{initials(p.client_name)}</Text>
                </View>
                <Text style={s.payAmount}>£{(p.amount_paid ?? 0).toFixed(0)}</Text>
                <View style={s.row}>
                  <View style={s.greenDot} />
                  <Text style={s.paidText}>Paid</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Booking requests banner ── */}
        {stats.pending > 0 && (
          <TouchableOpacity style={s.banner} onPress={() => router.push('/provider/bookings' as any)}>
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitle}>{stats.pending} booking request{stats.pending > 1 ? 's' : ''}</Text>
              <Text style={s.bannerSub}>Need your response</Text>
              <View style={s.bannerBtn}>
                <Text style={s.bannerBtnText}>View requests</Text>
              </View>
            </View>
            <View style={s.bannerGraphic}>
              <Calendar size={44} color="#ff5a1f" />
              <View style={s.bannerBadge}>
                <Text style={s.bannerBadgeText}>{stats.pending}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Services ── */}
        <TouchableOpacity style={s.card} activeOpacity={0.92} onPress={() => router.push('/provider/services' as any)}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Services</Text>
            <TouchableOpacity onPress={() => router.push('/provider/ser' as any)}>
              <Text style={s.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={s.servicesRow}>
            <View style={s.serviceItem}>
              <View style={s.serviceIcon}>
                <Briefcase size={16} color="#ff5a1f" />
              </View>
              <Text style={s.serviceNum}>{stats.monthCount}</Text>
              <Text style={s.serviceLabel}>Total services</Text>
              <Text style={s.serviceGreen}>Active</Text>
            </View>
            <View style={s.serviceDivider} />
            <View style={[s.serviceItem]}>
              <View style={s.serviceIcon}>
                <Star size={16} color="#ff5a1f" fill="#ff5a1f" />
              </View>
              <Text style={[s.serviceNum, { fontSize: 13 }]} numberOfLines={1}>
                {bookings.length > 0 ? (bookings[0]?.service_name ?? 'Appointment') : 'None yet'}
              </Text>
              <Text style={s.serviceLabel}>Most booked</Text>
              <Text style={s.serviceGreen}>{stats.monthCount} bookings</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Policies + placeholder grid ── */}
        <View style={s.grid}>
          <TouchableOpacity
            style={s.halfCard}
            onPress={() => router.push('/provider/policies' as any)}
            activeOpacity={0.75}
          >
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Policies</Text>
              <View style={[s.iconBtn, { backgroundColor: '#eef2ff' }]}>
                <Shield size={16} color="#6366f1" />
              </View>
              <ChevronRight size={16} color="#bbb" />
            </View>
            <View style={s.policyPreviewRow}>
              {[
                { label: 'Flexible', color: '#e7f7ef', text: '#0aa65a' },
                { label: 'Moderate', color: '#fff7e6', text: '#d97706' },
                { label: 'Strict', color: '#fef2f2', text: '#dc2626' },
              ].map((p) => (
                <View key={p.label} style={[s.policyChip, { backgroundColor: p.color }]}>
                  <Text style={[s.policyChipText, { color: p.text }]}>{p.label}</Text>
                </View>
              ))}
            </View>
            <Text style={s.policyHint}>Tap to manage</Text>
          </TouchableOpacity>

<TouchableOpacity style={s.halfCard} onPress={() => router.push('/provider/payouts' as any)} activeOpacity={0.75}>
  <View style={s.cardHeader}>
    <Text style={s.cardTitle}>Payouts</Text>
    <View style={[s.iconBtn, { backgroundColor: '#e7f7ef' }]}>
      <Wallet size={16} color="#0aa65a" />
    </View>
    <ChevronRight size={16} color="#bbb" />
  </View>
  <View style={{ gap: 8 }}>
    <View style={[s.payoutStatusBadge, { backgroundColor: '#e7f7ef' }]}>
      <View style={[s.payoutStatusDot, { backgroundColor: '#0aa65a' }]} />
      <Text style={[s.payoutStatusText, { color: '#0aa65a' }]}>Active</Text>
    </View>
    <Text style={s.payoutHint}>Bank connected</Text>
    <Text style={s.payoutSub}>Tap to manage</Text>
  </View>
</TouchableOpacity>

        </View>

      </ScrollView>
    
      <ProviderNav />

      {/* FAB */}
      {fabOpen && <TouchableOpacity style={s.fabOverlay} onPress={() => setFabOpen(false)} activeOpacity={1} />}
      <View style={s.fabWrap}>
        {fabOpen && (
          <View style={s.fabMenu}>
            {[
              { icon: UserPlus, label: 'Add new client', route: '/provider/clients' },
              { icon: Link2, label: 'Share booking link', route: '/provider/profile' },
              { icon: Activity, label: 'Add availability', route: '/provider/calendar' },
              { icon: Pencil, label: 'Add new listing', route: '/provider/create-listing' },
            ].map((item, i) => (
              <TouchableOpacity key={i} style={s.fabMenuItem} onPress={() => { setFabOpen(false); router.push(item.route as any) }}>
                <View style={s.fabMenuLabel}><Text style={s.fabMenuText}>{item.label}</Text></View>
                <View style={s.fabMenuIcon}><item.icon size={15} color="#111" /></View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity style={s.fab} onPress={() => setFabOpen(!fabOpen)}>
          {fabOpen ? <X size={20} color="#fff" /> : <Plus size={20} color="#fff" />}
        </TouchableOpacity>
      </View>

{/* Payment settings */}
<TouchableOpacity style={s.card} onPress={() => router.push('/provider/earnings' as any)} activeOpacity={0.88}>
  <View style={s.cardHeader}>
    <Text style={s.cardTitle}>Payment settings</Text>
    <Text style={s.viewAll}>Manage</Text>
  </View>
  <View style={s.paySettingsRow}>
    {[
      { label: 'Transactions', sub: 'View full history', route: '/provider/transactions', color: '#fff0e8', iconColor: '#ff5a1f' },
      { label: 'Payouts', sub: 'Bank & schedule', route: '/provider/payouts', color: '#e7f7ef', iconColor: '#0aa65a' },
      { label: 'Earnings', sub: 'Stats & chart', route: '/provider/earnings', color: '#eef2ff', iconColor: '#6366f1' },
    ].map((item, i) => (
      <TouchableOpacity
        key={i}
        style={s.paySettingsItem}
        onPress={() => router.push(item.route as any)}
        activeOpacity={0.75}
      >
        <View style={[s.paySettingsIcon, { backgroundColor: item.color }]}>
          <PoundSterling size={16} color={item.iconColor} />
        </View>
        <Text style={s.paySettingsLabel}>{item.label}</Text>
        <Text style={s.paySettingsSub}>{item.sub}</Text>
      </TouchableOpacity>
    ))}
  </View>
</TouchableOpacity>


      {/* Menu */}
      <Modal visible={showMenu} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} activeOpacity={1} onPress={() => setShowMenu(false)} />
        <View style={s.menu}>
          <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenu(false); router.replace('/(tabs)' as any) }}>
            <Text style={s.menuItemText}>Switch to customer view</Text>
          </TouchableOpacity>
          <View style={s.menuDivider} />
          <TouchableOpacity style={s.menuItem} onPress={async () => { setShowMenu(false); await supabase.auth.signOut(); router.replace('/(auth)/login' as any) }}>
            <Text style={[s.menuItemText, { color: '#e00' }]}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f8f8' },
  content: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 120 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 13, color: '#888', fontWeight: '400', marginBottom: 2 },
  title: { fontSize: 28, fontWeight: '700', color: '#111', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e8eaed', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#111' },
  bellWrap: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', top: 6, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff5a1f' },

  darkCard: { backgroundColor: '#111', borderRadius: 20, padding: 18, marginBottom: 14 },
  darkCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  darkCardLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginLeft: 6 },
  pill: { backgroundColor: '#ff5a1f', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  darkCardMiddle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  earningsNum: { fontSize: 38, fontWeight: '700', color: '#fff', letterSpacing: -1 },
  earningsSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  chartWrap: { alignItems: 'flex-end' },
  vsText: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  barCol: { alignItems: 'center', gap: 4 },
  bar: { width: 8, borderRadius: 4 },
  barLabel: { fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  barLabelToday: { color: '#ff5a1f' },
  darkDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 14 },
  darkStats: { flexDirection: 'row', alignItems: 'center' },
  darkStat: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  darkStatNum: { fontSize: 16, fontWeight: '700', color: '#fff' },
  darkStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  darkStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 14 },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111' },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f5f5f5', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  filterText: { fontSize: 12, fontWeight: '600', color: '#333' },
  viewAll: { fontSize: 12, fontWeight: '600', color: '#0677ff' },
  iconBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#fff0e8', justifyContent: 'center', alignItems: 'center', marginRight: 4 },

  activityRow: { flexDirection: 'row', alignItems: 'center' },
  activityItem: { flex: 1, alignItems: 'center', gap: 6 },
  activityDivider: { width: 1, height: 60, backgroundColor: '#f0f0f0' },
  softIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  activityNum: { fontSize: 20, fontWeight: '700', color: '#111' },
  activityLabel: { fontSize: 11, color: '#888', fontWeight: '400' },

  grid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  halfCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14 },
  emptyBox: { minHeight: 60, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 12, color: '#aaa', fontWeight: '500' },
  bookingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  clientAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  clientAvatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  bookingTime: { fontSize: 13, fontWeight: '700', color: '#111' },
  bookingName: { fontSize: 11, color: '#888', marginTop: 1 },
  orangeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff5a1f' },
  moreBtn: { backgroundColor: '#f5f5f5', borderRadius: 10, paddingVertical: 7, alignItems: 'center', marginTop: 2 },
  moreBtnText: { fontSize: 11, fontWeight: '600', color: '#555' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  payRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  payAvatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  payInitials: { fontSize: 11, fontWeight: '700', color: '#2870e6' },
  payAmount: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111' },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#0aa65a' },
  paidText: { fontSize: 11, color: '#888', marginLeft: 4 },

  banner: { backgroundColor: '#fff6f0', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  bannerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  bannerBtn: { backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', marginTop: 10 },
  bannerBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  bannerGraphic: { width: 70, height: 60, justifyContent: 'center', alignItems: 'center' },
  bannerBadge: { position: 'absolute', right: 0, bottom: 0, width: 28, height: 26, borderRadius: 8, backgroundColor: '#ff5a1f', justifyContent: 'center', alignItems: 'center' },
  bannerBadgeText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  servicesRow: { flexDirection: 'row', alignItems: 'flex-start' },
  serviceItem: { flex: 1, alignItems: 'flex-start', paddingHorizontal: 4 },
  serviceDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#f0f0f0', marginHorizontal: 8 },
  serviceIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#fff0e8', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  serviceNum: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 2 },
  serviceLabel: { fontSize: 11, color: '#888', marginBottom: 2 },
  serviceGreen: { fontSize: 10, fontWeight: '600', color: '#0aa65a' },

  // Policies card
  policyPreviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  policyChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  policyChipText: { fontSize: 10, fontWeight: '600' },
  policyHint: { fontSize: 11, color: '#aaa', fontWeight: '500' },

  fabOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.15)', zIndex: 40 },
  fabWrap: { position: 'absolute', bottom: 90, right: 16, zIndex: 50, alignItems: 'flex-end', gap: 8 },
  fabMenu: { gap: 6, alignItems: 'flex-end' },
  fabMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fabMenuLabel: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  fabMenuText: { fontSize: 13, fontWeight: '500', color: '#111' },
  fabMenuIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0' },
  fab: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },

  menu: { position: 'absolute', top: 80, right: 16, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f0f0f0', overflow: 'hidden', minWidth: 200 },
  menuItem: { padding: 14 },
  menuItemText: { fontSize: 14, color: '#111' },
  menuDivider: { height: 1, backgroundColor: '#f0f0f0' },

  row: { flexDirection: 'row', alignItems: 'center' },

  payoutStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
payoutStatusDot: { width: 5, height: 5, borderRadius: 3 },
payoutStatusText: { fontSize: 10, fontWeight: '700' },
payoutHint: { fontSize: 13, fontWeight: '600', color: '#111' },
payoutSub: { fontSize: 11, color: '#aaa' },
paySettingsRow: { flexDirection: 'row', gap: 8 },
paySettingsItem: { flex: 1, backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, gap: 6 },
paySettingsIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
paySettingsLabel: { fontSize: 12, fontWeight: '700', color: '#111' },
paySettingsSub: { fontSize: 10, color: '#888' },
})
