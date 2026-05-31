import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'expo-router'
import { MessageCircle, Search } from 'lucide-react-native'

function initials(name: string) {
  return (name ?? '?').split(' ').map((p: string) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => { loadConversations() }, [])

  async function loadConversations() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    // Get conversations
    const { data: convs } = await supabase
      .from('conversations')
      .select('id, created_at, provider_id, customer_id')
      .or(`provider_id.eq.${user.id},customer_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (!convs || convs.length === 0) { setLoading(false); return }

    // Get all profile ids
    const ids = Array.from(new Set([
      ...convs.map((c: any) => c.provider_id),
      ...convs.map((c: any) => c.customer_id),
    ]))

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', ids)

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    // Get last messages
    const convIds = convs.map((c: any) => c.id)
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, content, created_at, sender_id')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })

    const lastMsgMap = new Map<string, any>()
    ;(msgs ?? []).forEach((m: any) => {
      if (!lastMsgMap.has(m.conversation_id)) {
        lastMsgMap.set(m.conversation_id, m)
      }
    })

    const enriched = convs.map((c: any) => ({
      ...c,
      provider: profileMap.get(c.provider_id),
      customer: profileMap.get(c.customer_id),
      lastMsg: lastMsgMap.get(c.id),
    }))

    setConversations(enriched)
    setLoading(false)
  }

  function getOther(conv: any) {
    if (conv.provider_id === userId) return conv.customer
    return conv.provider
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity style={styles.searchBtn}>
          <Search size={20} color="#111" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {['All', 'Unread', 'Archived'].map((f, i) => (
          <TouchableOpacity key={f} style={[styles.filterTab, i === 0 && styles.filterTabActive]}>
            <Text style={[styles.filterText, i === 0 && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#ff6b35" /></View>
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <MessageCircle size={32} color="#ccc" />
          </View>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySub}>
            When you book a provider or receive a booking, messages will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const other = getOther(item)
            const last = item.lastMsg
            const unread = last?.sender_id !== userId
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/messages/${item.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.avatarWrap}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(other?.full_name ?? '?')}</Text>
                  </View>
                  <View style={styles.onlineDot} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardName} numberOfLines={1}>{other?.full_name ?? 'Unknown'}</Text>
                    <Text style={[styles.cardTime, unread && last && styles.cardTimeUnread]}>
                      {last ? timeAgo(last.created_at) : timeAgo(item.created_at)}
                    </Text>
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={[styles.cardMsg, unread && last && styles.cardMsgUnread]} numberOfLines={1}>
                      {last?.content ?? 'No messages yet'}
                    </Text>
                    {unread && last && <View style={styles.unreadDot} />}
                  </View>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#111', letterSpacing: -0.8 },
  searchBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e8e8e8' },
  filterTabActive: { backgroundColor: '#111', borderColor: '#111' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#888' },
  filterTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  list: { paddingBottom: 100 },
  card: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '600', color: '#111' },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#fff' },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#111', flex: 1, marginRight: 8 },
  cardTime: { fontSize: 12, color: '#aaa' },
  cardTimeUnread: { color: '#ff6b35', fontWeight: '600' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMsg: { fontSize: 14, color: '#888', flex: 1 },
  cardMsgUnread: { color: '#111', fontWeight: '600' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff6b35' },
  separator: { height: 1, backgroundColor: '#f8f8f8', marginLeft: 90 },
})