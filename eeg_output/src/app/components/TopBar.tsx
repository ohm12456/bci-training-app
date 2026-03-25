import { Bell, Wifi, Signal, Upload, CheckCircle2, FileText, X, AlertCircle } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Patient } from '../../services/patients';
import { eegService } from '../../services/eeg';
import { ImportedEEGFile } from '../types';

interface TopBarProps {
  title: string;
  accessToken: string | null;
  patients?: Patient[];
  importedEEGFiles?: ImportedEEGFile[];
  activePatientId?: string;
  onEEGFileImported?: (file: ImportedEEGFile) => void;
  onEEGFilesLoaded?: (files: ImportedEEGFile[]) => void;
}

const EEG_DEVICES = [
  { id: 'openbci-cyton', name: 'OpenBCI Cyton', channels: 8 },
  { id: 'emotiv-epoc-x', name: 'Emotiv EPOC X', channels: 14 },
  { id: 'muse-s', name: 'Muse S', channels: 4 },
  { id: 'neurosity-crown', name: 'Neurosity Crown', channels: 8 },
  { id: 'gtec-unicorn', name: 'g.tec Unicorn', channels: 8 },
];

export function TopBar({
  title,
  accessToken,
  patients = [],
  importedEEGFiles = [],
  activePatientId,
  onEEGFileImported,
  onEEGFilesLoaded,
}: TopBarProps) {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [connectedDevice, setConnectedDevice] = useState(EEG_DEVICES[0]);
  const [isDeviceConnected, setIsDeviceConnected] = useState(true);
  const [signalQuality] = useState<'Excellent' | 'Good' | 'Fair' | 'Poor'>('Excellent');

  // ตอนนี้ยังไม่โหลดจาก backend history จริง ปล่อยเป็น empty ได้ก่อน
  useEffect(() => {
    if (onEEGFilesLoaded) {
      onEEGFilesLoaded(importedEEGFiles);
    }
  }, [onEEGFilesLoaded, importedEEGFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadStatus('idle');
      setUploadProgress('');
      if (activePatientId && !selectedPatientId) {
        setSelectedPatientId(activePatientId);
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadProgress('Importing EEG file…');

    const patient = selectedPatientId
      ? patients.find((p) => p.id === selectedPatientId)
      : undefined;

    try {
      const result = await eegService.importEEGFile(selectedFile);

      if (!result.success) {
        throw new Error(result.message || 'Import failed');
      }

      const importedRecord: ImportedEEGFile = {
        filename: result.filename,
        patientId: selectedPatientId || undefined,
        patientName: patient?.name,
        importedAt: new Date(),
        status: 'success',
        fileSize: selectedFile.size,
        previewData: result.channels,
        source: 'import',
      };

      setUploadStatus('success');
      setUploadProgress('');

      if (onEEGFileImported) {
        onEEGFileImported(importedRecord);
      }

      const label = patient ? ` for ${patient.name}` : '';
      toast.success(`EEG file "${selectedFile.name}"${label} imported successfully`);

      setTimeout(() => {
        resetDialog();
      }, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      console.error('EEG import error:', err);
      setUploadStatus('error');
      setUploadProgress(msg);
      toast.error(`Import failed: ${msg}`);
    }
  };

  const resetDialog = () => {
    setShowImportDialog(false);
    setSelectedFile(null);
    setSelectedPatientId('');
    setUploadStatus('idle');
    setUploadProgress('');
  };

  const handleConnectDevice = async (device: (typeof EEG_DEVICES)[0]) => {
    try {
      await eegService.connectBoard();
      setConnectedDevice(device);
      setIsDeviceConnected(true);
      setShowDeviceDialog(false);
      toast.success(`Connected to ${device.name}`);
    } catch (err) {
      console.error('Board connection error:', err);
      toast.error('Board connection failed');
    }
  };

  const handleDisconnectDevice = () => {
    setIsDeviceConnected(false);
    toast.info('EEG device disconnected');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatImportDate = (d: Date | string) => {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
        <h2 className="text-xl text-gray-900">{title}</h2>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportDialog(true)}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Import
            {importedEEGFiles.length > 0 && (
              <Badge className="bg-cyan-100 text-cyan-700 px-1.5 py-0 text-[10px] ml-1">
                {importedEEGFiles.length}
              </Badge>
            )}
          </Button>

          <button
            onClick={() => setShowDeviceDialog(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
              isDeviceConnected
                ? 'bg-green-50 border-green-200 hover:bg-green-100'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Wifi className={`w-4 h-4 ${isDeviceConnected ? 'text-green-600' : 'text-gray-400'}`} />
            <span className={`text-xs ${isDeviceConnected ? 'text-green-700' : 'text-gray-500'}`}>
              {isDeviceConnected ? connectedDevice.name : 'No Device'}
            </span>
          </button>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              signalQuality === 'Excellent'
                ? 'bg-blue-50 border-blue-200'
                : signalQuality === 'Good'
                ? 'bg-green-50 border-green-200'
                : signalQuality === 'Fair'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <Signal
              className={`w-4 h-4 ${
                signalQuality === 'Excellent'
                  ? 'text-blue-600'
                  : signalQuality === 'Good'
                  ? 'text-green-600'
                  : signalQuality === 'Fair'
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            />
            <span
              className={`text-xs ${
                signalQuality === 'Excellent'
                  ? 'text-blue-700'
                  : signalQuality === 'Good'
                  ? 'text-green-700'
                  : signalQuality === 'Fair'
                  ? 'text-yellow-700'
                  : 'text-red-700'
              }`}
            >
              Signal: {signalQuality}
            </span>
          </div>

          <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
              3
            </Badge>
          </button>
        </div>
      </div>

      <Dialog
        open={showImportDialog}
        onOpenChange={(open) => !open && uploadStatus !== 'uploading' && resetDialog()}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import EEG Data</DialogTitle>
          </DialogHeader>

          {uploadStatus === 'success' ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-gray-900 font-medium">Import Successful</p>
              <p className="text-sm text-gray-500">
                {selectedFile?.name} has been imported successfully.
              </p>
            </div>
          ) : (
            <div className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="eegFile">Select EEG Data File *</Label>
                <Input
                  id="eegFile"
                  type="file"
                  accept=".edf,.csv,.mat,.dat,.txt,.bdf"
                  onChange={handleFileSelect}
                  disabled={uploadStatus === 'uploading'}
                />
                <p className="text-xs text-gray-500">
                  Supported formats: EDF, BDF, CSV, MAT, DAT, TXT
                </p>
              </div>

              {patients.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="importPatient">Associate with Patient (optional)</Label>
                  <select
                    id="importPatient"
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    disabled={uploadStatus === 'uploading'}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">— No patient selected —</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.condition})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedFile && (
                <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      {formatFileSize(selectedFile.size)}
                      {selectedPatientId && (
                        <> · {patients.find((p) => p.id === selectedPatientId)?.name}</>
                      )}
                    </p>
                  </div>
                  {uploadStatus === 'idle' && (
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-blue-400 hover:text-blue-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {uploadStatus === 'uploading' && (
                <div className="flex items-center gap-3 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                  <span className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <p className="text-sm text-cyan-800">{uploadProgress || 'Uploading…'}</p>
                </div>
              )}

              {uploadStatus === 'error' && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{uploadProgress || 'Upload failed. Please try again.'}</p>
                </div>
              )}

              {importedEEGFiles.length > 0 && (
                <div className="border-t pt-4">
                  <button
                    className="text-xs text-cyan-600 hover:underline"
                    onClick={() => setShowImportHistory((h) => !h)}
                  >
                    {showImportHistory ? 'Hide' : 'Show'} import history (
                    {importedEEGFiles.length} file
                    {importedEEGFiles.length !== 1 ? 's' : ''})
                  </button>
                  {showImportHistory && (
                    <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                      {importedEEGFiles.map((f, idx) => (
                        <div
                          key={f.id || idx}
                          className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1.5"
                        >
                          {f.status === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          )}
                          <span className="truncate flex-1">{f.filename}</span>
                          {f.patientName && (
                            <span className="text-gray-400 flex-shrink-0">→ {f.patientName}</span>
                          )}
                          <span className="text-gray-400 flex-shrink-0">
                            {formatImportDate(f.importedAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={resetDialog}
                  className="flex-1"
                  disabled={uploadStatus === 'uploading'}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || uploadStatus === 'uploading'}
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700"
                >
                  {uploadStatus === 'uploading' ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading…
                    </span>
                  ) : uploadStatus === 'error' ? (
                    'Retry Upload'
                  ) : (
                    'Upload & Import'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDeviceDialog} onOpenChange={setShowDeviceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select EEG Device</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-gray-600">
              Choose an EEG device to connect to the training system
            </p>
            <div className="space-y-2">
              {EEG_DEVICES.map((device) => (
                <button
                  key={device.id}
                  onClick={() => handleConnectDevice(device)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    connectedDevice.id === device.id && isDeviceConnected
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-gray-200 hover:border-cyan-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{device.name}</p>
                      <p className="text-xs text-gray-500">{device.channels} channels</p>
                    </div>
                    {connectedDevice.id === device.id && isDeviceConnected && (
                      <Badge className="bg-green-100 text-green-700">Connected</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {isDeviceConnected && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={handleDisconnectDevice}
                  className="w-full text-red-600 hover:bg-red-50"
                >
                  Disconnect Device
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}