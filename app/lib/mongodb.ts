import mongoose, { Schema, model, models } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function dbConnect() {
  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((m) => {
      return m;
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

/**
 * Non-throwing DB availability check.
 * Useful for routes that want to branch on DB availability without crashing.
 */
export async function dbStatus(): Promise<'connected' | 'unconfigured' | 'error'> {
  if (!MONGODB_URI) return 'unconfigured';
  try {
    await dbConnect();
    return 'connected';
  } catch {
    return 'error';
  }
}

export interface IReportIndex {
  blobId: string;
  ownerAddress: string;
  sharedWith: string[];
  policyId: string;
  topic: string;
  timestamp: Date;
}

const ReportIndexSchema = new Schema<IReportIndex>({
  blobId: { type: String, required: true, unique: true },
  ownerAddress: { type: String, required: true, index: true },
  sharedWith: { type: [String], index: true, default: [] },
  policyId: { type: String, required: true },
  topic: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Enforce lowercase address searches in the DB indexes and queries
ReportIndexSchema.pre('save', function (this: any) {
  if (this.ownerAddress) {
    this.ownerAddress = this.ownerAddress.toLowerCase();
  }
  if (this.sharedWith) {
    this.sharedWith = this.sharedWith.map((addr: string) => addr.toLowerCase());
  }
  if (this.policyId) {
    this.policyId = this.policyId.toLowerCase();
  }
});

export const ReportIndex = models.ReportIndex || model<IReportIndex>('ReportIndex', ReportIndexSchema);
