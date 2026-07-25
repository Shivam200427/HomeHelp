import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal } from 'react-native';
import { colors, spacing } from '../src/constants/theme';
import { api } from '../src/api/client';
import { useAuth } from '../src/context/AuthContext';
import { locationService } from '../src/lib/location';
import { Screen, ScreenHeader, Card, Button, StatusBadge, LoadingView, EmptyState } from 'homehelp-mobile-ui';

interface Booking {
  id: string;
  serviceType: string;
  status: string;
  customerAddress?: string;
  customerLat?: number;
  customerLng?: number;
  durationHours?: number;
  totalAmount?: number;
  user?: { name?: string; phoneNumber?: string };
}

type ActionType = 'start' | 'complete' | null;

export default function ActiveJobScreen() {
  const { worker, token } = useAuth();
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionModal, setActionModal] = useState<ActionType>(null);
  const [selectedJob, setSelectedJob] = useState<Booking | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadActiveJobs();

    if (worker && token) {
      locationService.init(worker.id, token);
    }

    return () => {
      locationService.stopTracking();
      locationService.disconnect();
    };
  }, [worker, token]);

  async function loadActiveJobs() {
    try {
      const data = await api.getMyJobs();
      const all = Array.isArray(data) ? data : (data as any).bookings || [];
      const active = all.filter((b: Booking) => b.status === 'assigned' || b.status === 'in_progress');
      setJobs(active);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openActionModal(job: Booking, type: ActionType) {
    setSelectedJob(job);
    setActionModal(type);
    setOtpInput('');
    setRating(5);
  }

  async function handleAction() {
    if (!selectedJob || !actionModal) return;
    if (!otpInput.trim()) {
      Alert.alert('OTP Required', 'Please enter the OTP to proceed.');
      return;
    }
    setSubmitting(true);
    try {
      if (actionModal === 'start') {
        await api.startJob(selectedJob.id, otpInput);
        Alert.alert('Started', 'Job has been started!');

        if (worker && token) {
          await locationService.startTracking(selectedJob.id, worker.id);
        }
      } else if (actionModal === 'complete') {
        await api.completeJob(selectedJob.id, otpInput, rating);
        Alert.alert('Completed', 'Job has been marked complete!');
        locationService.stopTracking();
      }
      setActionModal(null);
      setSelectedJob(null);
      loadActiveJobs();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadActiveJobs();
  }

  function renderJob(job: Booking) {
    return (
      <Card key={job.id} style={styles.card}>
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

        <View style={styles.detailsRow}>
          {job.durationHours ? (
            <Text style={styles.detail}>{'\u23F1'} {job.durationHours}h</Text>
          ) : null}
          {job.totalAmount ? (
            <Text style={styles.detail}>{'\u{1F4B0}'} {'\u20B9'}{job.totalAmount}</Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          {job.status === 'assigned' ? (
            <Button title="Start Job" onPress={() => openActionModal(job, 'start')} />
          ) : null}
          {job.status === 'in_progress' ? (
            <Button title="Complete Job" onPress={() => openActionModal(job, 'complete')} />
          ) : null}
        </View>

        <TouchableOpacity style={styles.emergencyBtn}>
          <Text style={styles.emergencyText}>{'\u{1F6A8}'} Emergency Contact</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  if (loading) {
    return (
      <Screen>
        <LoadingView message="Loading your active jobs..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Active Jobs" subtitle="Track and complete your shifts" />
      <ScrollView
        contentContainerStyle={jobs.length === 0 ? styles.emptyContainer : styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {jobs.length === 0 ? (
          <EmptyState icon="\u{1F50D}" title="No active jobs" message="Accept a job from the Jobs tab to get started" />
        ) : (
          jobs.map(renderJob)
        )}
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
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  serviceType: { fontSize: 18, fontWeight: '600', flex: 1, color: colors.text },
  customerName: { fontSize: 14, marginBottom: 2, color: colors.text },
  address: { fontSize: 14, marginBottom: spacing.sm, color: colors.textMuted },
  detailsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  detail: {
    fontSize: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  actions: { marginTop: 4 },
  emergencyBtn: { marginTop: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center' },
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
