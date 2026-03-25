// Mock data for the BCI training application

export interface Patient {
  id: string;
  name: string;
  age: number;
  condition: string;
  lastSessionAccuracy: number;
  doctorNotes: string;
  createdAt: Date;
}

export interface TrainingSession {
  id: string;
  patientId: string;
  date: Date;
  totalTrials: number;
  correctPredictions: number;
  accuracy: number;
  duration: number;
}

export interface Doctor {
  id: string;
  name: string;
  email: string;
  hospital: string;
  department: string;
}

export const currentDoctor: Doctor = {
  id: 'DR001',
  name: 'Dr. Sarah Mitchell',
  email: 'sarah.mitchell@hospital.com',
  hospital: 'Central Medical Center',
  department: 'Neurology & Rehabilitation'
};

export const patients: Patient[] = [
  {
    id: 'P001',
    name: 'John Anderson',
    age: 52,
    condition: 'Stroke Recovery',
    lastSessionAccuracy: 78.5,
    doctorNotes: 'Patient showing steady improvement in motor imagery tasks. Right-hand imagery is stronger than left.',
    createdAt: new Date('2025-12-15')
  },
  {
    id: 'P002',
    name: 'Maria Garcia',
    age: 45,
    condition: 'Spinal Cord Injury',
    lastSessionAccuracy: 82.3,
    doctorNotes: 'Excellent concentration during training sessions. Consider increasing difficulty level.',
    createdAt: new Date('2026-01-10')
  },
  {
    id: 'P003',
    name: 'Robert Chen',
    age: 38,
    condition: 'Traumatic Brain Injury',
    lastSessionAccuracy: 65.2,
    doctorNotes: 'Initial sessions showing promise. Patient requires more rest between trials.',
    createdAt: new Date('2026-02-05')
  },
  {
    id: 'P004',
    name: 'Emma Wilson',
    age: 61,
    condition: 'Stroke Recovery',
    lastSessionAccuracy: 73.8,
    doctorNotes: 'Good progress over past 3 weeks. Patient is motivated and engaged.',
    createdAt: new Date('2025-11-22')
  },
  {
    id: 'P005',
    name: 'Michael Brown',
    age: 55,
    condition: 'Parkinson\'s Disease',
    lastSessionAccuracy: 69.4,
    doctorNotes: 'Tremor affects signal quality. Morning sessions show better results.',
    createdAt: new Date('2026-01-28')
  }
];

export const trainingSessions: TrainingSession[] = [
  // John Anderson sessions
  { id: 'S001', patientId: 'P001', date: new Date('2026-02-20'), totalTrials: 40, correctPredictions: 31, accuracy: 77.5, duration: 1200 },
  { id: 'S002', patientId: 'P001', date: new Date('2026-02-25'), totalTrials: 40, correctPredictions: 32, accuracy: 80.0, duration: 1180 },
  { id: 'S003', patientId: 'P001', date: new Date('2026-03-01'), totalTrials: 40, correctPredictions: 31, accuracy: 77.5, duration: 1220 },
  { id: 'S004', patientId: 'P001', date: new Date('2026-03-05'), totalTrials: 40, correctPredictions: 31, accuracy: 78.5, duration: 1190 },
  
  // Maria Garcia sessions
  { id: 'S005', patientId: 'P002', date: new Date('2026-02-18'), totalTrials: 40, correctPredictions: 31, accuracy: 77.5, duration: 1150 },
  { id: 'S006', patientId: 'P002', date: new Date('2026-02-23'), totalTrials: 40, correctPredictions: 32, accuracy: 80.0, duration: 1160 },
  { id: 'S007', patientId: 'P002', date: new Date('2026-02-28'), totalTrials: 40, correctPredictions: 33, accuracy: 82.5, duration: 1140 },
  { id: 'S008', patientId: 'P002', date: new Date('2026-03-04'), totalTrials: 40, correctPredictions: 33, accuracy: 82.3, duration: 1155 },
  
  // Robert Chen sessions
  { id: 'S009', patientId: 'P003', date: new Date('2026-02-22'), totalTrials: 40, correctPredictions: 24, accuracy: 60.0, duration: 1280 },
  { id: 'S010', patientId: 'P003', date: new Date('2026-02-27'), totalTrials: 40, correctPredictions: 25, accuracy: 62.5, duration: 1290 },
  { id: 'S011', patientId: 'P003', date: new Date('2026-03-03'), totalTrials: 40, correctPredictions: 26, accuracy: 65.2, duration: 1270 },
  
  // Emma Wilson sessions
  { id: 'S012', patientId: 'P004', date: new Date('2026-02-19'), totalTrials: 40, correctPredictions: 28, accuracy: 70.0, duration: 1210 },
  { id: 'S013', patientId: 'P004', date: new Date('2026-02-24'), totalTrials: 40, correctPredictions: 29, accuracy: 72.5, duration: 1200 },
  { id: 'S014', patientId: 'P004', date: new Date('2026-03-01'), totalTrials: 40, correctPredictions: 30, accuracy: 75.0, duration: 1195 },
  { id: 'S015', patientId: 'P004', date: new Date('2026-03-05'), totalTrials: 40, correctPredictions: 29, accuracy: 73.8, duration: 1205 },
  
  // Michael Brown sessions
  { id: 'S016', patientId: 'P005', date: new Date('2026-02-21'), totalTrials: 40, correctPredictions: 26, accuracy: 65.0, duration: 1240 },
  { id: 'S017', patientId: 'P005', date: new Date('2026-02-26'), totalTrials: 40, correctPredictions: 27, accuracy: 67.5, duration: 1235 },
  { id: 'S018', patientId: 'P005', date: new Date('2026-03-02'), totalTrials: 40, correctPredictions: 28, accuracy: 69.4, duration: 1225 }
];
