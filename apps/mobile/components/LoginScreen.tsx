import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api, saveSession, Session } from '../lib/api';
import { COLORS } from './ui';

export default function LoginScreen({ onLogin }: { onLogin: (s: Session) => void }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (step === 'phone') {
      if (!/^08\d{8,12}$/.test(phone.trim())) {
        setError('Nomor HP harus format 08xxxxxxxxxx');
        return;
      }
      setStep('otp'); // Demo: OTP mock — produksi mengirim OTP WhatsApp/SMS sungguhan.
      return;
    }
    setBusy(true);
    try {
      const res = await api<Session & { userId: string }>('/employee/login', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim() }),
      });
      const session = { userId: res.userId, name: res.name, employerName: res.employerName };
      await saveSession(session);
      onLogin(session);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={[COLORS.indigo, COLORS.violet]} style={s.wrap}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.inner}>
        <View style={s.logoRow}>
          <View style={s.logoBox}>
            <Text style={s.logoG}>G</Text>
          </View>
          <Text style={s.logoText}>
            Gaji<Text style={{ color: '#c7d2fe' }}>Kini</Text>
          </Text>
        </View>
        <Text style={s.tagline}>Gajian kapan pun, tanpa menunggu tanggal tua.</Text>

        <View style={s.card}>
          {step === 'phone' ? (
            <>
              <Text style={s.label}>Nomor HP terdaftar</Text>
              <TextInput
                style={s.input}
                keyboardType="phone-pad"
                placeholder="08xxxxxxxxxx"
                placeholderTextColor={COLORS.slate400}
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
            </>
          ) : (
            <>
              <Text style={s.label}>Kode OTP (demo: 6 digit bebas)</Text>
              <TextInput
                style={[s.input, { letterSpacing: 8, textAlign: 'center' }]}
                keyboardType="number-pad"
                placeholder="••••••"
                placeholderTextColor={COLORS.slate400}
                value={otp}
                onChangeText={setOtp}
                maxLength={6}
                autoFocus
              />
              <TouchableOpacity onPress={() => setStep('phone')}>
                <Text style={s.back}>← Ganti nomor</Text>
              </TouchableOpacity>
            </>
          )}

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity style={s.btn} onPress={submit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>{step === 'phone' ? 'Lanjut' : 'Masuk'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={s.foot}>Akun dibuat oleh HR perusahaan Anda · tanpa bunga · tanpa denda</Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoG: { color: '#fff', fontSize: 20, fontWeight: '800' },
  logoText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  tagline: { color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 8, marginBottom: 28, fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 22 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.slate500, marginBottom: 8 },
  input: {
    borderWidth: 2,
    borderColor: COLORS.slate200,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.ink,
  },
  back: { color: COLORS.indigo, fontSize: 12, fontWeight: '700', marginTop: 10 },
  error: { color: COLORS.rose, fontSize: 12, fontWeight: '600', marginTop: 10 },
  btn: {
    backgroundColor: COLORS.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  foot: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: 11, marginTop: 20 },
});
