import { api } from '@/api/client';

export const AUDIT_ACTIONS = {
    LOGIN: 'Login',
    FOUND_REGISTERED: 'Found document registration',
    LOST_SUBMITTED: 'Lost report submission',
    MATCH_CONFIRMED: 'Match confirmation',
    MATCH_REJECTED: 'Match rejection',
    NOTIFICATION_SENT: 'Notification sent',
    OTP_GENERATED: 'OTP generation',
    OTP_FAILED: 'Collection code rejected',
    HANDOVER_COMPLETED: 'Document handover',
    ADMIN_CHANGE: 'Administrative change',
    DOCUMENT_STATUS_CHANGE: 'Document status change',
    CLAIM_SUBMITTED: 'Ownership claim submitted',
    CLAIM_APPROVED: 'Ownership claim approved',
    CLAIM_REJECTED: 'Ownership claim rejected',
    OWNER_SEARCH: 'Owner search',
    SEARCH_LIMIT: 'Search rate limit reached',
    RECORD_OPENED: 'Record opened',
    IMAGE_VIEWED: 'Photograph viewed',
    DUPLICATE_FLAGGED: 'Duplicate flagged',
    RAPID_UPLOADS: 'Rapid uploads flagged',
    PICKUP_POINT_CHANGE: 'Pickup point change',
    USER_CHANGE: 'User account change',
    DATA_EXPORT: 'Data export',
    BACKUP: 'Backup',
    RETENTION: 'Retention run',
    PHONE_VERIFIED: 'Phone number verified',
    DATA_REQUEST: 'Data protection request',
};

/**
 * Records every important action for the audit trail.
 * Logging never blocks the action the user is performing.
 */
export async function logAction({ action, details, user }) {
    try {
        await api.entities.AuditLog.create({
            user_id: user ? user.id : null,
            action,
            details: details || '',
        });
    } catch (error) {
        console.error('Audit log could not be written', error);
    }
}
