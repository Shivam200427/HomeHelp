import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { Screen, ScreenHeader, Card, Button, StatusBadge, EmptyState, TextField } from 'homehelp-mobile-ui';

type Job = { id: string; status: string; serviceType?: string; customerAddress?: string; notes?: string };
type ActionMode = 'start' | 'complete' | null;

export default function JobsScreen() {
  const { worker } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [actionModal, setActionModal] = useState<ActionMode>(null);
  const [otpInput, setOtpInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchJobs = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api.getMyJobs();
      const list = (Array.isArray(data) ? data : (data as any).bookings || []) as Job[];
      const active = list.filter((job) => job.status === 'assigned' || job.status === 'in_progress');
      setJobs(active);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  function handleStart(job: Job) {
    setSelectedJob(job);
    setOtpInput('');
    setActionModal('start');
  }

  function handleComplete(job: Job) {
    setSelectedJob(job);
    setOtpInput('');
    setActionModal('complete');
  }

  function clearModal() {
    setSelectedJob(null);
    setOtpInput('');
    setActionModal(null);
  }

  async function confirmAction() {
    if (!selectedJob || !otpInput.trim()) return;
    setSubmitting(true);
    try {
      if (actionModal === 'start') {
        await api.startJob(selectedJob.id, otpInput);
        Alert.alert('Success', 'Job started successfully');
      } else if (actionModal === 'complete') {
        await api.completeJob(selectedJob.id, otpInput, 5);
        Alert.alert('Success', 'Job completed successfully');
      }
      clearModal();
      fetchJobs();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="My Jobs" subtitle="Track and manage your assigned jobs" />
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="My Jobs" subtitle="Track and manage your assigned jobs" />

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchJobs} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <Card style={styles.jobCard}>
            <View style={styles.jobHeader}>
              <View style={styles.jobInfo}>
                <Text style={styles.jobTitle}>{item.serviceType || 'Home Help'}</Text>
              </View>
              <StatusBadge status={item.status} />
            </View>

            {item.customerAddress ? (
              <Text style={styles.jobDetail}>{item.customerAddress}</Text>
            ) : null}
            {item.notes ? (
              <Text style={styles.jobNotes}>{item.notes}</Text>
            ) : null}

            {item.status === 'assigned' ? (
              <View style={styles.jobActions}>
                <Button title="Start Job" onPress={() => handleStart(item)} />
              </View>
            ) : null}

            {item.status === 'in_progress' ? (
              <View style={styles.jobActions}>
                <Button title="Complete Job" variant="secondary" onPress={() => handleComplete(item)} />
              </View>
            ) : null}
          </Card>
        )}
        ListEmptyComponent={<EmptyState icon="\u{1F4CB}" title="No jobs" message="You have no active jobs at the moment" />}
      />

      {selectedJob && actionModal ? (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {actionModal === 'start' ? 'Enter Start OTP' : 'Enter End OTP'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {actionModal === 'start'
                ? 'Ask the customer for the start code'
                : 'Ask the customer for the completion code'}
            </Text>
            <TextField
              label="OTP"
              placeholder="6-digit code"
              value={otpInput}
              onChangeText={setOtpInput}
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="ghost" onPress={clearModal} />
              <Button
                title={actionModal === 'start' ? 'Start' : 'Complete'}
                onPress={confirmAction}
                loading={submitting}
              />
            </View>
            <Text style={styles.workerHint}>Signed in as {worker?.name ?? 'partner'}</Text>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { fontSize: 16, color: colors.textMuted, textAlign: 'center' },
  jobCard: { marginBottom: spacing.md },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  jobDetail: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  jobNotes: { fontSize: 14, fontStyle: 'italic', color: colors.textMuted, marginTop: 4 },
  jobActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modalBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center', alignItems: 'center', padding: spacing.lg,
  },
  modalCard: {
    width: '100%', backgroundColor: colors.surface, borderRadius: 16,
    padding: spacing.lg, gap: spacing.sm,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  workerHint: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
});
