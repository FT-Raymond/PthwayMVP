import { useState, useEffect, useCallback, useRef, memo } from 'react'
import {
  View, Text, StyleSheet, TextInput, ScrollView,
  TouchableOpacity, ActivityIndicator, Image, SafeAreaView,
  Dimensions, StatusBar,
} from 'react-native'
import { Search, X, Play, SlidersHorizontal } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useSearch } from '@/hooks/useSearch'

const { width: SCREEN_W } = Dimensions.get('window')
const GAP    = 2
const TILE_S = (SCREEN_W - GAP * 2) / 3   // small tile — 1/3 screen
const TILE_L = TILE_S * 2 + GAP            // large tile — 2/3 screen

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMedia(item: any): { url: string | null; isVideo: boolean } {
  const first = item.opportunity_media?.[0]
  return {
    url:     first?.url ?? item.image_url ?? null,
    isVideo: first?.media_type === 'video',
  }
}

// ── Single tile ───────────────────────────────────────────────────────────────
const Tile = memo(function Tile({
  item, width, height, onPress, showInfo = false,
}: {
  item: any; width: number; height: number; onPress: (item: any) => void; showInfo?: boolean
}) {
  const { url, isVideo } = getMedia(item)
  const providerName = item.profiles?.full_name ?? ''
  const avatarUrl    = item.profiles?.avatar_url
  const initial      = (item.title ?? providerName ?? '?').slice(0, 1).toUpperCase()

  return (
    <TouchableOpacity
      style={[gt.tile, { width, height }]}
      onPress={() => onPress(item)}
      activeOpacity={0.88}
    >
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, gt.placeholder]}>
          <Text style={gt.placeholderText}>{initial}</Text>
        </View>
      )}

      {/* Bottom gradient scrim — two layered views simulate fade */}
      {showInfo && (
        <>
          <View style={gt.scrimMid} />
          <View style={gt.scrimBot} />
        </>
      )}

      {/* Video play badge */}
      {isVideo && (
        <View style={gt.playBadge}>
          <Play size={10} color="#fff" fill="#fff" />
        </View>
      )}

      {/* Provider info — only on large tiles */}
      {showInfo && (providerName || avatarUrl) && (
        <View style={gt.infoRow}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={gt.avatar} />
          ) : (
            <View style={gt.avatarFallback}>
              <Text style={gt.avatarText}>{providerName.slice(0, 1)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={gt.infoName} numberOfLines={1}>{providerName}</Text>
            {item.category ? (
              <Text style={gt.infoCategory} numberOfLines={1}>{item.category}</Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Price pill on large tiles */}
      {showInfo && item.price_pence ? (
        <View style={gt.pricePill}>
          <Text style={gt.priceText}>£{(item.price_pence / 100).toFixed(0)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  )
})

// ── Mosaic grid ───────────────────────────────────────────────────────────────
// Pattern repeats every 6 items:
//   Block A (even): [large-left 2/3×2x] + [2 small stacked 1/3×1x]  →  [3 small equal]
//   Block B (odd):  [3 small equal]  →  [2 small stacked 1/3×1x] + [large-right 2/3×2x]
function MosaicGrid({ items, onPress }: { items: any[]; onPress: (item: any) => void }) {
  const blocks: JSX.Element[] = []
  let i = 0, blockIdx = 0

  while (i < items.length) {
    const chunk = items.slice(i, i + 6)
    const isA   = blockIdx % 2 === 0

    if (chunk.length < 3) {
      // Remaining < 3: plain row
      blocks.push(
        <View key={`tail-${i}`} style={gt.row}>
          {chunk.map(item => (
            <Tile key={item.id} item={item} width={TILE_S} height={TILE_S} onPress={onPress} />
          ))}
        </View>
      )
      i += chunk.length
    } else if (isA) {
      // Block A: large-left
      blocks.push(
        <View key={`A-${i}`}>
          {/* Featured row */}
          <View style={gt.row}>
            <Tile item={chunk[0]} width={TILE_L} height={TILE_L} onPress={onPress} showInfo />
            <View style={gt.col}>
              <Tile item={chunk[1]} width={TILE_S} height={TILE_S} onPress={onPress} />
              {chunk[2] && <Tile item={chunk[2]} width={TILE_S} height={TILE_S} onPress={onPress} />}
            </View>
          </View>
          {/* Normal row */}
          {chunk.length > 3 && (
            <View style={gt.row}>
              {chunk.slice(3, 6).map(item => (
                <Tile key={item.id} item={item} width={TILE_S} height={TILE_S} onPress={onPress} />
              ))}
            </View>
          )}
        </View>
      )
      i += Math.min(chunk.length, 6)
    } else {
      // Block B: large-right
      blocks.push(
        <View key={`B-${i}`}>
          {/* Normal row */}
          <View style={gt.row}>
            {chunk.slice(0, 3).map(item => (
              <Tile key={item.id} item={item} width={TILE_S} height={TILE_S} onPress={onPress} />
            ))}
          </View>
          {/* Featured row */}
          {chunk.length > 3 && (
            <View style={gt.row}>
              <View style={gt.col}>
                <Tile item={chunk[3]} width={TILE_S} height={TILE_S} onPress={onPress} />
                {chunk[4] && <Tile item={chunk[4]} width={TILE_S} height={TILE_S} onPress={onPress} />}
              </View>
              {chunk[5] && (
                <Tile item={chunk[5]} width={TILE_L} height={TILE_L} onPress={onPress} showInfo />
              )}
            </View>
          )}
        </View>
      )
      i += Math.min(chunk.length, 6)
    }

    blockIdx++
  }

  return <View>{blocks}</View>
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const [query, setQuery]       = useState('')
  const [category, setCategory] = useState('All')
  const [focused, setFocused]   = useState(false)
  const { data: results, categories, loading, search } = useSearch()
  const router     = useRouter()
  const debounce   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef   = useRef<TextInput>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(query, category), 300)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query, category, search])

  const handlePress = useCallback((item: any) => {
    const handle = item.profiles?.username
    handle
      ? router.push(`/profile/${handle}` as any)
      : router.push(`/book/${item.provider_id}/index` as any)
  }, [router])

  const clearSearch = useCallback(() => {
    setQuery('')
    inputRef.current?.focus()
  }, [])

  const isSearching = query.length > 0 || category !== 'All'

  return (
    <View style={s.root}>
      <SafeAreaView style={{ backgroundColor: '#fff' }} />

      {/* ── Search bar ── */}
      <View style={s.searchRow}>
        <View style={[s.searchBar, focused && s.searchBarFocused]}>
          <Search size={16} color={focused ? '#111' : '#aaa'} strokeWidth={2} />
          <TextInput
            ref={inputRef}
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search providers, services…"
            placeholderTextColor="#bbb"
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => search(query, category)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={s.clearBtn}>
                <X size={11} color="#888" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={s.filterBtn} activeOpacity={0.7}>
          <SlidersHorizontal size={17} color="#111" strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {/* ── Category pills ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pills}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[s.pill, category === cat && s.pillActive]}
            onPress={() => setCategory(cat)}
            activeOpacity={0.7}
          >
            <Text style={[s.pillText, category === cat && s.pillTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Grid ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#111" size="small" />
        </View>
      ) : results.length === 0 ? (
        <View style={s.center}>
          <Search size={36} color="#e5e7eb" strokeWidth={1.5} />
          <Text style={s.emptyTitle}>
            {isSearching ? `Nothing found` : 'No posts yet'}
          </Text>
          {isSearching && (
            <Text style={s.emptySub}>Try a different keyword or category</Text>
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 90 }}
        >
          <MosaicGrid items={results} onPress={handlePress} />
        </ScrollView>
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', paddingTop: 8 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 10, gap: 10,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f2f2f2', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11, gap: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  searchBarFocused: { borderColor: '#e0e0e0', backgroundColor: '#fff' },
  searchInput: { flex: 1, fontSize: 15, color: '#111', paddingVertical: 0 },
  clearBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#d1d1d1', alignItems: 'center', justifyContent: 'center',
  },
  filterBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#f2f2f2', alignItems: 'center', justifyContent: 'center',
  },

  pills: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#f2f2f2',
  },
  pillActive:    { backgroundColor: '#111' },
  pillText:      { fontSize: 13, fontWeight: '600', color: '#666' },
  pillTextActive:{ color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#ccc' },
  emptySub:   { fontSize: 13, color: '#d1d5db' },
})

// Grid tile styles
const gt = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  col: { gap: GAP },

  tile: { overflow: 'hidden', backgroundColor: '#f5f5f5' },

  placeholder:     { alignItems: 'center', justifyContent: 'center', backgroundColor: '#ececec' },
  placeholderText: { fontSize: 28, fontWeight: '700', color: '#d0d0d0' },

  scrimMid: { position: 'absolute', left: 0, right: 0, bottom: '15%', height: '35%', backgroundColor: 'rgba(0,0,0,0.18)' },
  scrimBot: { position: 'absolute', left: 0, right: 0, bottom: 0,     height: '18%', backgroundColor: 'rgba(0,0,0,0.5)' },

  // Video indicator — top right
  playBadge: {
    position: 'absolute', top: 7, right: 7,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Provider info — bottom left on large tiles
  infoRow: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 10, paddingBottom: 10, paddingTop: 24,
    backgroundColor: 'rgba(0,0,0,0)',
    // The "gradient" is emulated by the black overlay below
  },

  avatar:        { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  avatarFallback:{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#ff5a1f', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  avatarText:    { fontSize: 10, fontWeight: '700', color: '#fff' },

  infoName:     { fontSize: 11, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  infoCategory: { fontSize: 9, fontWeight: '500', color: 'rgba(255,255,255,0.75)', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },

  pricePill: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  priceText: { fontSize: 10, fontWeight: '700', color: '#fff' },
})
