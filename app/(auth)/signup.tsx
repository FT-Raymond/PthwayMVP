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

export default function SignupScreen() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function signUp() {
    if (!fullName || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      Alert.alert('Error', error.message)
      setLoading(false)
      return
    }
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        role: 'customer',
      })
      if (profileError) {
        Alert.alert('Error', profileError.message)
        setLoading(false)
        return
      }
    }
    setLoading(false)
    router.replace('/(onboarding)/interests' as any)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <LinearGradient
        colors={BACKGROUND_COLORS}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.backgroundGradient}
      />

      <SafeAreaView style={styles.modal}>
        <View style={styles.handle} />

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={32} color="#111" />
        </TouchableOpacity>

        <Text style={styles.title}>Sign up</Text>
        <Text style={styles.subtitle}>Create an account with your email.</Text>

        {/* Full name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full name</Text>
          <View style={styles.inputWrapper}>
            <Feather name="user" size={20} color="#8A8A8A" />
            <TextInput
              placeholder="Enter your full name"
              placeholderTextColor="#9D9D9D"
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>
        </View>

        {/* Email */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrapper}>
            <Feather name="mail" size={20} color="#8A8A8A" />
            <TextInput
              placeholder="Enter your email"
              placeholderTextColor="#9D9D9D"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        </View>

        {/* Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Feather name="lock" size={20} color="#8A8A8A" />
            <TextInput
              placeholder="Create a password"
              placeholderTextColor="#9D9D9D"
              secureTextEntry={!showPassword}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Feather name={showPassword ? 'eye' : 'eye-off'} size={20} color="#8A8A8A" />
            </TouchableOpacity>
          </View>
          <Text style={styles.passwordHint}>
            Use 8+ characters with a mix of letters, numbers & symbols.
          </Text>
        </View>

        {/* Create button */}
        <TouchableOpacity
          activeOpacity={0.92}
          style={styles.primaryButton}
          onPress={signUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Create account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.or}>or</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity activeOpacity={0.9} style={styles.socialButton}>
          <Ionicons name="logo-apple" size={24} color="#111" />
          <Text style={styles.socialText}>Sign up with Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.9} style={styles.socialButton}>
          <Ionicons name="logo-google" size={22} color="#111" />
          <Text style={styles.socialText}>Sign up with Google</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.loginText}> Log in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backgroundGradient: { flex: 1 },
  modal: {
    position: 'absolute', bottom: 0, width: '100%',
    height: height * 0.79, backgroundColor: '#FFF',
    borderTopLeftRadius: 42, borderTopRightRadius: 42,
    paddingHorizontal: 28, alignItems: 'center',
  },
  handle: {
    width: 56, height: 6, borderRadius: 100,
    backgroundColor: '#D8D8D8', marginTop: 12,
  },
  backButton: { position: 'absolute', left: 18, top: 52 },
  title: { marginTop: 46, fontSize: 38, fontWeight: '700', color: '#111', letterSpacing: -1.5 },
  subtitle: { marginTop: 12, fontSize: 17, color: '#7D7D7D', textAlign: 'center' },
  inputGroup: { width: '100%', marginTop: 24 },
  label: { marginBottom: 12, fontSize: 17, fontWeight: '500', color: '#111' },
  inputWrapper: {
    width: '100%', height: 62, borderRadius: 20,
    borderWidth: 1.4, borderColor: '#E7E7E7',
    paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center',
  },
  input: { flex: 1, marginLeft: 12, fontSize: 17, color: '#111' },
  passwordHint: { marginTop: 12, fontSize: 14, lineHeight: 22, color: '#8A8A8A' },
  primaryButton: {
    marginTop: 32, width: '100%', height: 62, borderRadius: 100,
    backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 18, color: '#FFF', fontWeight: '600' },
  dividerRow: { width: '100%', marginTop: 24, flexDirection: 'row', alignItems: 'center' },
  divider: { flex: 1, height: 1, backgroundColor: '#E8E8E8' },
  or: { marginHorizontal: 18, fontSize: 16, color: '#7A7A7A' },
  socialButton: {
    width: '100%', height: 62, borderRadius: 100,
    borderWidth: 1.4, borderColor: '#E6E6E6',
    backgroundColor: '#FFF', marginTop: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  socialText: { marginLeft: 12, fontSize: 18, color: '#111', fontWeight: '500' },
  footer: { marginTop: 28, flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 16, color: '#707070' },
  loginText: { fontSize: 16, color: '#2563FF', fontWeight: '600' },
})