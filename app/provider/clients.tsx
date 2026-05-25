import { useState, useEffect, useMemo } from 'react'
import { ProviderNav } from '@/components/ProviderNav'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { Search, UserPlus, ChevronRight, Star, TrendingUp, Copy, Link2 } from 'lucide-react-native'

type Segment = 'all' | 'active' | 'new'

function initials(s: string) {
  return s.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export default function ProviderClients() {
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<Segment>('all')
  const [showInvite, setShowInvite] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: bookings } = await supabase
      .from('bookings')
      .select('customer_id, starts_at, status, amount_paid')
      .eq('provider_id', user.id)
      .order('starts_at', { ascending: false })

    if (!bookings) { setLoading(false); return }

    const ids = Array.from(new Set(bookings.map((b: any) => b.customer_id)))
    if (!ids.length) { setLoading(false); return }

    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids)
    const nameOf = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name ?? 'Client']))

    setClients(ids.map((id) => {
      const mine = bookings.filter((b: any) => b.customer_id === id && b.status !== 'cancelled')
      const sessions = mine.length
      return {
        id,
        name: nameOf.get(id) ?? 'Client',
        sessions,
        spent: mine.reduce((s: number, b: any) => s + (b.amount_paid ?? 0), 0),
        lastSession: mine[0]
          ? new Date(mine[0].starts_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
          : '—',
        status: sessions <= 2 ? 'new' : 'active',
        progress: Math.min(100, sessions * 10),
      }
    }))
    setLoading(false)
  }

  const segmentFiltered = clients.filter((c) => {
    if (segment === 'active') return c.status === 'active'
    if (segment === 'new') return c.status === 'new'
    return true
  })
  const filtered = segmentFiltered.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )
  const featured = useMemo(() =>
    [...clients].sort((a, b) => b.sessions - a.sessions).slice(0, 3), [clients]
  )

return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Clients</Text>
          <Text style={styles.subtitle}>{clients.length} clients</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowInvite(true)}>
          <UserPlus size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Search size={15} color="#999" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search clients"
          placeholderTextColor="#999"
        />
      </View>

      {featured.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top clients</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredList}>
            {featured.map((c) => (
              <TouchableOpacity key={c.id} style={styles.featuredCard}>
                <View style={styles.featuredAvatar}>
                  <Text style={styles.featuredAvatarText}>{initials(c.name)}</Text>
                </View>
                <Text style={styles.featuredName}>{c.name}</Text>
                <View style={styles.featuredRating}>
                  <Star size={10} color="#ff5a1f" fill="#ff5a1f" />
                  <Text style={styles.featuredRatingText}>{c.sessions} sessions</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${c.progress}%` as any }]} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segments} contentContainerStyle={styles.segmentsContent}>
        {([{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'new', label: 'New' }] as { id: Segment; label: string }[]).map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.segBtn, segment === s.id && styles.segBtnActive]}
            onPress={() => setSegment(s.id)}
          >
            <Text style={[styles.segText, segment === s.id && styles.segTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>All clients</Text>
        <Text style={styles.listCount}>{filtered.length} clients</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#ff5a1f" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No clients yet.</Text>
          <Text style={styles.emptySub}>Create a booking and they'll appear here.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((c) => (
            <TouchableOpacity key={c.id} style={styles.clientCard}>
              <View style={styles.clientAvatar}>
                <Text style={styles.clientAvatarText}>{initials(c.name)}</Text>
              </View>
              <View style={styles.clientInfo}>
                <View style={styles.clientNameRow}>
                  <Text style={styles.clientName}>{c.name}</Text>
                  {c.status === 'new' && (
                    <View style={styles.newBadge}><Text style={styles.newBadgeText}>New</Text></View>
                  )}
                </View>
                <Text style={styles.clientMeta}>
                  {c.sessions} session{c.sessions === 1 ? '' : 's'} · Last: {c.lastSession} · £{c.spent.toFixed(0)}
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${c.progress}%` as any }]} />
                </View>
              </View>
              <ChevronRight size={15} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal visible={showInvite} animationType="slide" transparent>
        <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={() => setShowInvite(false)}>
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <Text style={modal.title}>Onboard a client</Text>
            <Text style={modal.subtitle}>Share a code or invite link with your client.</Text>
            <View style={modal.codeBox}>
              <Text style={modal.codeLabel}>UNIQUE CODE</Text>
              <View style={modal.codeRow}>
                <Text style={modal.code}>PTH-7X9K</Text>
                <TouchableOpacity style={modal.copyBtn}>
                  <Copy size={14} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={modal.linkBtn}>
              <Link2 size={15} color="#fff" />
              <Text style={modal.linkBtnText}>Copy invite link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modal.cancelBtn} onPress={() => setShowInvite(false)}>
              <Text style={modal.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
</ScrollView>
    <ProviderNav />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingTop: 56, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 13, color: '#888', marginTop: 4 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ff5a1f', justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 20, marginBottom: 24, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#111' },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  featuredList: { paddingHorizontal: 20, gap: 12 },
  featuredCard: { width: 160, borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 16 },
  featuredAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  featuredAvatarText: { fontSize: 12, fontWeight: '600' },
  featuredName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  featuredRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  featuredRatingText: { fontSize: 12, color: '#888' },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: '#f0f0f0', overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%' as any, backgroundColor: '#ff5a1f', borderRadius: 2 },
  segments: { marginBottom: 20 },
  segmentsContent: { paddingHorizontal: 20, gap: 8 },
  segBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
  segBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  segText: { fontSize: 13, fontWeight: '600', color: '#666' },
  segTextActive: { color: '#fff' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  listCount: { fontSize: 12, color: '#888' },
  center: { paddingVertical: 40, alignItems: 'center' },
  emptyBox: { borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 32, alignItems: 'center', marginHorizontal: 20 },
  emptyText: { fontSize: 14, color: '#888' },
  emptySub: { fontSize: 12, color: '#aaa', marginTop: 4 },
  list: { gap: 8, paddingHorizontal: 20 },
  clientCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 14, gap: 12 },
  clientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  clientAvatarText: { fontSize: 12, fontWeight: '600' },
  clientInfo: { flex: 1 },
  clientNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  clientName: { fontSize: 14, fontWeight: '600' },
  newBadge: { backgroundColor: '#fff0eb', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  newBadgeText: { fontSize: 10, fontWeight: '600', color: '#ff5a1f' },
  clientMeta: { fontSize: 12, color: '#888' },
})

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  handle: { width: 36, height: 3, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 24 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  codeBox: { borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 16, marginBottom: 16 },
  codeLabel: { fontSize: 10, fontWeight: '600', color: '#888', letterSpacing: 0.5, marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: 24, fontWeight: '700', letterSpacing: 2 },
  copyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111', borderRadius: 16, padding: 14, marginBottom: 8 },
  linkBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  cancelBtn: { padding: 12, alignItems: 'center' },
  cancelText: { fontSize: 12, color: '#888' },
})