import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api, clearSession, Session } from '../lib/api';
import { feeBreakdown, formatIDR as fmt, MIN_WITHDRAWAL } from '../lib/calc';
import { Badge, COLORS, ProgressBar } from './ui';

interface Summary {
  employee: { name: string; baseSalary: number; bankName: string; bankAccount: string; kycStatus: string };
  employer: { name: string; feeRateBps: number };
  cycle: { payday: string; totalWorkdays: number; workdaysElapsed: number };
  accrued: number;
  limit: number;
  hasPending: boolean;
  withdrawals: Array<{
    id: string;
    amount: number;
    received: number;
    status: string;
    rejectReason?: string;
    createdAt: string;
  }>;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function HomeScreen({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<Summary>('/employee/summary');
      setData(d);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function submit() {
    const n = Number(amount);
    setBusy(true);
    try {
      await api('/employee/withdrawals', { method: 'POST', body: JSON.stringify({ amount: n }) });
      setSheetOpen(false);
      setAmount('');
      Alert.alert('Terkirim ✓', 'Request penarikan menunggu persetujuan HR.');
      load();
    } catch (e) {
      Alert.alert('Gagal', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await clearSession();
    onLogout();
  }

  const n = Number(amount) || 0;
  const fees = data && n >= MIN_WITHDRAWAL ? feeBreakdown(n, data.employer.feeRateBps) : null;
  const accrualPct = data ? data.cycle.workdaysElapsed / data.cycle.totalWorkdays : 0;
  const canWithdraw = data && !data.hasPending && data.limit >= MIN_WITHDRAWAL;

  return (
    <View style={s.wrap}>
      {/* Header */}
      <LinearGradient colors={[COLORS.indigo, COLORS.violet]} style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.hello}>Selamat datang kembali</Text>
            <Text style={s.name}>{session.name}</Text>
            <Text style={s.employer}>{session.employerName}</Text>
          </View>
          <TouchableOpacity style={s.logoutBtn} onPress={logout}>
            <Text style={s.logoutText}>Keluar</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Kartu limit */}
      <View style={s.limitCard}>
        <Text style={s.limitLabel}>LIMIT TERSEDIA</Text>
        <Text style={s.limitValue}>{data ? fmt(data.limit) : '…'}</Text>
        {data && (
          <>
            <ProgressBar value={accrualPct} />
            <Text style={s.limitSub}>
              Upah terakru {fmt(data.accrued)} · {data.cycle.workdaysElapsed}/{data.cycle.totalWorkdays} hari kerja
            </Text>
            <View style={s.limitFootRow}>
              <Text style={s.limitFoot}>Gajian {fmtDate(data.cycle.payday)}</Text>
              <Text style={s.limitFoot}>
                {data.employee.bankName} ···{data.employee.bankAccount.slice(-4)}
              </Text>
            </View>
          </>
        )}
        <TouchableOpacity
          style={[s.cta, !canWithdraw && s.ctaDisabled]}
          disabled={!canWithdraw}
          onPress={() => setSheetOpen(true)}
        >
          <Text style={s.ctaText}>{data?.hasPending ? 'Request sedang diproses…' : 'Tarik Gaji Sekarang'}</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {/* Riwayat */}
      <Text style={s.sectionTitle}>Riwayat Transaksi</Text>
      <FlatList
        data={data?.withdrawals ?? []}
        keyExtractor={(w) => w.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
        ListEmptyComponent={
          data ? <Text style={s.empty}>Belum ada transaksi.</Text> : <ActivityIndicator style={{ marginTop: 20 }} />
        }
        renderItem={({ item: w }) => (
          <View style={s.txCard}>
            <View style={s.txRow}>
              <Text style={s.txAmount}>{fmt(w.amount)}</Text>
              <Badge status={w.status} />
            </View>
            <View style={s.txRow}>
              <Text style={s.txSub}>Diterima {fmt(w.received)}</Text>
              <Text style={s.txSub}>{fmtDate(w.createdAt)}</Text>
            </View>
            {w.rejectReason ? <Text style={s.txReason}>Alasan: {w.rejectReason}</Text> : null}
          </View>
        )}
      />

      {/* Bottom sheet penarikan */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetWrap}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setSheetOpen(false)} />
          <View style={s.sheet}>
            <View style={s.grip} />
            <Text style={s.sheetTitle}>Tarik Gaji</Text>
            <Text style={s.sheetSub}>Limit tersedia {data ? fmt(data.limit) : ''}</Text>

            <TextInput
              style={s.amountInput}
              keyboardType="number-pad"
              placeholder={`Min. ${MIN_WITHDRAWAL.toLocaleString('id-ID')}`}
              placeholderTextColor={COLORS.slate400}
              value={amount}
              onChangeText={setAmount}
            />
            <View style={s.chipRow}>
              {[200000, 500000].map((v) => (
                <TouchableOpacity key={v} style={s.chip} onPress={() => setAmount(String(Math.min(v, data?.limit ?? v)))}>
                  <Text style={s.chipText}>{fmt(v)}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[s.chip, s.chipMax]} onPress={() => setAmount(String(data?.limit ?? 0))}>
                <Text style={[s.chipText, { color: COLORS.indigo }]}>Maks</Text>
              </TouchableOpacity>
            </View>

            <View style={s.feeBox}>
              <FeeRow label="Nominal penarikan" value={n ? fmt(n) : '—'} />
              <FeeRow
                label={`Platform fee (${data ? (data.employer.feeRateBps / 100).toFixed(2) : ''}%)`}
                value={fees ? `− ${fmt(fees.platformFee)}` : '—'}
              />
              <FeeRow label="Biaya transfer" value={fees ? `− ${fmt(fees.transferFee)}` : '—'} />
              <View style={s.feeDivider} />
              <FeeRow label="Kamu terima" value={fees ? fmt(fees.received) : '—'} bold />
              <Text style={s.feeNote}>Tanpa bunga & tanpa denda. Dipotong otomatis dari gaji saat payday.</Text>
            </View>

            <TouchableOpacity
              style={[s.cta, (busy || !fees || n > (data?.limit ?? 0)) && s.ctaDisabled]}
              disabled={busy || !fees || n > (data?.limit ?? 0)}
              onPress={submit}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Konfirmasi & Kirim Request</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FeeRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={s.feeRow}>
      <Text style={[s.feeLabel, bold && { fontWeight: '800', color: COLORS.ink }]}>{label}</Text>
      <Text style={[s.feeValue, bold && { fontWeight: '800', color: COLORS.indigo }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingTop: 60, paddingBottom: 56, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hello: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  name: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  employer: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  logoutText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  limitCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: -36,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#1e1b4b',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  limitLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: COLORS.slate400 },
  limitValue: { fontSize: 32, fontWeight: '800', color: COLORS.indigo, marginVertical: 6 },
  limitSub: { fontSize: 11, color: COLORS.slate500, marginTop: 8 },
  limitFootRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  limitFoot: { fontSize: 11, color: COLORS.slate400 },
  cta: { backgroundColor: COLORS.indigo, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  ctaDisabled: { backgroundColor: COLORS.slate200 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  error: { color: COLORS.rose, fontSize: 12, marginHorizontal: 20, marginTop: 10, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.ink, margin: 20, marginBottom: 10 },
  empty: { textAlign: 'center', color: COLORS.slate400, fontSize: 12, marginTop: 16 },
  txCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.slate100 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
  txSub: { fontSize: 11, color: COLORS.slate400, marginTop: 4 },
  txReason: { fontSize: 11, color: COLORS.rose, marginTop: 6, fontWeight: '600' },
  sheetWrap: { flex: 1, backgroundColor: 'rgba(2,6,23,0.5)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22 },
  grip: { width: 40, height: 4, borderRadius: 999, backgroundColor: COLORS.slate200, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  sheetSub: { fontSize: 12, color: COLORS.slate400, marginTop: 2, marginBottom: 12 },
  amountInput: {
    borderWidth: 2,
    borderColor: COLORS.slate200,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: { flex: 1, backgroundColor: COLORS.slate100, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  chipMax: { backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  chipText: { fontSize: 12, fontWeight: '800', color: COLORS.slate500 },
  feeBox: { backgroundColor: COLORS.bg, borderRadius: 16, padding: 14, marginTop: 14 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  feeLabel: { fontSize: 12, color: COLORS.slate500 },
  feeValue: { fontSize: 12, fontWeight: '700', color: COLORS.ink },
  feeDivider: { height: 1, backgroundColor: COLORS.slate200, marginVertical: 6 },
  feeNote: { fontSize: 10, color: COLORS.slate400, marginTop: 8, lineHeight: 14 },
});
