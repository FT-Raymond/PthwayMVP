import { useEffect, useState, useRef } from 'react'
import {
  View, FlatList, StyleSheet, Dimensions,
  ViewToken, Text, TouchableOpacity, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Heart, MapPin, Star, BadgeCheck } from 'lucide-react-native'

const { width, height } = Dimensions.get('window')

type FeedItem = {
  id: string
  providerId: string
  name: string
  handle: string
  verified?: boolean
  bio: string | null
  caption?: string | null
  location: string | null
  rating: number
  rating_count: number
  service_title: string
  hashtag: string | null
  cover_url: string | null
  video_url?: string | null
  category?: string | null
  price_pence?: number | null
}

function FeedCard({ item, active }: { item: FeedItem; active: boolean }) {
  const router = useRouter()
  const [liked, setLiked] = useState(false)

  return (
    <View style={styles.card}>
      {item.cover_url ? (
        <Image
          source={{ uri: item.cover_url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      )}

      {/* Gradient */}
      <View style={styles.gradient} pointerEvents="none" />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Provider */}
        <TouchableOpacity
          style={styles.providerRow}
          onPress={() => router.push(`/profile/${item.handle}` as any)}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.slice(0, 1)}</Text>
          </View>
          <Text style={styles.handle}>@{item.handle}</Text>
          {item.verified && (
            <BadgeCheck size={14} color="#ff5a1f" fill="#ff5a1f" />
          )}
        </TouchableOpacity>

        {/* Service + rating */}
        <View style={styles.titleRow}>
          <Text style={styles.serviceTitle} numberOfLines={1}>
            {item.service_title}
          </Text>
          <Star size={13} color="#ff5a1f" fill="#ff5a1f" />
          <Text style={styles.rating}>{item.rating.toFixed(1)}</Text>
        </View>

        {/* Caption */}
        <Text style={styles.caption} numberOfLines={2}>
          {item.caption ?? item.bio ?? ''}
        </Text>

        {/* Bottom row */}
        <View style={styles.bottomRow}>
          {item.category && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{item.category}</Text>
            </View>
          )}
          {item.location && (
            <View style={styles.locationPill}>
              <MapPin size={10} color="#fff" fill="#fff" />
              <Text style={styles.locationText} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => router.push(`/book/${item.providerId}/calendar` as any)}
          >
            <Text style={styles.bookBtnText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Like button */}
      <TouchableOpacity
        style={styles.likeBtn}
        onPress={() => setLiked(l => !l)}
      >
        <Heart
          size={28}
          color={liked ? '#ff5a1f' : '#fff'}
          fill={liked ? '#ff5a1f' : 'transparent'}
        />
      </TouchableOpacity>
    </View>
  )
}

export default function FeedScreen() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => { loadFeed() }, [])

  async function loadFeed() {
    const { data } = await supabase
      .from('opportunities')
      .select(`
        id,
        provider_id,
        title,
        description,
        category,
        price_pence,
        location,
        profiles!opportunities_provider_id_fkey(
          id, full_name, username, bio
        ),
        opportunity_media(url, media_type)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) {
      setItems(data.map((o: any) => ({
        id: o.id,
        providerId: o.provider_id,
        name: o.profiles?.full_name ?? 'Provider',
        handle: o.profiles?.username ?? o.provider_id.slice(0, 8),
        bio: o.profiles?.bio ?? null,
        caption: o.description,
        location: o.location,
        rating: 4.9,
        rating_count: 0,
        service_title: o.title,
        hashtag: o.category,
        cover_url: o.opportunity_media?.[0]?.url ?? null,
        video_url: o.opportunity_media?.find((m: any) => m.media_type === 'video')?.url ?? null,
        category: o.category,
        price_pence: o.price_pence,
      })))
    }
  }

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0)
    }
  }).current

  return (
    <View style={styles.container}>
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
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No posts yet.</Text>
            <Text style={styles.emptySub}>Providers will appear here once they post.</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  card: { width, height, backgroundColor: '#111' },
  placeholder: { backgroundColor: '#1a1a1a' },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.6,
    backgroundColor: 'transparent',
  },
  overlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 60,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff5a1f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  handle: { fontSize: 13, fontWeight: '600', color: '#fff' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  serviceTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    flex: 1,
  },
  rating: { fontSize: 13, fontWeight: '600', color: '#fff' },
  caption: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    marginBottom: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
  },
  pillText: { fontSize: 10, fontWeight: '600', color: '#ff5a1f' },
  locationPill: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 120,
  },
  locationText: { fontSize: 10, color: '#fff' },
  bookBtn: {
    height: 38,
    borderRadius: 9,
    backgroundColor: '#ff5a1f',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    shadowColor: '#ff5a1f',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bookBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  likeBtn: {
    position: 'absolute',
    right: 16,
    bottom: 200,
  },
  empty: {
    height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  emptySub: { fontSize: 14, color: '#666', marginTop: 8 },
})