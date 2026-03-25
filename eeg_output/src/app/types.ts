export interface Patient {
  id: string;
  name: string;
  age: number;
  condition: string;
  doctorNotes?: string;
  createdAt: string;
  lastSessionAccuracy?: number;
}

export interface SessionData {
  patientId: string;
  patientName: string;
  duration: number;
  accuracy: number;
  timestamp: string;
  status: 'completed' | 'in_progress' | 'failed';
}

export interface EEGChannelData {
  C3: number[];
  Cz: number[];
  C4: number[];
}

export interface ImportedEEGFile {
  id?: string;
  file?: File;
  filename: string;
  patientId?: string;
  patientName?: string;
  importedAt: Date | string;
  status: 'uploading' | 'success' | 'error';
  fileSize?: number;
  storageKey?: string;
  previewData?: EEGChannelData;
  source?: 'import' | 'board';
  isActive?: boolean;
}
