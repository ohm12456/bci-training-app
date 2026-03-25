import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ArrowLeft, Activity, Calendar, TrendingUp, Download, FileText, Trash2, CheckCircle2, Clock, FlaskConical } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Patient, TrainingSession } from '../../services/patients';
import { ImportedEEGFile } from '../types';
import { toast } from 'sonner';

interface PatientDetailProps {
  patientId: string;
  onBack: () => void;
  onStartTraining: (patientId: string) => void;
  patients: Patient[];
  sessions: TrainingSession[];
  importedEEGFiles?: ImportedEEGFile[];
  onDeleteEEGFile?: (fileId: string) => void;
  onSetActiveEEGFile?: (file: ImportedEEGFile) => void;
}

function escapeCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(headers: string[], rows: unknown[][]): string {
  return [headers.map(escapeCell).join(','), ...rows.map(r => r.map(escapeCell).join(','))].join('\n');
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function PatientDetail({
  patientId, onBack, onStartTraining, patients, sessions,
  importedEEGFiles = [], onDeleteEEGFile, onSetActiveEEGFile,
}: PatientDetailProps) {
  const patient = patients.find(p => p.id === patientId);
  const patientSessions = sessions
    .filter(s => s.patientId === patientId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const patientEEGFiles = importedEEGFiles.filter(f => f.patientId === patientId);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!patient) return <div className="p-6">Patient not found</div>;

  const chartData = patientSessions.slice().reverse().map(session => ({
    date: new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    accuracy: session.accuracy,
  }));

  const avgAccuracy = patientSessions.length > 0
    ? patientSessions.reduce((sum, s) => sum + s.accuracy, 0) / patientSessions.length : 0;
  const totalTrials = patientSessions.reduce((sum, s) => sum + s.totalTrials, 0);

  const handleExport = () => {
    const patientInfoHeaders = ['Field', 'Value'];
    const patientInfoRows = [
      ['Patient ID', patient.id],
      ['Name', patient.name],
      ['Age', patient.age],
      ['Condition', patient.condition],
      ['Doctor Notes', patient.doctorNotes || ''],
      ['Patient Since', new Date(patient.createdAt).toLocaleDateString()],
      ['Total Sessions', patientSessions.length],
      ['Average Accuracy (%)', avgAccuracy.toFixed(1)],
      ['Total Trials', totalTrials],
    ];

    const sessionHeaders = [
      'Session Date', 'Training Hand', 'Total Trials', 'Correct', 'Accuracy (%)',
      'Duration (min)', 'Status', 'Source File',
    ];
    const sessionRows = patientSessions.map(s => [
      new Date(s.date).toLocaleDateString(),
      (s as any).trainingMode ? (s as any).trainingMode.replace('_', ' ') : 'N/A',
      s.totalTrials,
      s.correctPredictions,
      s.accuracy,
      (s.duration / 60).toFixed(1),
      (s as any).status || 'completed',
      (s as any).sourceFile || 'N/A',
    ]);

    const eegHeaders = ['File Name', 'Imported At', 'File Size (KB)', 'Status'];
    const eegRows = patientEEGFiles.map(f => [
      f.filename,
      new Date(f.importedAt).toLocaleString(),
      f.fileSize ? (f.fileSize / 1024).toFixed(1) : 'N/A',
      f.status,
    ]);

    const sections = [
      '=== PATIENT INFORMATION ===',
      buildCSV(patientInfoHeaders, patientInfoRows),
      '',
      '=== TRAINING HISTORY ===',
      buildCSV(sessionHeaders, sessionRows),
      '',
      '=== IMPORTED EEG FILES ===',
      buildCSV(eegHeaders, eegRows),
    ];

    triggerDownload(`patient_${patient.name.replace(/\s+/g, '_')}_export.csv`, sections.join('\n'));
    toast.success(`Exported data for ${patient.name}`);
  };

  const handleDeleteEEGFile = async (fileId: string, filename: string) => {
    setDeletingId(fileId);
    try {
      if (onDeleteEEGFile) onDeleteEEGFile(fileId);
      toast.success(`Deleted "${filename}"`);
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case 'pending_analysis': return <Badge className="bg-amber-100 text-amber-700">Pending Analysis</Badge>;
      case 'failed': return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default: return <Badge variant="outline">Completed</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>
          <div>
            <h2 className="text-2xl text-gray-900">{patient.name}</h2>
            <p className="text-sm text-gray-500">Patient ID: {patient.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />Export Patient
          </Button>
          <Button className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700" onClick={() => onStartTraining(patientId)}>
            <Activity className="w-4 h-4 mr-2" />Start Training
          </Button>
        </div>
      </div>

      {/* Patient Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Patient Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><p className="text-xs text-gray-500">Age</p><p className="text-sm text-gray-900">{patient.age} years</p></div>
            <div><p className="text-xs text-gray-500">Condition</p><Badge variant="outline">{patient.condition}</Badge></div>
            <div><p className="text-xs text-gray-500">Patient Since</p><p className="text-sm text-gray-900">{new Date(patient.createdAt).toLocaleDateString()}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-600" />Performance Stats</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><p className="text-xs text-gray-500">Average Accuracy</p><p className="text-xl text-gray-900">{avgAccuracy.toFixed(1)}%</p></div>
            <div><p className="text-xs text-gray-500">Total Sessions</p><p className="text-xl text-gray-900">{patientSessions.length}</p></div>
            <div><p className="text-xs text-gray-500">Total Trials</p><p className="text-xl text-gray-900">{totalTrials}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-teal-600" />Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><p className="text-xs text-gray-500">Last Session</p><p className="text-sm text-gray-900">{patientSessions[0] ? new Date(patientSessions[0].date).toLocaleDateString() : 'N/A'}</p></div>
            <div>
              <p className="text-xs text-gray-500">Last Accuracy</p>
              <Badge className={patient.lastSessionAccuracy && patient.lastSessionAccuracy >= 80 ? 'bg-green-100 text-green-700' : patient.lastSessionAccuracy && patient.lastSessionAccuracy >= 70 ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}>
                {patient.lastSessionAccuracy ? `${patient.lastSessionAccuracy}%` : 'N/A'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Doctor Notes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Doctor Notes</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-gray-700 leading-relaxed">{patient.doctorNotes || 'No notes recorded.'}</p></CardContent>
      </Card>

      {/* Progress Chart */}
      <Card>
        <CardHeader><CardTitle>Training Progress</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">No training sessions yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="accuracy" stroke="#06b6d4" strokeWidth={3} dot={{ fill: '#06b6d4', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Training History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Training History</CardTitle>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" />Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {patientSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No training sessions recorded yet.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Date</TableHead>
                    <TableHead>Hand</TableHead>
                    <TableHead>Trials</TableHead>
                    <TableHead>Correct</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="text-gray-900">{new Date(session.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {(session as any).trainingMode ? (
                          <Badge className={(session as any).trainingMode === 'LEFT_HAND' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'} variant="outline">
                            {(session as any).trainingMode === 'LEFT_HAND' ? '← Left' : 'Right →'}
                          </Badge>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-gray-600">{session.totalTrials}</TableCell>
                      <TableCell className="text-gray-600">{session.correctPredictions}</TableCell>
                      <TableCell>
                        <Badge className={session.accuracy >= 80 ? 'bg-green-100 text-green-700' : session.accuracy >= 70 ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}>
                          {session.accuracy}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">{Math.floor(session.duration / 60)}m {session.duration % 60}s</TableCell>
                      <TableCell>{getStatusBadge((session as any).status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Analysis placeholder note */}
          {patientSessions.some(s => (s as any).status === 'pending_analysis') && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <FlaskConical className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                <span className="font-medium">Analysis pending</span> — Some sessions are awaiting full EEG model processing.
                Accuracy values shown are simulation placeholders. Final results will be updated once the analysis pipeline is integrated.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Imported EEG Files */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-600" />
            Imported EEG Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patientEEGFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No EEG files imported for this patient.</p>
              <p className="text-xs mt-1">Use the Import EEG button in the top bar to add files.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {patientEEGFiles.map((file, idx) => (
                <div key={file.id || idx} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${file.status === 'success' ? 'bg-green-100' : 'bg-gray-200'}`}>
                      {file.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <FileText className="w-4 h-4 text-gray-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.filename}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(file.importedAt).toLocaleString()}
                        {file.fileSize && ` · ${(file.fileSize / 1024).toFixed(1)} KB`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {onSetActiveEEGFile && (
                      <Button size="sm" variant="outline" onClick={() => { onSetActiveEEGFile(file); toast.success(`"${file.filename}" set as active EEG`); }}>
                        Use
                      </Button>
                    )}
                    {onDeleteEEGFile && file.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        disabled={deletingId === file.id}
                        onClick={() => handleDeleteEEGFile(file.id!, file.filename)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
