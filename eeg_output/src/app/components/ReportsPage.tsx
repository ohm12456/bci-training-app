import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import {
  FileText, Download, Filter, Calendar, CheckCircle2, AlertCircle, Loader2, X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Patient, TrainingSession } from '../../services/patients';
import { toast } from 'sonner';

interface ReportsPageProps {
  patients: Patient[];
  sessions: TrainingSession[];
  accessToken: string | null;
}

type ReportKey = 'monthly' | 'progress' | 'eegQuality' | 'sessionDetails';
type DownloadState = 'idle' | 'loading' | 'success' | 'error';

// ── CSV helpers ───────────────────────────────────────────────────────────────
function escapeCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\n');
}

function triggerDownload(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType }); // BOM for Excel compatibility
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Report generators ─────────────────────────────────────────────────────────
function generateMonthlyReport(patients: Patient[], sessions: TrainingSession[]): string {
  const byMonth: Record<string, { sessions: TrainingSession[]; totalAccuracy: number }> = {};
  sessions.forEach((s) => {
    const month = new Date(s.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!byMonth[month]) byMonth[month] = { sessions: [], totalAccuracy: 0 };
    byMonth[month].sessions.push(s);
    byMonth[month].totalAccuracy += s.accuracy;
  });

  const headers = ['Month', 'Total Sessions', 'Avg Accuracy (%)', 'Total Trials', 'Correct Predictions', 'Unique Patients'];
  const rows = Object.entries(byMonth).map(([month, data]) => {
    const uniquePatients = new Set(data.sessions.map((s) => s.patientId)).size;
    return [
      month,
      data.sessions.length,
      (data.totalAccuracy / data.sessions.length).toFixed(1),
      data.sessions.reduce((s, x) => s + x.totalTrials, 0),
      data.sessions.reduce((s, x) => s + x.correctPredictions, 0),
      uniquePatients,
    ];
  });
  return buildCSV(headers, rows);
}

function generateProgressReport(patients: Patient[], sessions: TrainingSession[]): string {
  const headers = [
    'Patient ID', 'Patient Name', 'Condition', 'Age',
    'Total Sessions', 'Avg Accuracy (%)', 'Last Session Accuracy (%)',
    'First Session Date', 'Last Session Date', 'Total Trials', 'Total Duration (min)',
  ];
  const rows = patients.map((patient) => {
    const ps = sessions
      .filter((s) => s.patientId === patient.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const avgAccuracy = ps.length > 0
      ? (ps.reduce((sum, s) => sum + s.accuracy, 0) / ps.length).toFixed(1)
      : 'N/A';
    const totalDuration = ps.reduce((sum, s) => sum + s.duration, 0);
    return [
      patient.id, patient.name, patient.condition, patient.age,
      ps.length, avgAccuracy,
      patient.lastSessionAccuracy > 0 ? patient.lastSessionAccuracy : 'N/A',
      ps[0] ? new Date(ps[0].date).toLocaleDateString() : 'N/A',
      ps[ps.length - 1] ? new Date(ps[ps.length - 1].date).toLocaleDateString() : 'N/A',
      ps.reduce((s, x) => s + x.totalTrials, 0),
      (totalDuration / 60).toFixed(1),
    ];
  });
  return buildCSV(headers, rows);
}

function generateEEGQualityReport(patients: Patient[], sessions: TrainingSession[]): string {
  const headers = [
    'Session ID', 'Patient ID', 'Patient Name', 'Condition', 'Date',
    'Duration (min)', 'Total Trials', 'Accuracy (%)',
    'EEG Signal Quality (inferred)', 'Noise Level (inferred)',
  ];
  const qualityLabels = ['Excellent', 'Good', 'Fair', 'Poor'];
  const noiseLevels = ['Low', 'Moderate', 'Elevated', 'High'];

  const sorted = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const rows = sorted.map((s) => {
    const patient = patients.find((p) => p.id === s.patientId);
    const qi = s.accuracy >= 80 ? 0 : s.accuracy >= 70 ? 1 : s.accuracy >= 60 ? 2 : 3;
    return [
      s.id, s.patientId, patient?.name ?? 'Unknown', patient?.condition ?? 'Unknown',
      new Date(s.date).toLocaleDateString(),
      (s.duration / 60).toFixed(1), s.totalTrials, s.accuracy,
      qualityLabels[qi], noiseLevels[qi],
    ];
  });
  return buildCSV(headers, rows);
}

function generateSessionDetailsReport(patients: Patient[], sessions: TrainingSession[]): string {
  const headers = [
    'Session ID', 'Patient ID', 'Patient Name', 'Condition',
    'Date', 'Duration (min)', 'Total Trials', 'Correct Predictions', 'Accuracy (%)',
  ];
  const sorted = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const rows = sorted.map((s) => {
    const patient = patients.find((p) => p.id === s.patientId);
    return [
      s.id, s.patientId, patient?.name ?? 'Unknown', patient?.condition ?? 'Unknown',
      new Date(s.date).toLocaleDateString(),
      (s.duration / 60).toFixed(1), s.totalTrials, s.correctPredictions, s.accuracy,
    ];
  });
  return buildCSV(headers, rows);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ReportsPage({ patients, sessions, accessToken }: ReportsPageProps) {
  const [downloadStates, setDownloadStates] = useState<Record<ReportKey, DownloadState>>({
    monthly: 'idle',
    progress: 'idle',
    eegQuality: 'idle',
    sessionDetails: 'idle',
  });

  // Filter / date range state
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [filterCondition, setFilterCondition] = useState('');
  const [filterPatientName, setFilterPatientName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Filtered data based on active filters
  const filteredSessions = useMemo(() => {
    let result = sessions;
    if (dateFrom) {
      result = result.filter((s) => new Date(s.date) >= new Date(dateFrom));
    }
    if (dateTo) {
      result = result.filter((s) => new Date(s.date) <= new Date(dateTo + 'T23:59:59'));
    }
    if (filterCondition) {
      const matchingPatientIds = patients
        .filter((p) => p.condition.toLowerCase().includes(filterCondition.toLowerCase()))
        .map((p) => p.id);
      result = result.filter((s) => matchingPatientIds.includes(s.patientId));
    }
    if (filterPatientName) {
      const matchingPatientIds = patients
        .filter((p) => p.name.toLowerCase().includes(filterPatientName.toLowerCase()))
        .map((p) => p.id);
      result = result.filter((s) => matchingPatientIds.includes(s.patientId));
    }
    return result;
  }, [sessions, patients, dateFrom, dateTo, filterCondition, filterPatientName]);

  const filteredPatients = useMemo(() => {
    if (!filterCondition && !filterPatientName) return patients;
    return patients.filter((p) => {
      const matchCond = !filterCondition || p.condition.toLowerCase().includes(filterCondition.toLowerCase());
      const matchName = !filterPatientName || p.name.toLowerCase().includes(filterPatientName.toLowerCase());
      return matchCond && matchName;
    });
  }, [patients, filterCondition, filterPatientName]);

  const hasActiveFilters = !!(dateFrom || dateTo || filterCondition || filterPatientName);

  const applyFilters = () => {
    setFiltersApplied(true);
    setShowFilterDialog(false);
    setShowDateDialog(false);
    toast.success('Filters applied — report data updated');
  };

  const clearFilters = () => {
    setFilterCondition('');
    setFilterPatientName('');
    setDateFrom('');
    setDateTo('');
    setFiltersApplied(false);
    toast.info('Filters cleared');
  };

  const setReportState = (key: ReportKey, state: DownloadState) =>
    setDownloadStates((prev) => ({ ...prev, [key]: state }));

  const handleDownload = async (key: ReportKey, filename: string, generator: () => string) => {
    setReportState(key, 'loading');
    try {
      await new Promise((res) => setTimeout(res, 250));
      const csv = generator();
      if (!csv.trim() || csv.split('\n').length < 2) {
        toast.warning('No data available for this report with the current filters.');
        setReportState(key, 'idle');
        return;
      }
      triggerDownload(filename, csv);
      setReportState(key, 'success');
      toast.success(`${filename} downloaded`);
      setTimeout(() => setReportState(key, 'idle'), 3000);
    } catch (err) {
      console.error(`Error generating ${key} report:`, err);
      setReportState(key, 'error');
      toast.error(`Failed to generate report: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setReportState(key, 'idle'), 4000);
    }
  };

  // ── Summary stats (using filtered data) ────────────────────────────────────
  const activeSessions = filtersApplied ? filteredSessions : sessions;
  const activePatients = filtersApplied ? filteredPatients : patients;

  const patientPerformance = activePatients.map((p) => {
    const ps = activeSessions.filter((s) => s.patientId === p.id);
    const avg = ps.length > 0 ? ps.reduce((sum, s) => sum + s.accuracy, 0) / ps.length : 0;
    return { name: p.name.split(' ')[0], accuracy: Math.round(avg) };
  });

  const totalSessions = activeSessions.length;
  const totalPatients = activePatients.length;
  const avgAccuracy =
    activePatients.length > 0
      ? activePatients.reduce((sum, p) => sum + p.lastSessionAccuracy, 0) / totalPatients
      : 0;
  const successRate =
    activeSessions.length > 0
      ? (
          (activeSessions.reduce((sum, s) => sum + s.correctPredictions, 0) /
            activeSessions.reduce((sum, s) => sum + s.totalTrials, 0)) *
          100
        ).toFixed(1)
      : '0.0';

  // Per-report config
  const reports: {
    key: ReportKey;
    title: string;
    desc: string;
    filename: string;
    generator: () => string;
  }[] = [
    {
      key: 'monthly',
      title: 'Monthly Performance Report',
      desc: 'Training sessions grouped by month with aggregate accuracy',
      filename: `monthly-performance-${today()}.csv`,
      generator: () => generateMonthlyReport(activePatients, activeSessions),
    },
    {
      key: 'progress',
      title: 'Patient Progress Summary',
      desc: 'Per-patient improvement tracking across all sessions',
      filename: `patient-progress-${today()}.csv`,
      generator: () => generateProgressReport(activePatients, activeSessions),
    },
    {
      key: 'eegQuality',
      title: 'EEG Signal Quality Report',
      desc: 'Inferred signal quality and noise levels per session',
      filename: `eeg-signal-quality-${today()}.csv`,
      generator: () => generateEEGQualityReport(activePatients, activeSessions),
    },
    {
      key: 'sessionDetails',
      title: 'Training Session Details',
      desc: 'Full breakdown of every completed training session',
      filename: `session-details-${today()}.csv`,
      generator: () => generateSessionDetailsReport(activePatients, activeSessions),
    },
  ];

  const handleExportAll = async () => {
    const label = hasActiveFilters ? ' (filtered)' : '';
    toast.info(`Exporting all 4 reports${label}…`);
    for (const r of reports) {
      await handleDownload(r.key, r.filename, r.generator);
      await new Promise((res) => setTimeout(res, 200));
    }
    toast.success('All reports exported successfully');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl text-gray-900">Reports & Analytics</h2>
          <p className="text-sm text-gray-500">
            {hasActiveFilters
              ? `Showing filtered data — ${activeSessions.length} sessions, ${activePatients.length} patients`
              : 'Training performance and statistics'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="text-orange-600 border-orange-300 hover:bg-orange-50">
              <X className="w-4 h-4 mr-1" />
              Clear Filters
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowFilterDialog(true)}
            className={hasActiveFilters ? 'border-cyan-400 text-cyan-700' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
            {hasActiveFilters && <span className="ml-1 w-2 h-2 bg-cyan-500 rounded-full inline-block" />}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowDateDialog(true)}
            className={dateFrom || dateTo ? 'border-cyan-400 text-cyan-700' : ''}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Date Range
            {(dateFrom || dateTo) && <span className="ml-1 w-2 h-2 bg-cyan-500 rounded-full inline-block" />}
          </Button>
          <Button
            className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700"
            onClick={handleExportAll}
          >
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filterPatientName && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-xs">
              Patient: {filterPatientName}
              <button onClick={() => setFilterPatientName('')} className="hover:text-cyan-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filterCondition && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-xs">
              Condition: {filterCondition}
              <button onClick={() => setFilterCondition('')} className="hover:text-cyan-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {dateFrom && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-xs">
              From: {new Date(dateFrom).toLocaleDateString()}
              <button onClick={() => setDateFrom('')} className="hover:text-cyan-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {dateTo && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-xs">
              To: {new Date(dateTo).toLocaleDateString()}
              <button onClick={() => setDateTo('')} className="hover:text-cyan-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Total Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-gray-900">{totalPatients}</div>
            <p className="text-xs text-gray-500 mt-1">
              {hasActiveFilters ? 'Matching filter' : 'Active in system'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-gray-900">{totalSessions}</div>
            <p className="text-xs text-gray-500 mt-1">
              {hasActiveFilters ? 'In selected period' : 'Completed'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {patientPerformance.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No data to display with the current filters
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={patientPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    label={{
                      value: 'Accuracy (%)',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 12, fill: '#6b7280' },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="accuracy"
                    fill="#06b6d4"
                    name="Average Accuracy %"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Available Reports</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            All reports export as UTF-8 CSV files compatible with Excel, Google Sheets, and Numbers.
            {hasActiveFilters && (
              <span className="text-cyan-600 font-medium"> Active filters applied to all exports.</span>
            )}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {reports.map((report) => {
              const state = downloadStates[report.key];
              return (
                <div
                  key={report.key}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    state === 'success'
                      ? 'bg-green-50 border-green-200'
                      : state === 'error'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        state === 'success'
                          ? 'bg-green-100'
                          : state === 'error'
                          ? 'bg-red-100'
                          : 'bg-cyan-100'
                      }`}
                    >
                      {state === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : state === 'error' ? (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-cyan-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{report.title}</p>
                      <p className="text-xs text-gray-500">{report.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={state === 'loading'}
                      onClick={() => handleDownload(report.key, report.filename, report.generator)}
                      className={
                        state === 'success'
                          ? 'border-green-300 text-green-700 hover:bg-green-50'
                          : state === 'error'
                          ? 'border-red-300 text-red-700 hover:bg-red-50'
                          : ''
                      }
                    >
                      {state === 'loading' ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating…
                        </span>
                      ) : state === 'success' ? (
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Downloaded
                        </span>
                      ) : state === 'error' ? (
                        <span className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          Retry
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Download className="w-4 h-4" />
                          Download CSV
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              <span className="font-medium">Note:</span> Reports reflect live data from the backend. The "Export All" button generates all 4 reports including the EEG Signal Quality report.
              Use the <strong>Filter</strong> and <strong>Date Range</strong> buttons above to narrow the data before exporting.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Filter Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Filter Reports</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-gray-600">
              Narrow the data used in reports and charts. Leave fields blank to include all.
            </p>
            <div className="space-y-2">
              <Label htmlFor="filter-name">Patient Name (contains)</Label>
              <Input
                id="filter-name"
                placeholder="e.g., Anderson"
                value={filterPatientName}
                onChange={(e) => setFilterPatientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-condition">Medical Condition (contains)</Label>
              <Input
                id="filter-condition"
                placeholder="e.g., Stroke"
                value={filterCondition}
                onChange={(e) => setFilterCondition(e.target.value)}
              />
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              {filterPatientName || filterCondition
                ? `Will show ${filteredPatients.length} patient(s) and ${filteredSessions.length} session(s)`
                : `All ${patients.length} patients and ${sessions.length} sessions`}
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={applyFilters} className="flex-1 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700">
                Apply Filter
              </Button>
              <Button variant="outline" onClick={() => { clearFilters(); setShowFilterDialog(false); }} className="flex-1">
                Clear & Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Date Range Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Date Range</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-gray-600">
              Filter sessions by date range. Leave a field blank for an open-ended range.
            </p>
            <div className="space-y-2">
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              {dateFrom || dateTo
                ? `${filteredSessions.length} session(s) in selected range`
                : `All ${sessions.length} sessions (no date filter)`}
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={applyFilters} className="flex-1 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700">
                Apply Date Range
              </Button>
              <Button variant="outline" onClick={() => { setDateFrom(''); setDateTo(''); setShowDateDialog(false); }} className="flex-1">
                Clear & Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
