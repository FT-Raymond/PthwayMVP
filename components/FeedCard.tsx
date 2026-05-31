import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  Image, Animated, FlatList, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useRouter } from 'expo-router'
import { Heart, MapPin, Star } from 'lucide-react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

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
  ratingCount: number
  serviceTitle: string
  category?: string | null
  coverUrl: string | null
  videoUrl?: string | null
  mediaUrls?: string[] | null
  pricePence?: number | null
}

type Props = {
  item: FeedItem
  active: boolean
}

function PhotoSlideshow({ photos, onDoubleTap }: { photos: string[]; onDoubleTap: () => void }) {
  const [index, setIndex] = useState(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
  }

  function handleTap() {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current); tapTimer.current = null
      onDoubleTap()
    } else {
      tapTimer.current = setTimeout(() => { tapTimer.current = null }, 220)
    }
  }

  return (
    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleTap}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item: uri }) => (
          <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />
        )}
      />
      {photos.length > 1 && (
        <View style={s.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[s.dot, i === index && s.dotActive]} />
          ))}
        </View>
      )}
    </TouchableOpacity>
  )
}

export function FeedCard({ item, active }: Props) {
  const router = useRouter()
  const [liked, setLiked] = useState(false)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(true)
  const [likeBurst, setLikeBurst] = useState(0)
  const burstAnim = useRef(new Animated.Value(0)).current
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isVideo = !!item.videoUrl
  const isSlideshow = !isVideo && !!item.mediaUrls && item.mediaUrls.length > 1

  const displayTitle = (item.serviceTitle && item.serviceTitle !== item.name)
    ? item.serviceTitle
    : (item.category ?? 'Service')

  const displayCaption = (item.caption && !item.caption.startsWith(`${item.serviceTitle} with`))
    ? item.caption
    : (item.bio ?? null)

  const player = useVideoPlayer(
    isVideo && item.videoUrl ? { uri: item.videoUrl } : null,
    (p) => { p.loop = true; p.muted = true }
  )

  useEffect(() => {
    if (!player || !isVideo) return
    try {
      if (active && !paused) {
        player.play()
      } else {
        player.pause()
        if (!active) { player.muted = true; setMuted(true); setPaused(false) }
      }
    } catch (e) {}
  }, [active, paused, isVideo])

  function triggerLikeBurst() {
    setLiked(true)
    setLikeBurst(n => n + 1)
    burstAnim.setValue(0)
    Animated.sequence([
      Animated.spring(burstAnim, { toValue: 1, useNativeDriver: true, friction: 4 }),
      Animated.delay(400),
      Animated.timing(burstAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start()
  }

  function handleVideoTap() {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current); tapTimer.current = null
      triggerLikeBurst()
    } else {
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null
        setPaused(p => !p)
      }, 220)
    }
  }

  function toggleMute() {
    if (!player) return
    try { const next = !muted; player.muted = next; setMuted(next) } catch (e) {}
  }

  const burstScale = burstAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.4] })

  return (
    <View style={s.card}>

      {/* Media */}
      {isVideo && item.videoUrl ? (
        <>
          <VideoView
            player={player}
            style={s.fill}
            contentFit="cover"
            nativeControls={false}
            allowsPictureInPicture={false}
          />
          <TouchableOpacity style={s.fill} activeOpacity={1} onPress={handleVideoTap} />
          {paused && (
            <View style={[s.fill, s.pausedOverlay]} pointerEvents="none">
              <View style={s.pausedIcon}>
                <Ionicons name="play" size={32} color="#fff" />
              </View>
            </View>
          )}
        </>
      ) : isSlideshow && item.mediaUrls ? (
        <PhotoSlideshow photos={item.mediaUrls} onDoubleTap={triggerLikeBurst} />
      ) : item.coverUrl ? (
        <Image source={{ uri: item.coverUrl }} style={s.fill} resizeMode="cover" />
      ) : (
        <View style={[s.fill, { backgroundColor: '#111' }]} />
      )}

      {/* Like burst */}
      {likeBurst > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[s.likeBurst, { transform: [{ scale: burstScale }], opacity: burstAnim }]}
        >
          <Heart size={120} color="#ff5a1f" fill="#ff5a1f" />
        </Animated.View>
      )}

      {/* Gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.2, 0.5, 1]}
        style={s.fill}
        pointerEvents="none"
      />

      {/* Overlay — pushed low, tight to nav */}
      <View style={s.overlay} pointerEvents="box-none">

        {/* Provider row */}
        <TouchableOpacity
          style={s.providerRow}
          onPress={() => router.push(`/profile/${item.handle}` as any)}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={s.handle}>@{item.handle}</Text>
          {item.verified && (
            <Ionicons name="checkmark-circle" size={15} color="#ff5a1f" />
          )}
        </TouchableOpacity>

        {/* Service title + rating inline */}
        <View style={s.titleRow}>
          <Text style={s.serviceTitle} numberOfLines={1}>{displayTitle}</Text>
          <View style={s.ratingInline}>
            <Star size={13} color="#ff5a1f" fill="#ff5a1f" />
            <Text style={s.rating}>{item.rating.toFixed(1)}</Text>
            <Text style={s.ratingCount}>({item.ratingCount})</Text>
          </View>
        </View>

        {/* Caption */}
        {!!displayCaption && (
          <Text style={s.caption} numberOfLines={2}>{displayCaption}</Text>
        )}

        {/* Pills row — no '/book/[providerId]/calendar' */}
        <View style={s.bottomRow}>
          {item.category && (
            <View style={s.pill}>
              <Text style={s.pillText}>#{item.category.toLowerCase()}</Text>
            </View>
          )}
          {item.location && (
            <View style={s.locationPill}>
              <MapPin size={10} color="#fff" fill="#fff" />
              <Text style={s.locationText} numberOfLines={1}>{item.location}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Like button */}
      <TouchableOpacity
        style={s.likeBtn}
        onPress={() => liked ? setLiked(false) : triggerLikeBurst()}
      >
        <Heart
          size={28}
          color={liked ? '#ff5a1f' : '#fff'}
          fill={liked ? '#ff5a1f' : 'transparent'}
        />
      </TouchableOpacity>

      {/* Mute hint */}
      {isVideo && (
        <TouchableOpacity style={s.muteBtn} onPress={toggleMute}>
          <Ionicons
            name={muted ? 'volume-mute' : 'volume-high'}
            size={13}
            color="rgba(255,255,255,0.75)"
          />
          <Text style={s.muteBtnText}>{muted ? 'Tap to unmute' : 'Sound on'}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const NAV = 84

const s = StyleSheet.create({
  card: { width, height, backgroundColor: '#000', overflow: 'hidden' },

  fill: {
    position: 'absolute',
    top: 0, left: 0,
    width, height,
  },

  pausedOverlay: { justifyContent: 'center', alignItems: 'center' },
  pausedIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },

  likeBurst: {
    position: 'absolute',
    top: '50%', left: '50%',
    marginTop: -60, marginLeft: -60,
    zIndex: 30,
  },

  // Tight to nav bar — only 8px above it
  overlay: {
    position: 'absolute',
    bottom: NAV + -20,
    left: 16,
    right: 16,
    zIndex: 10,
  },

  providerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 6,
  },
  avatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#ff5a1f',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
  },
  avatarText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  handle: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Title + rating on same line
  titleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  serviceTitle: {
    fontSize: 26, fontWeight: '800', color: '#fff',
    letterSpacing: -0.5, flex: 1, lineHeight: 30,
  },
  ratingInline: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, marginLeft: 8,
  },
  rating: { fontSize: 13, fontWeight: '600', color: '#fff' },
  ratingCount: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  caption: {
    fontSize: 13, color: 'rgba(255,255,255,0.92)',
    lineHeight: 19, marginBottom: 10,
    maxWidth: '85%',
  },

  bottomRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8,
  },
  pill: {
    height: 26, paddingHorizontal: 10, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
  },
  pillText: { fontSize: 10.5, fontWeight: '600', color: '#ff5a1f' },
  locationPill: {
    height: 26, paddingHorizontal: 12, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.75)',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    maxWidth: 140,
  },
  locationText: { fontSize: 10.5, color: '#fff' },

  likeBtn: {
    position: 'absolute',
    right: 16,
    bottom: NAV + 120,
    zIndex: 20,
  },

  muteBtn: {
    position: 'absolute',
    top: 52,
    left: width / 2 - 60,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    zIndex: 20,
  },
  muteBtnText: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },

  dots: {
    position: 'absolute', top: 52,
    left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#fff', width: 16 },
})
