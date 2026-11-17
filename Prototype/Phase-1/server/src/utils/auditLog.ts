/**
 * Saves an action (grant, revoke, view) to the audit_log table.
 */
import pool from '../config/db';

// userId: who did it, action: short code, details: text shown in the activity log
export async function logAction(userId: number, action: string, profileId: number, details: string) {
  await pool.query('INSERT INTO audit_log (user_id, action, profile_id, details) VALUES ($1, $2, $3, $4)', [
    userId,
    action,
    profileId,
    details,
  ]);
}
