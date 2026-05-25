import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { Search } from 'lucide-react-native'
import { useRouter } from 'expo-router'

const CATEGORIES = ['All', 'Hair', 'Nails', 'Lashes', 'Fitness', 'Driving', 'Events']

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => { search() }, [query, category])

  async function search() {
    setLoading(true)
    let q = supabase
      .from('opportunities')
      .select(`
        id, title, description, category, location, price_pence,
        provider_id,
        profiles!opportunities_provider_id_fkey(full_name, username),
        opportunity_media(url, media_type)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(30)

    if (query) q = q.ilike('title', `%${query}%`)
    if (category !== 'All') q = q.ilike('category', `%${category}%`)

    const { data } = await q
    setResults(data ?? [])
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBox}>
        <Search size={16} color="#666" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search providers, services..."
          placeholderTextColor="#666"
          autoCapitalize="none"
        />
      </View>

      {/* Category filters */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.catBtn, category === item && styles.catBtnActive]}
            onPress={() => setCategory(item)}
          >
            <Text style={[styles.catText, category === item && styles.catTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ff5a1f" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.results}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No results found.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cover = item.opportunity_media?.[0]?.url
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/book/${item.provider_id}/calendar` as any)}
              >
                {cover ? (
                  <Image source={{ uri: cover }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardProvider} numberOfLines={1}>
                    {item.profiles?.full_name ?? 'Provider'}
                  </Text>
                  {item.location && (
                    <Text style={styles.cardLocation} numberOfLines={1}>{item.location}</Text>
                  )}
                  {item.price_pence && (
                    <Text style={styles.cardPrice}>£{(item.price_pence / 100).toFixed(0)}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111' },
  categories: { paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  catBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  catBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  catText: { fontSize: 13, fontWeight: '600', color: '#666' },
  catTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#888' },
  results: { paddingHorizontal: 16, paddingBottom: 100, gap: 12 },
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
  },
  cardImage: { width: 100, height: 100 },
  cardImagePlaceholder: { backgroundColor: '#f5f5f5' },
  cardInfo: { flex: 1, padding: 12, justifyContent: 'center', gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  cardProvider: { fontSize: 13, color: '#888' },
  cardLocation: { fontSize: 12, color: '#aaa' },
  cardPrice: { fontSize: 14, fontWeight: '700', color: '#ff5a1f' },
})