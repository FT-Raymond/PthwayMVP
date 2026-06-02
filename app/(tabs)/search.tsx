import { useState, useEffect, useRef, useCallback, memo } from 'react'
import {
  View, Text, StyleSheet, TextInput, ScrollView,
  TouchableOpacity, ActivityIndicator, Image,
  Dimensions, Platform, StatusBar,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search, Play, SlidersHorizontal } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useSearch } from '@/hooks/useSearch'

// Placeholder bg colors for items with no media — warm, muted, on-brand
const PLACEHOLDER_COLORS = ['#e8f0fe','#fce4ec','#e8f5e9','#fff8e1','#ede7f6','#fbe9e7','#f3f4f6']

// ── Grid math ─────────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get('window')
const GAP    = 1.5                        // px between tiles
const TILE_S = (W - GAP * 2) / 3         // small tile — 1/3 screen, square
const TILE_L = TILE_S * 2 + GAP          // large tile — 2/3 × 2/3 screen

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMedia(item: any): { url: string | null; isVideo: boolean } {
  const first = item.opportunity_media?.[0]
  return {
    url:     first?.url ?? item.image_url ?? null,
    isVideo: first?.media_type === 'video',
  }
}

// ── Tile ──────────────────────────────────────────────────────────────────────
const Tile = memo(function Tile({
  item, w, h, onPress, featured = false,
}: {
  item: any; w: number; h: number; onPress: (i: any) => void; featured?: boolean
}) {
  const { url, isVideo } = getMedia(item)
  const name     = item.profiles?.full_name ?? ''
  const avatar   = item.profiles?.avatar_url
  const initial  = (item.title ?? name ?? '?').slice(0, 1).toUpperCase()

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onPress(item)}
      style={{ width: w, height: h, backgroundColor: '#1a1a1a' }}
    >
      {/* Media */}
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, t.empty, { backgroundColor: PLACEHOLDER_COLORS[Math.abs(item.id?.charCodeAt(0) ?? 0) % PLACEHOLDER_COLORS.length] }]}>
          <Text style={t.emptyLetter}>{initial}</Text>
          {item.category ? <Text style={t.emptyCat}>{item.category}</Text> : null}
        </View>
      )}

      {/* Scrim layers — simulate bottom-to-transparent gradient */}
      {featured && (
        <>
          <View style={{ ...StyleSheet.absoluteFillObject, top: '45%', backgroundColor: 'rgba(0,0,0,0.12)' }} />
          <View style={{ ...StyleSheet.absoluteFillObject, top: '65%', backgroundColor: 'rgba(0,0,0,0.32)' }} />
          <View style={{ ...StyleSheet.absoluteFillObject, top: '80%', backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </>
      )}

      {/* Video icon — top right */}
      {isVideo && (
        <View style={t.play}>
          <Play size={9} color="#fff" fill="#fff" />
        </View>
      )}

      {/* Featured overlay — provider + price */}
      {featured && (
        <View style={t.info}>
          <View style={t.infoRow}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={t.avatar} />
            ) : name ? (
              <View style={t.avatarFallback}>
                <Text style={t.avatarLetter}>{name.slice(0, 1)}</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              {name ? <Text style={t.name} numberOfLines={1}>{name}</Text> : null}
              {item.category ? <Text style={t.cat} numberOfLines={1}>{item.category}</Text> : null}
            </View>
          </View>
          {item.price_pence ? (
            <View style={t.price}>
              <Text style={t.priceText}>£{(item.price_pence / 100).toFixed(0)}</Text>
            </View>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  )
})

// ── Mosaic grid ───────────────────────────────────────────────────────────────
// Repeating 12-item pattern (two 6-item blocks):
//
//  Block A — big LEFT:              Block B — big RIGHT:
//  ┌──────────────┬───────┐         ┌───────┬───────┬───────┐
//  │              │   1   │         │   6   │   7   │   8   │
//  │    0 (2/3)   ├───────┤         ├───────┤               │
//  │              │   2   │         │   9   │  11 (2/3)     │
//  ├───────┬───────┬───────┤         ├───────┤               │
//  │   3   │   4   │   5   │         │  10   │               │
//  └───────┴───────┴───────┘         └───────┴───────────────┘

function Grid({ items, onPress }: { items: any[]; onPress: (i: any) => void }) {
  const rows: JSX.Element[] = []
  let idx = 0, block = 0

  while (idx < items.length) {
    const isA = block % 2 === 0
    const s   = items.slice(idx, idx + 6)

    if (s.length === 0) break

    if (isA) {
      // Block A: big left (item 0) + 2 small stacked (1, 2) | 3 equal (3, 4, 5)
      rows.push(
        <View key={`row-${idx}`} style={{ gap: GAP }}>
          {/* Featured row */}
          <View style={{ flexDirection: 'row', gap: GAP }}>
            <Tile item={s[0]} w={TILE_L} h={TILE_L} onPress={onPress} featured />
            <View style={{ gap: GAP }}>
              {s[1] && <Tile item={s[1]} w={TILE_S} h={TILE_S} onPress={onPress} />}
              {s[2] && <Tile item={s[2]} w={TILE_S} h={TILE_S} onPress={onPress} />}
            </View>
          </View>
          {/* Equal row */}
          {s.length > 3 && (
            <View style={{ flexDirection: 'row', gap: GAP }}>
              {s.slice(3, 6).map(item => (
                <Tile key={item.id} item={item} w={TILE_S} h={TILE_S} onPress={onPress} />
              ))}
            </View>
          )}
        </View>
      )
      idx += Math.min(s.length, 6)
    } else {
      // Block B: 3 equal (0, 1, 2) | 2 small stacked (3, 4) + big right (5)
      rows.push(
        <View key={`row-${idx}`} style={{ gap: GAP }}>
          {/* Equal row */}
          <View style={{ flexDirection: 'row', gap: GAP }}>
            {s.slice(0, 3).map(item => (
              <Tile key={item.id} item={item} w={TILE_S} h={TILE_S} onPress={onPress} />
            ))}
          </View>
          {/* Featured row */}
          {s.length > 3 && (
            <View style={{ flexDirection: 'row', gap: GAP }}>
              <View style={{ gap: GAP }}>
                {s[3] && <Tile item={s[3]} w={TILE_S} h={TILE_S} onPress={onPress} />}
                {s[4] && <Tile item={s[4]} w={TILE_S} h={TILE_S} onPress={onPress} />}
              </View>
              {s[5] && <Tile item={s[5]} w={TILE_L} h={TILE_L} onPress={onPress} featured />}
            </View>
          )}
        </View>
      )
      idx += Math.min(s.length, 6)
    }

    // Add GAP between blocks
    rows.push(<View key={`gap-${idx}`} style={{ height: GAP }} />)
    block++
  }

  return <View style={{ gap: GAP }}>{rows}</View>
}

// ── Screen ────────────────────────────────────────────────────────────────────
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
        <TouchableOpacity style={s.filterIcon} activeOpacity={0.65}>
          <SlidersHorizontal size={18} color="#111" strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {/* ── Category pills ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillsRow}
        style={{ flexGrow: 0 }}
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

      {/* ── Grid / states ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#999" size="small" />
        </View>
      ) : results.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyHead}>{query ? 'No results' : 'Nothing here yet'}</Text>
          {query ? <Text style={s.emptySub}>Try a different keyword</Text> : null}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          scrollEventThrottle={16}
        >
          <Grid items={results} onPress={handlePress} />
        </ScrollView>
      )}
    </View>
  )
}

// ── Screen styles ─────────────────────────────────────────────────────────────
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
  filterIcon: { padding: 4 },

  pillsRow: { paddingHorizontal: 14, paddingBottom: 8, gap: 7, alignItems: 'center' },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: '#ddd',
    backgroundColor: '#fff', alignSelf: 'center',
  },
  pillActive:     { borderColor: '#111', borderWidth: 1.5 },
  pillText:       { fontSize: 13, fontWeight: '500', color: '#444' },
  pillTextActive: { color: '#111', fontWeight: '700' },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 100 },
  emptyHead: { fontSize: 15, fontWeight: '600', color: '#ccc' },
  emptySub:  { fontSize: 13, color: '#e0e0e0' },
})

// ── Tile styles ───────────────────────────────────────────────────────────────
const t = StyleSheet.create({
  empty:       { alignItems: 'center', justifyContent: 'center' },
  emptyLetter: { fontSize: 22, fontWeight: '800', color: 'rgba(0,0,0,0.18)' },
  emptyCat:    { fontSize: 9, fontWeight: '600', color: 'rgba(0,0,0,0.2)', marginTop: 4, textAlign: 'center', paddingHorizontal: 6 },

  // Video play indicator — top right
  play: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Provider info overlay — bottom of featured tile
  info: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 10,
    // Bottom-up gradient via background
    backgroundColor: 'rgba(0,0,0,0.0)',
  },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 0 },
  avatar:       { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  avatarFallback: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#ff5a1f', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 9, fontWeight: '800', color: '#fff' },
  name:         { fontSize: 11, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  cat:          { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },

  // Price pill — top left of featured tile
  price:     { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  priceText: { fontSize: 10, fontWeight: '700', color: '#fff' },
})
