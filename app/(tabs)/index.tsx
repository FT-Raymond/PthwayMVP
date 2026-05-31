import { useState, useRef, useCallback } from 'react'
import {
  View, FlatList, StyleSheet, Dimensions,
  ViewToken, ActivityIndicator, Text, TouchableOpacity,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { FeedCard, FeedItem } from '@/components/FeedCard'

const { height } = Dimensions.get('window')

export default function FeedScreen() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useFocusEffect(useCallback(() => {
    loadFeed()
    return () => { setActiveIndex(-1) }
  }, []))

  async function loadFeed() {
    setError(false)
    try {
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id, provider_id, caption, media_url, media_type, media_urls, category, location')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(30)

      if (postsError) throw postsError
      if (!posts || posts.length === 0) { setItems([]); setLoading(false); return }

      const providerIds = [...new Set(posts.map((p: any) => p.provider_id))]

      // Fetch profiles + provider_profiles for category/bio
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, bio')
        .in('id', providerIds)

      const { data: providerProfiles } = await supabase
        .from('provider_profiles')
        .select('id, category, business_name')
        .in('id', providerIds)

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
      const providerMap = new Map((providerProfiles ?? []).map((p: any) => [p.id, p]))

      setItems(posts.map((p: any) => {
        const profile = profileMap.get(p.provider_id)
        const provider = providerMap.get(p.provider_id)
        const isVideo = p.media_type === 'video'
        const mediaUrls: string[] = p.media_urls ?? []

        // serviceTitle priority: post category > provider category > provider name
        const serviceTitle =
          p.category ||
          provider?.category ||
          provider?.business_name ||
          profile?.full_name ||
          'Service'

        return {
          id: p.id,
          providerId: p.provider_id,
          name: profile?.full_name ?? 'Provider',
          handle: profile?.username ?? p.provider_id.slice(0, 8),
          bio: profile?.bio ?? null,
          caption: p.caption ?? null,
          location: p.location ?? null,
          rating: 4.9,
          ratingCount: 0,
          serviceTitle,
          category: p.category ?? provider?.category ?? null,
          coverUrl: isVideo ? null : (mediaUrls[0] ?? p.media_url ?? null),
          videoUrl: isVideo ? (p.media_url ?? null) : null,
          mediaUrls: !isVideo && mediaUrls.length > 1 ? mediaUrls : null,
          verified: false,
        } as FeedItem
      }))
    } catch (err) {
      console.error('Feed error:', err)
      setError(true)
    }
    setLoading(false)
  }

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0)
    }
  ).current

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color="#ff5a1f" size="large" />
    </View>
  )

  if (error) return (
    <View style={s.center}>
      <Ionicons name="wifi-outline" size={48} color="#333" />
      <Text style={s.errorText}>Couldn't load feed</Text>
      <TouchableOpacity style={s.retryBtn} onPress={loadFeed}>
        <Text style={s.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={s.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <FeedCard item={item} active={index === activeIndex} />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={1}
        ListEmptyComponent={
          <View style={s.center}>
            <Ionicons name="videocam-outline" size={48} color="#333" />
            <Text style={s.errorText}>No posts yet</Text>
          </View>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, height, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: 14 },
  errorText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  retryBtn: { backgroundColor: '#ff5a1f', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { fontSize: 14, color: '#fff', fontWeight: '600' },
})
