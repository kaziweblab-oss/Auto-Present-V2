import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleSubject: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true },
  displayName: { type: String, required: true },
  avatarUrl: { type: String },
  roles: { type: [String], default: [] },
  status: { type: String, default: 'ACTIVE' },
}, { timestamps: true });

const sessionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  state: { type: String, enum: ['DRAFT','ACTIVE','CLOSED','ARCHIVED'], default: 'DRAFT' },
  startDate: { type: Date },
  endDate: { type: Date },
  // sessionDbKey abstraction: which physical DB holds this session (default primary).
  dbKey: { type: String, default: 'primary' },
}, { timestamps: true });

const auditSchema = new mongoose.Schema({
  actorUserId: { type: String },
  role: { type: String },
  action: { type: String, required: true },
  entity: { type: String },
  entityId: { type: String },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

export const User = mongoose.models.User ?? mongoose.model('User', userSchema);
export const AcademicSession = mongoose.models.AcademicSession ?? mongoose.model('AcademicSession', sessionSchema);
export const AuditLog = mongoose.models.AuditLog ?? mongoose.model('AuditLog', auditSchema);

export async function audit(entry: { actorUserId?: string; role?: string; action: string; entity?: string; entityId?: string; before?: unknown; after?: unknown }) {
  await AuditLog.create(entry);
}
