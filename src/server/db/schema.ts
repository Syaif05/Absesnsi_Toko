import { sql } from 'drizzle-orm';
import { pgSchema, uuid, text, timestamp, boolean, integer, doublePrecision, jsonb, unique, index, check } from 'drizzle-orm/pg-core';
// Not exposed through Supabase Data API. Access is server-side only.
export const app = pgSchema('attendance');
const id = () => uuid('id').defaultRandom().primaryKey();
const at = (name: string) => timestamp(name, { withTimezone: true });
const created = () => at('created_at').defaultNow().notNull();
export const businesses = app.table('businesses', {
 id:id(), name:text('name').notNull(), logoPath:text('logo_path'), timezone:text('timezone').default('Asia/Jakarta').notNull(), isActive:boolean('is_active').default(true).notNull(), isDemo:boolean('is_demo').default(false).notNull(), createdAt:created(),
});
export const stores = app.table('stores', {
 id:id(), businessId:uuid('business_id').notNull().references(()=>businesses.id), code:text('code').notNull(), name:text('name').notNull(), address:text('address').notNull(), operatingHours:text('operating_hours').default('').notNull(), lat:doublePrecision('lat').notNull(), lng:doublePrecision('lng').notNull(), radiusM:integer('radius_m').default(100).notNull(), isActive:boolean('is_active').default(true).notNull(), createdAt:created(),
}, t=>[unique().on(t.businessId,t.code),check('valid_store_location',sql`${t.lat} between -90 and 90 and ${t.lng} between -180 and 180 and ${t.radiusM}>0`)]);
export const employees = app.table('employees', {
 id:id(), businessId:uuid('business_id').notNull().references(()=>businesses.id), employeeCode:text('employee_code').notNull(), fullName:text('full_name').notNull(), primaryStoreId:uuid('primary_store_id').references(()=>stores.id), role:text('role').default('employee').notNull(), status:text('status').default('active').notNull(), joinedAt:at('joined_at'), phone:text('phone'), createdAt:created(),
},t=>[unique().on(t.businessId,t.employeeCode),check('valid_employee_role',sql`${t.role} in ('owner','manager','employee')`),check('valid_employee_status',sql`${t.status} in ('active','inactive')`)]);
export const credentials = app.table('employee_credentials', {
 employeeId:uuid('employee_id').primaryKey().references(()=>employees.id), pinHash:text('pin_hash').notNull(), mustChangePin:boolean('must_change_pin').default(true).notNull(), failedAttempts:integer('failed_attempts').default(0).notNull(), lockedUntil:at('locked_until'), changedAt:at('changed_at').defaultNow().notNull(),
},t=>[check('nonnegative_attempts',sql`${t.failedAttempts}>=0`)]);
export const authSessions = app.table('auth_sessions', {
 id:id(), employeeId:uuid('employee_id').notNull().references(()=>employees.id), tokenHash:text('token_hash').notNull().unique(), expiresAt:at('expires_at').notNull(), revokedAt:at('revoked_at'), createdAt:created(),
});
export const assignments = app.table('employee_store_assignments', {
 id:id(), employeeId:uuid('employee_id').notNull().references(()=>employees.id), storeId:uuid('store_id').notNull().references(()=>stores.id), startsAt:at('starts_at').notNull(), endsAt:at('ends_at'),
},t=>[check('valid_assignment_period',sql`${t.endsAt} is null or ${t.endsAt}>${t.startsAt}`)]);
export const shiftTemplates = app.table('shift_templates', {
 id:id(), businessId:uuid('business_id').notNull().references(()=>businesses.id), name:text('name').notNull(), startLocalTime:text('start_local_time').notNull(), endLocalTime:text('end_local_time').notNull(), crossesMidnight:boolean('crosses_midnight').default(false).notNull(), isActive:boolean('is_active').default(true).notNull(), version:integer('version').default(1).notNull(), updatedAt:at('updated_at').defaultNow().notNull(), graceMinutes:integer('grace_minutes').default(5).notNull(),
},t=>[check('valid_grace',sql`${t.graceMinutes}>=0`)]);
export const schedules = app.table('schedules', {
 id:id(), employeeId:uuid('employee_id').notNull().references(()=>employees.id), storeId:uuid('store_id').notNull().references(()=>stores.id), templateId:uuid('template_id').references(()=>shiftTemplates.id), startsAt:at('starts_at').notNull(), endsAt:at('ends_at').notNull(), status:text('status').default('draft').notNull(), publishedAt:at('published_at'), createdBy:uuid('created_by').notNull().references(()=>employees.id), ruleSnapshot:jsonb('rule_snapshot').notNull(), version:integer('version').default(1).notNull(), updatedAt:at('updated_at').defaultNow().notNull(), createdAt:created(),
},t=>[index().on(t.employeeId,t.startsAt),check('valid_schedule_period',sql`${t.endsAt}>${t.startsAt}`),check('valid_schedule_status',sql`${t.status} in ('draft','published','cancelled')`)]);
export const attendanceSessions = app.table('attendance_sessions', {
 id:id(), employeeId:uuid('employee_id').notNull().references(()=>employees.id), scheduleId:uuid('schedule_id').references(()=>schedules.id), status:text('status').default('open').notNull(), isCorrected:boolean('is_corrected').default(false).notNull(), ruleSnapshot:jsonb('rule_snapshot').default({}).notNull(), checkInAt:at('check_in_at'), checkOutAt:at('check_out_at'), createdAt:created(),
},t=>[index().on(t.employeeId,t.checkInAt),check('valid_session_status',sql`${t.status} in ('open','completed','needs_review','corrected')`),check('valid_checkout',sql`${t.checkOutAt} is null or (${t.checkInAt} is not null and ${t.checkOutAt}>=${t.checkInAt})`)]);
export const attendanceEvents = app.table('attendance_events', {
 id:id(), sessionId:uuid('session_id').notNull().references(()=>attendanceSessions.id), employeeId:uuid('employee_id').notNull().references(()=>employees.id), storeId:uuid('store_id').notNull().references(()=>stores.id), eventType:text('event_type').notNull(), recordedAt:at('recorded_at').defaultNow().notNull(), photoPath:text('photo_path').notNull(), lat:doublePrecision('lat'), lng:doublePrecision('lng'), accuracyM:doublePrecision('accuracy_m'), distanceM:doublePrecision('distance_m'), locationStatus:text('location_status').notNull(), reviewStatus:text('review_status').notNull(), reason:text('reason'), idempotencyKey:uuid('idempotency_key').notNull(), ruleSnapshot:jsonb('rule_snapshot').notNull(),
},t=>[unique().on(t.employeeId,t.idempotencyKey),unique().on(t.sessionId,t.eventType),index().on(t.reviewStatus,t.recordedAt),index().on(t.employeeId,t.recordedAt,t.id),index().on(t.photoPath),check('valid_event_type',sql`${t.eventType} in ('check_in','check_out')`),check('valid_review_status',sql`${t.reviewStatus} in ('not_required','pending','approved','rejected')`),check('valid_gps',sql`(${t.accuracyM} is null or ${t.accuracyM}>=0) and (${t.distanceM} is null or ${t.distanceM}>=0) and (${t.lat} is null or ${t.lat} between -90 and 90) and (${t.lng} is null or ${t.lng} between -180 and 180)`),check('valid_location_status',sql`${t.locationStatus} in ('inside','outside','unavailable','inaccurate','denied')`)]);
export const approvals = app.table('approval_requests', {
 id:id(), requestKey:uuid('request_key'), requestHash:text('request_hash'), contextSnapshot:jsonb('context_snapshot'), requesterId:uuid('requester_id').notNull().references(()=>employees.id), type:text('type').notNull(), targetType:text('target_type').notNull(), targetId:uuid('target_id').notNull(), reason:text('reason').notNull(), status:text('status').default('pending').notNull(), reviewerId:uuid('reviewer_id').references(()=>employees.id), decisionNote:text('decision_note'), decidedAt:at('decided_at'), createdAt:created(),
},t=>[unique().on(t.requesterId,t.requestKey),index().on(t.requesterId,t.createdAt),index().on(t.status,t.createdAt),check('valid_approval_status',sql`${t.status} in ('pending','approved','rejected')`),check('valid_approval_decision',sql`(${t.status}='pending' and ${t.decidedAt} is null and ${t.reviewerId} is null) or (${t.status}<>'pending' and ${t.decidedAt} is not null and ${t.reviewerId} is not null)`)]);
export const corrections = app.table('attendance_corrections', {
 id:id(), approvalRequestId:uuid('approval_request_id').notNull().references(()=>approvals.id), field:text('field').notNull(), oldValue:jsonb('old_value'), requestedValue:jsonb('requested_value').notNull(), appliedValue:jsonb('applied_value'),
});
export const settings = app.table('business_settings', {
 businessId:uuid('business_id').notNull().references(()=>businesses.id), key:text('key').notNull(), value:jsonb('value_json').notNull(), updatedBy:uuid('updated_by').references(()=>employees.id), updatedAt:at('updated_at').defaultNow().notNull(),
},t=>[unique().on(t.businessId,t.key),check('setting_key_whitelist',sql`${t.key} in ('branding','attendance_rules','retention_policy')`)]);
export const auditLogs = app.table('audit_logs', {
 id:id(), actorId:uuid('actor_id').references(()=>employees.id), action:text('action').notNull(), entityType:text('entity_type').notNull(), entityId:uuid('entity_id'), metadataRedacted:jsonb('metadata_redacted').notNull(), createdAt:created(),
});

// Owner uses a password independently of employee PIN credentials.
export const ownerCredentials = app.table('owner_credentials', {
 employeeId:uuid('employee_id').primaryKey().references(()=>employees.id), passwordHash:text('password_hash').notNull(), changedAt:at('changed_at').defaultNow().notNull(),
});
export const bootstrapState = app.table('bootstrap_state', {
 businessId:uuid('business_id').primaryKey().references(()=>businesses.id), completedAt:at('completed_at').defaultNow().notNull(),
});
export const authRateLimits = app.table('auth_rate_limits', {
 key:text('key').primaryKey(), attempts:integer('attempts').notNull(), resetsAt:at('resets_at').notNull(),
});

// Durable upload journal: unfinished objects remain discoverable after DB/network failure.
export const attendanceUploads = app.table('attendance_uploads', {
 id:id(), employeeId:uuid('employee_id').notNull().references(()=>employees.id), idempotencyKey:uuid('idempotency_key').notNull(), payloadHash:text('payload_hash').notNull(), photoPath:text('photo_path').notNull(), state:text('state').default('pending').notNull(), createdAt:created(), expiresAt:at('expires_at').notNull(),
},t=>[unique().on(t.employeeId,t.idempotencyKey),index().on(t.state,t.expiresAt),index().on(t.employeeId,t.createdAt),check('valid_upload_state',sql`${t.state} in ('pending','completed','removed')`)]);
