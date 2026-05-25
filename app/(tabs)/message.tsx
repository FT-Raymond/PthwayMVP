import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'expo-router'
import { MessageCircle } from 'lucide-react-native'

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

    const { data } = await supabase
      .from('conversations')
      .select(`
        id, created_at,
        provider:profiles!conversations_provider_id_fkey(id, full_name),
        customer:profiles!conversations_customer_id_fkey(id, full_name),
        messages(content, created_at, sender_id)
      `)
      .or(`provider_id.eq.${user.id},customer_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    setConversations(data ?? [])
    setLoading(false)
  }

  function getOtherPerson(conv: any) {
    if (conv.provider?.id === userId) return conv.customer
    return conv.provider
  }

  function getLastMessage(conv: any) {
    const msgs = conv.messages ?? []
    if (!msgs.length) return 'No messages yet'
    const last = msgs.sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]
    return last.content
  }

  function initials(name: string) {
    return name.split(' ').map((p: string) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ff5a1f" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <MessageCircle size={48} color="#ccc" />
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
          renderItem={({ item }) => {
            const other = getOtherPerson(item)
            const lastMsg = getLastMessage(item)
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/messages/${item.id}` as any)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {initials(other?.full_name ?? '?')}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{other?.full_name ?? 'Unknown'}</Text>
                  <Text style={styles.cardLastMsg} numberOfLines={1}>{lastMsg}</Text>
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
  title: { fontSize: 32, fontWeight: '700', paddingHorizontal: 20, marginBottom: 20, letterSpacing: -0.8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 14,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '600', color: '#111' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 3 },
  cardLastMsg: { fontSize: 13, color: '#888' },
})