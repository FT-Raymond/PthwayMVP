import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Search, Plus, Star, ChevronRight, MapPin, Clock, Users } from 'lucide-react-native'

const { width } = Dimensions.get('window')
const CARD_WIDTH = (width - 48) / 2

export default function ProviderServicesScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [drafts, setDrafts] = useState<any[]>([])
  const [live, setLive] = useState<any[]>([])

  useFocusEffect(useCallback(() => { loadListings() }, []))

  async function loadListings(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setRefreshing(false); return }

    const { data } = await supabase
      .from('opportunities')
      .select('*')
      .eq('provider_id', user.id)
      .order('created_at', { ascending: false })

    if (data) {
      setDrafts(data.filter(i => i.status !== 'active'))
      setLive(data.filter(i => i.status === 'active'))
    }
    setLoading(false)
    setRefreshing(false)
  }

  function completion(item: any) {
    const fields = [item.title, item.description, item.price_pence, item.location, item.image_url]
    return Math.round((fields.filter(Boolean).length / fields.length) * 100)
  }

  function duration(item: any) {
    const mins = item.metadata?.duration
    if (!mins) return null
    if (mins < 60) return `${mins}m`
    return mins % 60 === 0 ? `${mins / 60}h` : `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  if (loading) return <View style={s.loader}><ActivityIndicator color="#ff5a1f" /></View>

  const totalActive = live.length

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadListings(true)} tintColor="#ff5a1f" />}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Your services</Text>
            <Text style={s.subtitle}>{totalActive} live · {drafts.length} in progress</Text>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.iconBtn}>
              <Search size={20} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => router.push('/provider/create-listing' as any)}
            >
              <Plus size={20} color="#fff" />
              <Text style={s.addBtnText}>New</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Live listings — 2-col grid ── */}
        {live.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Live</Text>
              <View style={s.livePill}>
                <View style={s.liveDot} />
                <Text style={s.livePillText}>{live.length} active</Text>
              </View>
            </View>

            <View style={s.grid}>
              {live.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={s.gridCard}
                  activeOpacity={0.92}
                  onPress={() => router.push(`/provider/service-detail?id=${item.id}` as any)}
                >
                  {/* Image */}
                  <View style={s.gridImageWrap}>
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={s.gridImage} />
                    ) : (
                      <View style={s.gridImagePlaceholder}>
                        <Text style={s.gridImagePlaceholderText}>{item.title?.slice(0, 1) ?? '?'}</Text>
                      </View>
                    )}
                    <View style={s.liveTag}>
                      <View style={s.liveTagDot} />
                      <Text style={s.liveTagText}>Live</Text>
                    </View>
                  </View>

                  {/* Content */}
                  <View style={s.gridContent}>
                    <Text style={s.gridTitle} numberOfLines={1}>{item.title}</Text>

                    <View style={s.gridMeta}>
                      {duration(item) && (
                        <View style={s.metaChip}>
                          <Clock size={10} color="#888" />
                          <Text style={s.metaText}>{duration(item)}</Text>
                        </View>
                      )}
                      {item.metadata?.maxClients > 1 && (
                        <View style={s.metaChip}>
                          <Users size={10} color="#888" />
                          <Text style={s.metaText}>{item.metadata.maxClients}</Text>
                        </View>
                      )}
                    </View>

                    <View style={s.gridBottom}>
                      <Text style={s.gridPrice}>£{(item.price_pence / 100).toFixed(0)}</Text>
                      <View style={s.ratingRow}>
                        <Star size={10} color="#ff5a1f" fill="#ff5a1f" />
                        <Text style={s.ratingText}>New</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Empty live state ── */}
        {live.length === 0 && (
          <TouchableOpacity
            style={s.emptyLive}
            onPress={() => router.push('/provider/create-listing' as any)}
            activeOpacity={0.85}
          >
            <View style={s.emptyLiveIcon}>
              <Plus size={28} color="#ff5a1f" />
            </View>
            <Text style={s.emptyLiveTitle}>Publish your first service</Text>
            <Text style={s.emptyLiveSub}>Create a listing and start taking bookings.</Text>
            <View style={s.emptyLiveBtn}>
              <Text style={s.emptyLiveBtnText}>Get started</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── In progress ── */}
        {drafts.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>In progress</Text>
            <View style={s.draftList}>
              {drafts.map((item) => {
                const pct = completion(item)
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={s.draftCard}
                    activeOpacity={0.88}
                    onPress={() => router.push(`/provider/create-listing?id=${item.id}` as any)}
                  >
                    <View style={s.draftImageWrap}>
                      {item.image_url
                        ? <Image source={{ uri: item.image_url }} style={s.draftImage} />
                        : <View style={s.draftImageEmpty} />
                      }
                      <View style={s.draftDot} />
                    </View>
                    <View style={s.draftContent}>
                      <Text style={s.draftTitle} numberOfLines={1}>{item.title || 'Untitled service'}</Text>
                      <Text style={s.draftPct}>{pct}% complete</Text>
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                    <ChevronRight size={18} color="#ccc" />
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  content: { paddingTop: 64, paddingHorizontal: 20 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -1, color: '#111' },
  subtitle: { fontSize: 14, color: '#999', marginTop: 4, fontWeight: '400' },
  headerActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12 },
  addBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Section
  section: { marginBottom: 36 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  sectionTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: '#111' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e9fff1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#14a44d' },
  livePillText: { fontSize: 12, fontWeight: '600', color: '#14a44d' },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: { width: CARD_WIDTH, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0f0f0', overflow: 'hidden' },
  gridImageWrap: { position: 'relative' },
  gridImage: { width: '100%', height: 140, backgroundColor: '#f5f5f5' },
  gridImagePlaceholder: { width: '100%', height: 140, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  gridImagePlaceholderText: { fontSize: 36, fontWeight: '700', color: '#ddd' },
  liveTag: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  liveTagDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#14a44d' },
  liveTagText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  gridContent: { padding: 12 },
  gridTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 6 },
  gridMeta: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#f5f5f5', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  metaText: { fontSize: 10, color: '#888', fontWeight: '500' },
  gridBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gridPrice: { fontSize: 16, fontWeight: '700', color: '#111' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, fontWeight: '600', color: '#888' },

  // Empty live
  emptyLive: { borderWidth: 1.5, borderColor: '#f0f0f0', borderRadius: 24, borderStyle: 'dashed', padding: 32, alignItems: 'center', marginBottom: 36 },
  emptyLiveIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff0e8', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyLiveTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 6 },
  emptyLiveSub: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyLiveBtn: { backgroundColor: '#111', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyLiveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Draft list
  draftList: { gap: 0 },
  draftCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  draftImageWrap: { position: 'relative', marginRight: 14 },
  draftImage: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#eee' },
  draftImageEmpty: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#f0f0f0' },
  draftDot: { position: 'absolute', top: 6, left: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff9d00', borderWidth: 2, borderColor: '#fff' },
  draftContent: { flex: 1 },
  draftTitle: { fontSize: 16, fontWeight: '600', color: '#111', letterSpacing: -0.2, marginBottom: 4 },
  draftPct: { fontSize: 13, color: '#999', marginBottom: 8 },
  progressTrack: { height: 4, borderRadius: 4, backgroundColor: '#f0f0f0', width: '80%', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#ff9d00', borderRadius: 4 },
})
