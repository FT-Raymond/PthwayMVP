// lib/types/cancellation.ts
 
export type CancellationPolicyLabel =
  | 'flexible'
  | 'moderate'
  | 'strict'
  | 'custom';
 
export interface CancellationPolicy {
  label: CancellationPolicyLabel;
  windowHours: number;   // Hours before appointment where fee kicks in
  feePercent: number;    // 0–100
}
 
export const PRESET_POLICIES: Record<
  Exclude<CancellationPolicyLabel, 'custom'>,
  CancellationPolicy
> = {
  flexible: {
    label: 'flexible',
    windowHours: 0,
    feePercent: 0,
  },
  moderate: {
    label: 'moderate',
    windowHours: 24,
    feePercent: 50,
  },
  strict: {
    label: 'strict',
    windowHours: 48,
    feePercent: 100,
  },
};
 
export interface CancellationResult {
  isWithinWindow: boolean;
  feePercent: number;
  feeAmountPence: number;
  refundAmountPence: number;
  hoursUntilAppointment: number;
}
 
/**
 * Calculate cancellation outcome given a policy and appointment time.
 * @param policy        The listing's cancellation policy
 * @param appointmentAt ISO timestamp of the appointment
 * @param totalPence    Full booking amount in pence
 */
export function calculateCancellation(
  policy: CancellationPolicy,
  appointmentAt: string,
  totalPence: number
): CancellationResult {
  const now = Date.now();
  const apptMs = new Date(appointmentAt).getTime();
  const hoursUntilAppointment = (apptMs - now) / (1000 * 60 * 60);
 
  const isWithinWindow =
    policy.windowHours > 0 &&
    hoursUntilAppointment >= 0 &&
    hoursUntilAppointment < policy.windowHours;
 
  const feePercent = isWithinWindow ? policy.feePercent : 0;
  const feeAmountPence = Math.round((totalPence * feePercent) / 100);
  const refundAmountPence = totalPence - feeAmountPence;
 
  return {
    isWithinWindow,
    feePercent,
    feeAmountPence,
    refundAmountPence,
    hoursUntilAppointment,
  };
}
 
/**
 * Human-readable summary of a cancellation policy.
 */
export function describeCancellationPolicy(policy: CancellationPolicy): string {
  if (policy.feePercent === 0) return 'Free cancellation any time';
  if (policy.windowHours === 0) return 'Non-refundable';
  return `${policy.feePercent}% fee if cancelled within ${policy.windowHours} hours`;
}