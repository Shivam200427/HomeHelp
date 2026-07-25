import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { Screen, ScreenHeader, Card, StatusBadge, LoadingView, EmptyState } from 'homehelp-mobile-ui';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function BookingItem({ item, onPress }: { item: any; onPress: (id: string) => void }) {
  return (
    <TouchableOpacity onPress={() => onPress(item.id)} activeOpacity={0.8}>
      <Card style={[styles.bookingCard, { backgroundColor: colors.surface }]}>
        <View style={styles.bookingHeader}>
          <Text style={[styles.serviceType, { color: colors.text }]}>{item.serviceType}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={[styles.modeText, { color: colors.textMuted }]}>{item.mode === 'home_help' ? 'Home Help' : 'Driver'}</Text>
        <View style={styles.bookingDetails}>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Booked</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(item.createdAt)}</Text>
          </View>
          {item.durationHours ? (
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Duration</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{item.durationHours}h</Text>
            </View>
          ) : null}
          <View style={styles.amountContainer}>
            <Text style={[styles.amountLabel, { color: colors.textMuted }]}>Amount</Text>
            <Text style={[styles.amountText, { color: colors.secondary }]}>₹{item.totalAmount ?? '0'}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function BookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const data = await api.getBookings();
      setBookings(Array.isArray(data) ? data : data.bookings || []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  function handleRefresh() { setRefreshing(true); fetchBookings(); }

  function handlePress(id: string) { router.push(`/booking/${id}`); }

  if (loading) {
    return (
      <Screen>
        <LoadingView message="Loading your bookings…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="My Bookings" subtitle="Track your service requests" />
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BookingItem item={item} onPress={handlePress} />}
        contentContainerStyle={bookings.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.secondary} />}
        ListEmptyComponent={<EmptyState icon="📋" title="No bookings yet" message="Your upcoming service bookings will appear here." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.md, paddingTop: 0, paddingBottom: spacing.xxl },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: spacing.md },
  bookingCard: { marginBottom: spacing.md },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  serviceType: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  modeText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  bookingDetails: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.divider },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase' },
  detailValue: { fontSize: 13, color: colors.text, fontWeight: '500' },
  amountContainer: { alignItems: 'flex-end' },
  amountLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase' },
  amountText: { fontSize: 14, fontWeight: '700', color: colors.secondary },
});