import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { ProviderNav } from '@/components/ProviderNav'
import {
  Zap, ChevronRight, TrendingUp, Calendar,
  PoundSterling, Users, Star, ShoppingBag,
  Plus, X, UserPlus, Link2, Pencil, Activity,
} from 'lucide-react-native'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function StatTile({ icon, label, value, sub, stars }: {
  icon: React.ReactNode; label: string; value: string; sub: string; stars?: boolean
}) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statTileHeader}>{icon}<Text style={styles.statTileLabel}>{label}</Text></View>
      <Text style={styles.statTileValue}>{value}</Text>
      <Text style={styles.statTileSub}>{sub}</Text>
      {stars && (
        <View style={styles.stars}>
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={7} color="#ff5a1f" fill="#ff5a1f" />)}
        </View>
      )}
    </View>
  )
}

function QuickAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      {icon}
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function StudioPage() {
  const [fabOpen, setFabOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [displayName, setDisplayName] = useState('there')
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    // Get name from profiles table
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      if (profile?.full_name) setDisplayName(profile.full_name.split(' ')[0])
    }

    const start = new Date()
    start.setDate(start.getDate() - 60)
    const { data } = await supabase
      .from('bookings')
      .select('id, customer_id, starts_at, status, amount_paid, created_at')
      .eq('provider_id', user?.id)
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
    const active = bookings.filter((b) => b.status !== 'cancelled')
    const now = new Date()
    const dow = (now.getDay() + 6) % 7
    const weekStart = new Date(now)
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(now.getDate() - dow)
    const weekBookings = active.filter((b) => new Date(b.starts_at) >= weekStart)
    const weekEarnings = weekBookings.reduce((s: number, b: any) => s + (b.amount_paid ?? 0), 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthActive = active.filter((b) => new Date(b.starts_at) >= monthStart)
    const monthEarnings = monthActive.reduce((s: number, b: any) => s + (b.amount_paid ?? 0), 0)
    const week = DAY_LABELS.map((day, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      const key = d.toDateString()
      const value = active.filter((b) => new Date(b.starts_at).toDateString() === key)
        .reduce((s: number, b: any) => s + (b.amount_paid ?? 0), 0)
      return { day, value }
    })
    const clientCount = new Set(active.map((b: any) => b.customer_id)).size
    const pending = active.filter((b) => b.status === 'pending').length
    return { week, weekBookings: weekBookings.length, weekEarnings, monthEarnings, monthCount: monthActive.length, clientCount, pending }
  }, [bookings])

  const maxValue = Math.max(1, ...stats.week.map((d) => d.value))
  const peakIndex = stats.week.reduce((max, d, i, a) => (d.value > a[max].value ? i : max), 0)
  const recent = bookings.slice(0, 4)

  if (loading) return <View style={styles.center}><ActivityIndicator color="#ff5a1f" /></View>

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Greeting */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingSub}>Welcome back!</Text>
            <Text style={styles.greetingName}>Hi, {displayName} 👋</Text>
          </View>
          <TouchableOpacity style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(displayName)}</Text>
            {stats.pending > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
        </View>

        {/* Banner */}
        <TouchableOpacity style={styles.banner} onPress={() => router.push('/provider/bookings' as any)}>
          <View style={styles.bannerIcon}><Zap size={22} color="#fff" fill="#fff" strokeWidth={1.5} /></View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>Stay Booked</Text>
            <Text style={styles.bannerSub}>
              {stats.pending > 0
                ? `${stats.pending} booking request${stats.pending === 1 ? '' : 's'} need a reply`
                : 'All caught up — keep your calendar fresh'}
            </Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>

        {/* Section heading */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Your business at a glance</Text>
          <View style={styles.weekBadge}><Text style={styles.weekBadgeText}>This week</Text></View>
        </View>

        {/* Stat tiles */}
        <View style={styles.statGrid}>
          <StatTile icon={<Calendar size={14} color="#ff5a1f" />} label="Bookings" value={String(stats.weekBookings)} sub="This week" />
          <StatTile icon={<PoundSterling size={14} color="#ff5a1f" />} label="Earnings" value={`£${stats.weekEarnings.toFixed(0)}`} sub="This week" />
          <StatTile icon={<Users size={14} color="#ff5a1f" />} label="Clients" value={String(stats.clientCount)} sub="Total" />
          <StatTile icon={<Star size={14} color="#ff5a1f" />} label="Rating" value="4.9" sub="Top rated" stars />
        </View>

        {/* Earnings card */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <View style={styles.earningsHeaderLeft}>
              <TrendingUp size={15} color="#ff5a1f" />
              <Text style={styles.earningsHeaderText}>Earnings</Text>
            </View>
          </View>
          <View style={styles.earningsNumbers}>
            <View>
              <Text style={styles.earningsBig}>£{stats.monthEarnings.toFixed(0)}</Text>
              <Text style={styles.earningsSub}>This month</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View>
              <Text style={styles.earningsBig}>{stats.monthCount}</Text>
              <Text style={styles.earningsSub}>Bookings</Text>
            </View>
          </View>
          <View style={styles.chart}>
            {stats.week.map((d, i) => {
              const isPeak = i === peakIndex && d.value > 0
              const heightPct = Math.max(8, (d.value / maxValue) * 100)
              return (
                <View key={i} style={styles.chartBar}>
                  {isPeak && (
                    <View style={styles.peakLabel}>
                      <Text style={styles.peakLabelText}>£{d.value.toFixed(0)}</Text>
                    </View>
                  )}
                  <View style={[styles.bar, { height: `${heightPct}%` as any, backgroundColor: isPeak ? '#ff5a1f' : 'rgba(255,255,255,0.15)' }]} />
                  <Text style={styles.chartDay}>{d.day}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickGrid}>
          <QuickAction icon={<Calendar size={20} color="#ff5a1f" />} label="Calendar" onPress={() => router.push('/provider/calendar' as any)} />
          <QuickAction icon={<ShoppingBag size={20} color="#ff5a1f" />} label="Services" onPress={() => router.push('/provider/profile' as any)} />
          <QuickAction icon={<Users size={20} color="#ff5a1f" />} label="Clients" onPress={() => router.push('/provider/clients' as any)} />
          <QuickAction icon={<Star size={20} color="#ff5a1f" />} label="Reviews" onPress={() => router.push('/provider/bookings' as any)} />
        </View>

        {/* Recent activity */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <TouchableOpacity onPress={() => router.push('/provider/bookings' as any)}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>

        {recent.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No activity yet.</Text>
          </View>
        ) : (
          <View style={styles.recentCard}>
            {recent.map((b, index) => (
              <View key={b.id} style={[styles.recentRow, index < recent.length - 1 && styles.recentRowBorder]}>
                <View style={styles.recentAvatar}>
                  <Text style={styles.recentAvatarText}>{initials(b.client_name)}</Text>
                  <View style={[styles.recentDot, { backgroundColor: b.status === 'pending' ? '#ff5a1f' : '#10b981' }]} />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentTitle}>{b.status === 'pending' ? 'New booking request' : 'Booking confirmed'}</Text>
                  <Text style={styles.recentSub}>{new Date(b.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                </View>
                <View style={styles.recentRight}>
                  <Text style={styles.recentTime}>{timeAgo(b.created_at)}</Text>
                  <Text style={styles.recentAmount}>£{(b.amount_paid ?? 0).toFixed(0)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Provider Nav */}
      <ProviderNav />

      {/* FAB */}
      {fabOpen && <TouchableOpacity style={styles.fabOverlay} onPress={() => setFabOpen(false)} activeOpacity={1} />}
      <View style={styles.fabContainer}>
        {fabOpen && (
          <View style={styles.fabActions}>
            {[
              { icon: UserPlus, label: 'Add new client', route: '/provider/clients' },
              { icon: Link2, label: 'Share booking link', route: '/provider/profile' },
              { icon: Pencil, label: 'Edit services', route: '/provider/profile' },
              { icon: Activity, label: 'Add availability', route: '/provider/calendar' },
            ].map((item, i) => (
              <TouchableOpacity key={i} style={styles.fabAction} onPress={() => { setFabOpen(false); router.push(item.route as any) }}>
                <View style={styles.fabActionLabel}><Text style={styles.fabActionText}>{item.label}</Text></View>
                <View style={styles.fabActionIcon}><item.icon size={16} color="#111" /></View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity style={styles.fab} onPress={() => setFabOpen(!fabOpen)}>
          {fabOpen ? <X size={22} color="#fff" /> : <Plus size={22} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 120 },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greetingSub: { fontSize: 13, color: '#888' },
  greetingName: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 13, fontWeight: '600' },
  badge: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff5a1f', borderWidth: 2, borderColor: '#fff' },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ff5a1f', borderRadius: 16, padding: 16, marginBottom: 24, gap: 12 },
  bannerIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  bannerText: { flex: 1 },
  bannerTitle: { color: '#fff', fontWeight: '700', fontSize: 17, letterSpacing: -0.3 },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  weekBadge: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  weekBadgeText: { fontSize: 11, fontWeight: '600', color: '#888' },
  statGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statTile: { flex: 1, borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 10 },
  statTileHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  statTileLabel: { fontSize: 9, fontWeight: '600', color: '#111' },
  statTileValue: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
  statTileSub: { fontSize: 9, color: '#888', marginTop: 2 },
  stars: { flexDirection: 'row', gap: 1, marginTop: 4 },
  earningsCard: { backgroundColor: '#111', borderRadius: 16, padding: 20, marginBottom: 20 },
  earningsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  earningsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  earningsHeaderText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  earningsNumbers: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  earningsBig: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  earningsSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  earningsDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.15)' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 8 },
  chartBar: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 },
  bar: { width: '100%', borderRadius: 4 },
  chartDay: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  peakLabel: { position: 'absolute', top: 0, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  peakLabelText: { fontSize: 10, fontWeight: '700', color: '#111' },
  quickGrid: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  quickAction: { flex: 1, borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 12, alignItems: 'center', gap: 6 },
  quickActionLabel: { fontSize: 11, fontWeight: '600' },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  viewAll: { fontSize: 12, fontWeight: '600', color: '#ff5a1f' },
  emptyBox: { borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#888' },
  recentCard: { borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16 },
  recentRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  recentAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  recentAvatarText: { fontSize: 11, fontWeight: '600' },
  recentDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  recentInfo: { flex: 1 },
  recentTitle: { fontSize: 13, fontWeight: '600' },
  recentSub: { fontSize: 11, color: '#888', marginTop: 1 },
  recentRight: { alignItems: 'flex-end' },
  recentTime: { fontSize: 11, color: '#888' },
  recentAmount: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  fabOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 40 },
  fabContainer: { position: 'absolute', bottom: 100, right: 20, zIndex: 50, alignItems: 'flex-end', gap: 10 },
  fabActions: { gap: 8, alignItems: 'flex-end' },
  fabAction: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fabActionLabel: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  fabActionText: { fontSize: 13, fontWeight: '500' },
  fabActionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0' },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#ff5a1f', justifyContent: 'center', alignItems: 'center' },
})