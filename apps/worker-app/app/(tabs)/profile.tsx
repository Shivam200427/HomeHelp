import { View, Text, Alert, StyleSheet } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing } from '../../src/constants/theme';
import { ScreenScroll, ScreenHeader, Card, Button } from 'homehelp-mobile-ui';

export default function ProfileScreen() {
  const { worker, logout } = useAuth();

  if (!worker) return null;

  function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  }

  function renderStars(rating: number) {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Text key={star} style={[styles.star, star <= Math.round(rating) && styles.starActive]}>
            ★
          </Text>
        ))}
        <Text style={styles.ratingText}>({rating.toFixed(1)})</Text>
      </View>
    );
  }

  function getWorkerTypeLabel(type: string) {
    switch (type) {
      case 'home_help':
        return 'Home Help';
      case 'driver':
        return 'Driver';
      case 'both':
        return 'Home Help & Driver';
      default:
        return type;
    }
  }

  const initial = (worker.name || 'W').charAt(0).toUpperCase();

  return (
    <ScreenScroll>
      <ScreenHeader title="Profile" subtitle="Your partner account" />

      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.userName}>{worker.name || 'Worker'}</Text>
        <Text style={styles.userSubtext}>{worker.phoneNumber || 'No phone linked'}</Text>
        <View style={styles.typeChip}>
          <Text style={styles.typeChipText}>{getWorkerTypeLabel(worker.workerType)}</Text>
        </View>
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Rating</Text>
        {renderStars(worker.averageRating)}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Verification Status</Text>

        <View style={styles.verifRow}>
          <Text style={styles.verifLabel}>Aadhaar</Text>
          <View
            style={[
              styles.verifBadge,
              {
                backgroundColor: (worker.aadhaarVerified ? colors.success : colors.warning) + '1A',
                borderColor: (worker.aadhaarVerified ? colors.success : colors.warning) + '40',
              },
            ]}
          >
            <Text style={[styles.verifBadgeText, { color: worker.aadhaarVerified ? colors.success : colors.warning }]}>
              {worker.aadhaarVerified ? 'Verified' : 'Pending'}
            </Text>
          </View>
        </View>

        <View style={[styles.verifRow, { marginTop: spacing.sm }]}>
          <Text style={styles.verifLabel}>License</Text>
          <View
            style={[
              styles.verifBadge,
              {
                backgroundColor: (worker.licenseVerified ? colors.success : colors.warning) + '1A',
                borderColor: (worker.licenseVerified ? colors.success : colors.warning) + '40',
              },
            ]}
          >
            <Text style={[styles.verifBadgeText, { color: worker.licenseVerified ? colors.success : colors.warning }]}>
              {worker.licenseVerified ? 'Verified' : 'Pending'}
            </Text>
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Stats</Text>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{worker.totalJobs}</Text>
          <Text style={styles.statLabel}>Total Jobs Completed</Text>
        </View>
        <View style={[styles.statItem, { marginTop: spacing.md }]}>
          <Text style={[styles.statValue, { color: worker.isActive ? colors.success : colors.error }]}>
            {worker.isActive ? 'Active' : 'Inactive'}
          </Text>
          <Text style={styles.statLabel}>Account Status</Text>
        </View>
      </Card>

      <Button title="Sign Out" variant="secondary" onPress={handleLogout} style={styles.logout} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.primary,
  },
  avatarText: { fontSize: 34, fontWeight: '700', color: colors.white },
  userName: { fontSize: 24, fontWeight: '700', color: colors.text },
  userSubtext: { fontSize: 16, marginTop: 4, color: colors.textMuted },
  typeChip: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  card: { marginBottom: spacing.md },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing.md, color: colors.text },
  starsRow: { flexDirection: 'row', alignItems: 'center' },
  star: { fontSize: 24, marginRight: 2, color: colors.textMuted },
  starActive: { color: colors.warning },
  ratingText: { fontSize: 14, marginLeft: spacing.sm, color: colors.textMuted },
  verifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verifLabel: { fontSize: 14, color: colors.text },
  verifBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  verifBadgeText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 14, marginTop: 2, color: colors.textMuted },
  logout: { marginTop: spacing.md },
});
