import { useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  Image, Animated,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Heart, MapPin, Star, Play, BadgeCheck } from 'lucide-react-native'
import { Video, ResizeMode } from 'expo-av'

const { width, height } = Dimensions.get('window')

export type FeedItem = {
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
  is_event?: boolean
  event_title?: string | null
  event_date_month?: string | null
  event_date_day?: string | null
  event_time?: string | null
  event_going?: number | null
}

type Props = {
  item: FeedItem
  active: boolean
}

export function FeedCard({ item, active }: Props) {
  const router = useRouter()
  const [liked, setLiked] = useState(false)
  const [likeBurst, setLikeBurst] = useState(false)
  const [paused, setPaused] = useState(false)
  const videoRef = useRef<any>(null)
  const heartScale = useRef(new Animated.Value(0)).current

  function onDoubleTap() {
    setLiked(true)
    setLikeBurst(true)
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true }),
      Animated.delay(600),
      Animated.spring(heartScale, { toValue: 0, useNativeDriver: true }),
    ]).start(() => setLikeBurst(false))
  }

  function goToProfile() {
    router.push(`/profile/${item.handle}` as any)
  }

  function goToBooking() {
    router.push(`/book/${item.providerId}/calendar` as any)
  }

  return (
    <View style={styles.container}>
      {/* Background media */}
      {item.video_url ? (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setPaused(p => !p)}
          onLongPress={onDoubleTap}
        >
          <Video
            ref={videoRef}
            source={{ uri: item.video_url }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={active && !paused}
            isMuted={false}
          />
          {paused && (
            <View style={styles.pauseOverlay}>
              <View style={styles.pauseIcon}>
                <Play size={40} color="#fff" fill="#fff" />
              </View>
            </View>
          )}
        </TouchableOpacity>
      ) : item.cover_url ? (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onLongPress={onDoubleTap}
        >
          <Image
            source={{ uri: item.cover_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      )}

      {/* Gradient overlay */}
      <View style={[StyleSheet.absoluteFill, styles.gradient]} pointerEvents="none" />

      {/* Heart burst */}
      {likeBurst && (
        <Animated.View style={[styles.heartBurst, { transform: [{ scale: heartScale }] }]}>
          <Heart size={120} color="#ff5a1f" fill="#ff5a1f" />
        </Animated.View>
      )}

      {/* Event overlay */}
      {item.is_event ? (
        <View style={styles.eventOverlay}>
          <View style={styles.eventNameRow}>
            <Text style={styles.eventProviderName}>{item.name}</Text>
            {item.verified && <BadgeCheck size={16} color="#38bdf8" fill="#38bdf8" />}
          </View>
          <View style={styles.eventDateRow}>
            <View style={styles.eventDateBox}>
              <Text style={styles.eventDateMonth}>{item.event_date_month}</Text>
              <Text style={styles.eventDateDay}>{item.event_date_day}</Text>
            </View>
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle}>{item.event_title ?? `${item.name} Event`}</Text>
              <Text style={styles.eventMeta}>{item.category} • {item.event_time} • {item.location}</Text>
            </View>
          </View>
          <Text style={styles.eventGoing}>+{item.event_going?.toLocaleString()} going</Text>
        </View>
      ) : (
        <View style={styles.overlay}>
          {/* Provider info */}
          <TouchableOpacity style={styles.providerRow} onPress={goToProfile}>
            <View style={styles.providerAvatar}>
              <Text style={styles.providerAvatarText}>{item.name.slice(0, 1)}</Text>
            </View>
            <Text style={styles.providerHandle}>@{item.handle}</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓</Text>
            </View>
          </TouchableOpacity>

          {/* Service title + rating */}
          <View style={styles.titleRow}>
            <Text style={styles.serviceTitle}>{item.service_title}</Text>
            <Star size={14} color="#ff5a1f" fill="#ff5a1f" />
            <Text style={styles.rating}>{item.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({item.rating_count})</Text>
          </View>

          {/* Caption */}
          <Text style={styles.caption} numberOfLines={2}>
            {item.caption ?? item.bio ?? `${item.service_title} with ${item.name}`}
          </Text>

          {/* Bottom row */}
          <View style={styles.bottomRow}>
            {(item.hashtag || item.category) && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{item.hashtag || item.category}</Text>
              </View>
            )}
            {item.location && (
              <View style={styles.locationPill}>
                <MapPin size={10} color="#fff" fill="#fff" />
                <Text style={styles.locationText} numberOfLines={1}>{item.location}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.bookBtn} onPress={goToBooking}>
              <Text style={styles.bookBtnText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width,
    height,
    backgroundColor: '#000',
  },
  placeholder: {
    backgroundColor: '#111',
  },
  gradient: {
    background: 'transparent',
    backgroundColor: 'transparent',
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartBurst: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -60,
    marginTop: -60,
    zIndex: 30,
  },
  eventOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
  },
  eventNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  eventProviderName: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  eventDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  eventDateBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  eventDateMonth: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  eventDateDay: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111',
    lineHeight: 30,
  },
  eventInfo: { flex: 1 },
  eventTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
  eventMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  eventGoing: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  overlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  providerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff5a1f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  providerAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  providerHandle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff5a1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  serviceTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  rating: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  ratingCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  caption: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 20,
    marginBottom: 14,
    maxWidth: '82%',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    maxWidth: '33%',
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ff5a1f',
  },
  locationPill: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '30%',
  },
  locationText: {
    fontSize: 10,
    color: '#fff',
  },
  bookBtn: {
    marginLeft: 'auto',
    height: 38,
    minWidth: 120,
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
  bookBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
})