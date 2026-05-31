import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, SafeAreaView, StatusBar, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons, Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'

const { width, height } = Dimensions.get('window')
const BACKGROUND_COLORS = ['#0F5FFF', '#57B7FF', '#DCEEFF']

export default function LoginScreen() {
  const router = useRouter()
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function signIn() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) Alert.alert('Error', error.message)
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <LinearGradient
        colors={BACKGROUND_COLORS}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.sheet}>
        <View style={styles.handle} />

        {showEmailForm ? (
          <>
            <TouchableOpacity style={styles.backBtn} onPress={() => setShowEmailForm(false)}>
              <Feather name="arrow-left" size={22} color="#111" />
            </TouchableOpacity>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Enter your email and password.</Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity style={styles.primaryButton} onPress={signIn} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Log in</Text>
            <Text style={styles.subtitle}>Welcome back! Please log in to continue.</Text>

            <TouchableOpacity style={styles.primaryButton} onPress={() => setShowEmailForm(true)}>
              <Feather name="mail" size={21} color="#FFF" />
              <Text style={styles.primaryButtonText}>Continue with email</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.or}>or</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-apple" size={24} color="#111" />
              <Text style={styles.socialText}>Continue with Apple</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-google" size={22} color="#111" />
              <Text style={styles.socialText}>Continue with Google</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.signupText}> Sign up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sheet: {
    position: 'absolute', bottom: 0, width: '100%',
    height: height * 0.58, backgroundColor: '#FFF',
    borderTopLeftRadius: 42, borderTopRightRadius: 42,
    paddingHorizontal: 28, alignItems: 'center',
  },
  handle: {
    width: 56, height: 6, borderRadius: 100,
    backgroundColor: '#ffffff', marginTop: 12,
  },
  backBtn: { alignSelf: 'flex-start', marginTop: 16, marginBottom: 4 },
  title: { marginTop: 28, fontSize: 40, fontWeight: '700', color: '#111', letterSpacing: -1.6 },
  subtitle: { marginTop: 12, fontSize: 17, color: '#7D7D7D', textAlign: 'center', lineHeight: 24 },
  input: {
    width: '100%', height: 58, borderRadius: 16,
    borderWidth: 1.4, borderColor: '#E6E6E6',
    paddingHorizontal: 18, fontSize: 16, color: '#111', marginTop: 14,
  },
  primaryButton: {
    marginTop: 28, width: '100%', height: 62, borderRadius: 100,
    backgroundColor: '#111', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  primaryButtonText: { fontSize: 18, color: '#FFF', fontWeight: '500' },
  dividerRow: { width: '100%', marginTop: 24, flexDirection: 'row', alignItems: 'center' },
  divider: { flex: 1, height: 1, backgroundColor: '#E8E8E8' },
  or: { marginHorizontal: 18, fontSize: 16, color: '#7A7A7A' },
  socialButton: {
    width: '100%', height: 62, borderRadius: 100,
    borderWidth: 1.4, borderColor: '#E6E6E6',
    backgroundColor: '#FFF', marginTop: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  socialText: { fontSize: 18, color: '#111', fontWeight: '500' },
  footer: { marginTop: 24, flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 16, color: '#707070' },
  signupText: { fontSize: 16, color: '#2563FF', fontWeight: '600' },
})