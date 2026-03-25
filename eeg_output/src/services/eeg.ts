const EEG_BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface EEGImportResult {
  success: boolean;
  filename: string;
  channels: {
    C3: number[];
    Cz: number[];
    C4: number[];
  };
  accuracy: number | null;
  message?: string;
}

export const eegService = {
  async importEEGFile(file: File): Promise<EEGImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${EEG_BACKEND_URL}/eeg/import`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Import failed: HTTP ${response.status}`);
    }

    return await response.json();
  },

  async connectBoard(): Promise<{ success: boolean; connected: boolean; source: string; message?: string }> {
    const response = await fetch(`${EEG_BACKEND_URL}/board/connect`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Board connect failed: HTTP ${response.status}`);
    }

    return await response.json();
  },

  async runAnalysis(): Promise<{ success: boolean; accuracy: number | null; message?: string }> {
    const response = await fetch(`${EEG_BACKEND_URL}/analysis/run`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: HTTP ${response.status}`);
    }

    return await response.json();
  },

  // กัน TopBar พังจากโค้ดเดิม
  async listFiles(): Promise<any[]> {
    return [];
  },
};