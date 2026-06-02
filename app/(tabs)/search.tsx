import { useState, useEffect, useRef, useCallback, memo } from 'react'
import {
  View, Text, StyleSheet, TextInput, ScrollView,
  TouchableOpacity, ActivityIndicator, Image, FlatList,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search, Play, SlidersHorizontal, Images } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useSearch } from '@/hooks/useSearch'

// ── Constants ─────────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get('window')
const COLS   = 3
const GAP    = 2
const TILE_W = (W - GAP * (COLS - 1)) / COLS   // ~1/3 screen width
const TILE_H = TILE_W * 1.25                    // slightly taller than square

// Placeholder backgrounds for items with no media
const PH_COLORS = ['#e8f0fe','#fce4ec','#e8f5e9','#fff8e1','#ede7f6','#fbe9e7']

// ── Media helpers ─────────────────────────────────────────────────────────────
type MediaKind = 'photo' | 'video' | 'carousel'

function getMediaKind(item: any): MediaKind {
  const media = item.opportunity_media ?? []
  if (media.length > 1) return 'carousel'
  if (media[0]?.media_type === 'video') return 'video'
  return 'photo'
}

function getThumbnail(item: any): string | null {
  return item.opportunity_media?.[0]?.url ?? item.image_url ?? null
}

function placeholderColor(item: any): string {
  let h = 0
  for (let i = 0; i < (item.id ?? '').length; i++) h = (h * 31 + (item.id.charCodeAt(i) | 0)) | 0
  return PH_COLORS[Math.abs(h) % PH_COLORS.length]
}

// ── Grid tile ─────────────────────────────────────────────────────────────────
const Tile = memo(function Tile({ item, onPress, colIndex }: { item: any; onPress: (i: any) => void; colIndex: number }) {
  const thumb  = getThumbnail(item)
  const kind   = getMediaKind(item)
  const name   = item.profiles?.full_name ?? ''
  const avatar = item.profiles?.avatar_url
  const initial = (item.title ?? name ?? '?').slice(0, 1).toUpperCase()

  // Each tile gets left margin except first column
  const marginLeft = colIndex === 0 ? 0 : GAP

  return (
    <TouchableOpacity
      style={[t.tile, { width: TILE_W, height: TILE_H, marginLeft }]}
      onPress={() => onPress(item)}
      activeOpacity={0.88}
    >
      {/* Media / placeholder */}
      {thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, t.placeholder, { backgroundColor: placeholderColor(item) }]}>
          <Text style={t.placeholderLetter}>{initial}</Text>
          {item.category ? <Text style={t.placeholderCat} numberOfLines={1}>{item.category}</Text> : null}
        </View>
      )}

      {/* Subtle bottom scrim so provider name reads */}
      <View style={t.scrim} />

      {/* Media-type badge — top right corner */}
      {kind === 'video' && (
        <View style={t.badge}>
          <Play size={9} color="#fff" fill="#fff" />
        </View>
      )}
      {kind === 'carousel' && (
        <View style={t.badge}>
          <Images size={10} color="#fff" strokeWidth={2} />
        </View>
      )}
      {/* photos: no badge */}

      {/* Provider name — bottom */}
      <View style={t.footer}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={t.avatar} />
        ) : name ? (
          <View style={[t.avatarFallback]}>
            <Text style={t.avatarLetter}>{name.slice(0, 1)}</Text>
          </View>
        ) : null}
        {name ? <Text style={t.footerName} numberOfLines={1}>{name}</Text> : null}
      </View>

      {/* Price chip */}
      {item.price_pence ? (
        <View style={t.pricePill}>
          <Text style={t.priceText}>£{(item.price_pence / 100).toFixed(0)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  )
})

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { data: results, categories, loading, search } = useSearch()

  const [query, setQuery]       = useState('')
  const [category, setCategory] = useState('All')
  const [focused, setFocused]   = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(query, category), 280)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query, category, search])

  const handlePress = useCallback((item: any) => {
    const handle = item.profiles?.username
    handle
      ? router.push(`/profile/${handle}` as any)
      : router.push(`/book/${item.provider_id}/index` as any)
  }, [router])

  // FlatList renders 3-column rows; we build rows manually so margin logic is simple
  const rows: any[][] = []
  for (let i = 0; i < results.length; i += COLS) {
    rows.push(results.slice(i, i + COLS))
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Search bar ── */}
      <View style={s.searchRow}>
        <View style={[s.bar, focused && s.barFocused]}>
          <Search size={15} color="#aaa" strokeWidth={2} />
          <TextInput
            ref={inputRef}
            style={s.input}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search"
            placeholderTextColor="#aaa"
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => search(query, category)}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => { setQuery(''); inputRef.current?.focus() }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={s.clearDot}>
                <Text style={s.clearX}>×</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={s.filterBtn} activeOpacity={0.65}>
          <SlidersHorizontal size={18} color="#111" strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {/* ── Category pills ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={s.pillsRow}
      >
        {categories.map(cat => {
          const active = category === cat
          return (
            <TouchableOpacity
              key={cat}
              style={[s.pill, active && s.pillActive]}
              onPress={() => setCategory(cat)}
              activeOpacity={0.7}
            >
              <Text style={[s.pillText, active && s.pillTextActive]}>{cat}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* ── Grid ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#999" size="small" />
        </View>
      ) : results.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyHead}>{query ? 'No results' : 'Nothing here yet'}</Text>
          {query ? <Text style={s.emptySub}>Try a different keyword or category</Text> : null}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        >
          {rows.map((row, ri) => (
            <View key={ri} style={s.row}>
              {row.map((item, ci) => (
                <Tile key={item.id} item={item} onPress={handlePress} colIndex={ci} />
              ))}
              {/* Fill empty cells in last row */}
              {row.length < COLS && Array.from({ length: COLS - row.length }).map((_, fi) => (
                <View key={`fill-${fi}`} style={{ width: TILE_W, height: TILE_H, marginLeft: GAP }} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8, gap: 10,
  },
  bar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0f0f0', borderRadius: 12,
    paddingHorizontal: 12, height: 38, gap: 7,
  },
  barFocused: { backgroundColor: '#ebebeb' },
  input:      { flex: 1, fontSize: 15, color: '#111', paddingVertical: 0 },
  clearDot:   { width: 17, height: 17, borderRadius: 9, backgroundColor: '#c0c0c0', alignItems: 'center', justifyContent: 'center' },
  clearX:     { fontSize: 14, color: '#fff', lineHeight: 17, fontWeight: '600', marginTop: -1 },
  filterBtn:  { width: 38, height: 38, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },

  pillsRow:       { paddingHorizontal: 14, paddingBottom: 10, gap: 7, alignItems: 'center' },
  pill:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', alignSelf: 'center' },
  pillActive:     { borderColor: '#111', borderWidth: 1.5 },
  pillText:       { fontSize: 13, fontWeight: '500', color: '#555' },
  pillTextActive: { color: '#111', fontWeight: '700' },

  row:   { flexDirection: 'row', marginBottom: GAP },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 100 },
  emptyHead: { fontSize: 15, fontWeight: '600', color: '#ccc' },
  emptySub:  { fontSize: 13, color: '#e0e0e0' },
})

// ── Tile styles ───────────────────────────────────────────────────────────────
const t = StyleSheet.create({
  tile: { overflow: 'hidden', backgroundColor: '#f5f5f5' },

  placeholder:       { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  placeholderLetter: { fontSize: 24, fontWeight: '800', color: 'rgba(0,0,0,0.15)' },
  placeholderCat:    { fontSize: 9, fontWeight: '600', color: 'rgba(0,0,0,0.18)', marginTop: 4, textAlign: 'center' },

  // Subtle bottom gradient
  scrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%',
    backgroundColor: 'rgba(0,0,0,0.28)',
    opacity: 0.65,
  },

  // Media-type badge — top right
  badge: {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Provider footer — bottom left
  footer:      { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingBottom: 7 },
  avatar:      { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  avatarFallback: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#ff5a1f', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 8, fontWeight: '800', color: '#fff' },
  footerName:  { fontSize: 10, fontWeight: '700', color: '#fff', flex: 1, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },

  // Price — top left
  pricePill:  { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  priceText:  { fontSize: 9, fontWeight: '700', color: '#fff' },
})
