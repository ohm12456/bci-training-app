import { supabase } from '../utils/supabase';

export interface Patient {
  id: string;
  name: string;
  age: number;
  condition: string;
  doctorNotes?: string;
  createdAt: string;
  lastSessionAccuracy?: number;
}

export interface TrainingSession {
  id?: string;
  patientId: string;
  date: string;
  totalTrials: number;
  correctPredictions: number;
  accuracy: number;
  duration: number;
  trainingMode?: 'LEFT_HAND' | 'RIGHT_HAND';
  trialCount?: number;
  status?: 'completed' | 'pending_analysis' | 'failed';
  sourceFile?: string;
}

// Legacy alias for compatibility
export type SessionRecord = TrainingSession;

type PatientInput = {
  name: string;
  age: number;
  condition: string;
  doctorNotes?: string;
};

// ── Local persistence helpers ─────────────────────────────────────────────────
const SESSION_STORAGE_KEY = 'bci_training_sessions';

function loadLocalSessions(): TrainingSession[] {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSessions(sessions: TrainingSession[]) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    console.warn('Could not persist sessions to localStorage');
  }
}

function mapPatientRow(row: any): Patient {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    condition: row.medical_condition || '',
    doctorNotes: row.doctor_notes || '',
    createdAt: row.created_at || new Date().toISOString(),
    lastSessionAccuracy: row.last_session_accuracy ?? 0,
  };
}

export const patientService = {
  async getPatients(_accessToken?: string | null): Promise<Patient[]> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('No authenticated user found');

    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapPatientRow);
  },

  async addPatient(_accessToken: string, patient: PatientInput): Promise<Patient> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('No authenticated user found');

    const { data, error } = await supabase
      .from('patients')
      .insert([{ user_id: user.id, name: patient.name, age: patient.age, medical_condition: patient.condition, doctor_notes: patient.doctorNotes || '' }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapPatientRow(data);
  },

  async updatePatient(_accessToken: string, patientId: string, updates: Partial<Patient>): Promise<Patient | null> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('No authenticated user found');

    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.age !== undefined) dbUpdates.age = updates.age;
    if (updates.condition !== undefined) dbUpdates.medical_condition = updates.condition;
    if (updates.doctorNotes !== undefined) dbUpdates.doctor_notes = updates.doctorNotes;

    const { data, error } = await supabase
      .from('patients')
      .update(dbUpdates)
      .eq('id', patientId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return null;
    return mapPatientRow(data);
  },

  async deletePatient(_accessToken: string, patientId: string): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('No authenticated user found');

    const { error } = await supabase
      .from('patients')
      .delete()
      .eq('id', patientId)
      .eq('user_id', user.id);

    if (error) throw new Error(error.message);
  },

  // ── Session persistence via localStorage ─────────────────────────────────
  async getAllSessions(_accessToken?: string | null): Promise<TrainingSession[]> {
    return loadLocalSessions();
  },

  async addSession(
    _accessToken: string | null,
    patientId: string,
    session: Omit<TrainingSession, 'patientId'>
  ): Promise<TrainingSession | null> {
    const newSession: TrainingSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      patientId,
      ...session,
    };

    const existing = loadLocalSessions();
    const updated = [newSession, ...existing];
    saveLocalSessions(updated);
    return newSession;
  },

  async deleteSession(sessionId: string): Promise<void> {
    const existing = loadLocalSessions();
    saveLocalSessions(existing.filter(s => s.id !== sessionId));
  },

  async debugUserData(_accessToken?: string | null): Promise<any> {
    return { ok: true, message: 'debugUserData stub' };
  },

  async reseedData(_accessToken?: string | null): Promise<any> {
    return { ok: true, patientsCreated: 0, message: 'reseedData stub' };
  },
};
