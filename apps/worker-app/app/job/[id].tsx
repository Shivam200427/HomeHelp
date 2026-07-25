import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { colors, spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { locationService } from '../../src/lib/location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, ScreenHeader, Card, Button, StatusBadge, LoadingView } from 'homehelp-mobile-ui';

interface Booking {
  id: string;
  serviceType: string;
  status: string;
  customerAddress?: string;
  mode: 'home_help' | 'driver';
  durationHours?: number;
  totalAmount?: number;
  user?: { name?: string; phoneNumber?: string };
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

type ActionType = 'start' | 'complete' | null;

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { worker, token } = useAuth();
  const [job, setJob] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<ActionType>(null);
  const [otpInput, setOtpInput] = useState('');
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) fetchJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (worker && token && job?.status === 'in_progress') {
      locationService.init(worker.id, token);
      locationService.startTracking(job.id, worker.id);
    }
    return () => {
      locationService.stopTracking();
      locationService.disconnect();
    };
  }, [worker, token, job?.status, job?.id]);

  async function fetchJob() {
    setLoading(true);
    try {
      const data = await api.getJob(id);
      setJob(data.booking ?? data);
    } catch {
      Alert.alert('Error', 'Failed to load job details');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  function openActionModal(type: ActionType) {
    setActionModal(type);
    setOtpInput('');
    setRating(5);
  }

  async function handleAction() {
    if (!job || !actionModal) return;
    if (!otpInput.trim()) {
      Alert.alert('OTP Required', 'Please enter the OTP to proceed.');
      return;
    }
    setSubmitting(true);
    try {
      if (actionModal === 'start') {
        await api.startJob(job.id, otpInput);
        Alert.alert('Started', 'Job has been started!');
        if (worker && token) {
          await locationService.startTracking(job.id, worker.id);
        }
      } else if (actionModal === 'complete') {
        await api.completeJob(job.id, otpInput, rating);
        Alert.alert('Completed', 'Job has been marked complete!');
        locationService.stopTracking();
      }
      setActionModal(null);
      fetchJob();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingView message="Loading job details..." />
      </Screen>
    );
  }

  if (!job) return null;

  return (
    <Screen>
      <ScreenHeader title="Job Details" subtitle={job.serviceType} />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.serviceType}>{job.serviceType}</Text>
            <StatusBadge status={job.status} />
          </View>

          {job.user ? (
            <Text style={styles.customerName}>{'\u{1F464}'} {job.user.name || job.user.phoneNumber}</Text>
          ) : null}
          {job.customerAddress ? (
            <Text style={styles.address}>{'\u{1F4CD}'} {job.customerAddress}</Text>
          ) : null}

          <View style={styles.detailsSection}>
            <Text style={styles.detailLabel}>Booking ID</Text>
            <Text style={styles.detailValue}>{job.id.slice(0, 8)}</Text>
          </View>
          <View style={styles.detailsSection}>
            <Text style={styles.detailLabel}>Mode</Text>
            <Text style={styles.detailValue}>{job.mode === 'home_help' ? 'Home Help' : 'Driver'}</Text>
          </View>
          {job.durationHours ? (
            <View style={styles.detailsSection}>
              <Text style={styles.detailLabel}>Duration</Text>
              <Text style={styles.detailValue}>{job.durationHours}h</Text>
            </View>
          ) : null}
          {job.totalAmount ? (
            <View style={styles.detailsSection}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.detailValue}>{'\u20B9'}{job.totalAmount}</Text>
            </View>
          ) : null}
        </Card>

        {job.status === 'assigned' || job.status === 'in_progress' ? (
          <View style={styles.actions}>
            {job.status === 'assigned' ? (
              <Button title="Start Job" onPress={() => openActionModal('start')} />
            ) : null}
            {job.status === 'in_progress' ? (
              <Button title="Complete Job" onPress={() => openActionModal('complete')} />
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity style={styles.emergencyBtn}>
          <Text style={styles.emergencyText}>{'\u{1F6A8}'} Emergency Contact</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={actionModal !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {actionModal === 'start' ? 'Start Job' : 'Complete Job'}
            </Text>
            <Text style={styles.modalSub}>
              {actionModal === 'start'
                ? 'Enter the start OTP provided by the customer'
                : 'Enter the end OTP provided by the customer'}
            </Text>

            <TextInput
              style={styles.otpInput}
              placeholder="Enter OTP"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={otpInput}
              onChangeText={setOtpInput}
            />

            {actionModal === 'complete' ? (
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Rating:</Text>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)}>
                    <Text style={[styles.star, star <= rating && styles.starActive]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActionModal(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, submitting && { opacity: 0.7 }]}
                onPress={handleAction}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.confirmText}>
                    {actionModal === 'start' ? 'Start' : 'Complete'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  serviceType: { fontSize: 18, fontWeight: '600', flex: 1, color: colors.text },
  customerName: { fontSize: 14, marginBottom: 2, color: colors.text },
  address: { fontSize: 14, marginBottom: spacing.md, color: colors.textMuted },
  detailsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  detailLabel: { fontSize: 14, color: colors.textMuted },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  actions: { marginBottom: spacing.md },
  emergencyBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
  emergencyText: { fontSize: 14, fontWeight: '600', color: colors.error },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.overlay },
  modalContent: { borderRadius: 16, padding: spacing.lg, backgroundColor: colors.surface },
  modalTitle: { fontSize: 22, fontWeight: '600', marginBottom: 4, color: colors.text },
  modalSub: { fontSize: 14, marginBottom: spacing.lg, color: colors.textMuted },
  otpInput: {
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: 4 },
  ratingLabel: { fontSize: 16, fontWeight: '600', marginRight: spacing.sm, color: colors.text },
  star: { fontSize: 28, color: colors.textMuted },
  starActive: { color: colors.warning },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelText: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  confirmText: { fontSize: 16, fontWeight: '600', color: colors.white },
});
