import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { colors, spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { Screen, ScreenHeader, Card, LoadingView, EmptyState } from 'homehelp-mobile-ui';

interface Payout {
  id: string;
  amount: number;
  status: 'processed' | 'pending' | 'failed';
  weekStart: string;
  weekEnd: string;
  paidAt?: string;
  createdAt: string;
}

export default function EarningsScreen() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEarnings();
  }, []);

  async function loadEarnings() {
    try {
      const data = await api.getEarnings();
      setPayouts(Array.isArray(data) ? (data as Payout[]) : (data as any).payouts || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadEarnings();
  }

  const totalEarned = payouts.reduce(
    (sum, p) => (p.status === 'processed' ? sum + p.amount : sum),
    0
  );

  const thisWeek = payouts
    .filter((p) => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      return new Date(p.createdAt) >= startOfWeek;
    })
    .reduce((sum, p) => (p.status === 'processed' ? sum + p.amount : sum), 0);

  function renderPayout({ item }: { item: Payout }) {
    const statusColor =
      item.status === 'processed'
        ? colors.statusCompleted
        : item.status === 'failed'
        ? colors.error
        : colors.warning;
    const statusLabel =
      item.status === 'processed' ? 'Paid' : item.status === 'failed' ? 'Failed' : 'Pending';
    const startDate = new Date(item.weekStart).toLocaleDateString();
    const endDate = new Date(item.weekEnd).toLocaleDateString();

    return (
      <Card style={styles.payoutCard}>
        <View style={styles.payoutTop}>
          <Text style={styles.weekRange}>{startDate} \u2013 {endDate}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A', borderColor: statusColor + '40' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={styles.amount}>{'\u20B9'}{item.amount}</Text>
        {item.paidAt ? (
          <Text style={styles.paidDate}>Paid on {new Date(item.paidAt).toLocaleDateString()}</Text>
        ) : null}
      </Card>
    );
  }

  if (loading) {
    return (
      <Screen>
        <LoadingView message="Loading your earnings..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Earnings" subtitle="Track your weekly payouts" />

      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>This Week</Text>
            <Text style={styles.summaryValue}>{'\u20B9'}{thisWeek}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Earned</Text>
            <Text style={styles.summaryValue}>{'\u20B9'}{totalEarned}</Text>
          </View>
        </View>
      </Card>

      <FlatList
        data={payouts}
        keyExtractor={(item) => item.id}
        renderItem={renderPayout}
        contentContainerStyle={payouts.length === 0 ? styles.emptyContainer : styles.list}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Payout History</Text>}
        ListEmptyComponent={
          <EmptyState icon="\u{1F4B0}" title="No earnings yet" message="Complete jobs to see your earnings here" />
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  summaryCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 16,
    padding: spacing.lg,
    backgroundColor: colors.primary,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 40, marginHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.25)' },
  summaryLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' },
  summaryValue: { fontSize: 24, fontWeight: '700', color: colors.white },
  sectionTitle: { fontSize: 14, fontWeight: '600', letterSpacing: 0.5, marginBottom: spacing.sm, marginHorizontal: spacing.md, textTransform: 'uppercase', color: colors.text },
  payoutCard: { marginBottom: 10 },
  payoutTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  weekRange: { fontSize: 13, fontWeight: '500', flex: 1, color: colors.text },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  amount: { fontSize: 22, fontWeight: '700', marginBottom: 4, color: colors.text },
  paidDate: { fontSize: 11, color: colors.textMuted },
});
