import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ArrowLeft, Play, Square, CheckCircle, XCircle, Clock, FlaskConical } from 'lucide-react';
import { EEGVisualization } from './EEGVisualization';
import { Patient } from '../../services/patients';
import { EEGChannelData } from '../types';

interface TrainingSessionProps {
  initialPatientId?: string;
  onBack: () => void;
  onComplete: (sessionData: SessionData) => void;
  patients: Patient[];
  eegData?: EEGChannelData | null;
}

export interface SessionData {
  patientId: string;
  totalTrials: number;
  correctPredictions: number;
  accuracy: number;
  duration: number;
  trainingMode?: 'LEFT_HAND' | 'RIGHT_HAND';
  trialCount?: number;
  status?: 'completed' | 'pending_analysis' | 'failed';
  sourceFile?: string;
}

type TrainingPhase = 'idle' | 'instruction' | 'countdown' | 'acquisition' | 'result';
type Task = 'LEFT_HAND' | 'RIGHT_HAND';

interface Trial {
  expectedTask: Task;
  predictedTask: Task;
  correct: boolean;
}

const TRIAL_COUNT_OPTIONS = [5, 10, 15, 20, 30];

export function TrainingSession({ initialPatientId, onBack, onComplete, patients, eegData }: TrainingSessionProps) {
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || '');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [phase, setPhase] = useState<TrainingPhase>('idle');
  const [currentTask, setCurrentTask] = useState<Task>('LEFT_HAND');
  const [countdown, setCountdown] = useState(3);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [currentTrialNumber, setCurrentTrialNumber] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  // Setup modal state
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [trainingMode, setTrainingMode] = useState<'LEFT_HAND' | 'RIGHT_HAND'>('LEFT_HAND');
  const [totalTrials, setTotalTrials] = useState(20);

  const patient = patients.find(p => p.id === selectedPatientId);
  const correctCount = trials.filter(t => t.correct).length;
  const accuracy = trials.length > 0 ? (correctCount / trials.length) * 100 : 0;

  useEffect(() => {
    if (!isSessionActive || phase !== 'instruction') return;
    const timer = setTimeout(() => { setPhase('countdown'); setCountdown(3); }, 2000);
    return () => clearTimeout(timer);
  }, [phase, isSessionActive]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setPhase('acquisition');
      const timer = setTimeout(() => {
        const predicted: Task = Math.random() > 0.25 ? currentTask : (currentTask === 'LEFT_HAND' ? 'RIGHT_HAND' : 'LEFT_HAND');
        const newTrial: Trial = { expectedTask: currentTask, predictedTask: predicted, correct: predicted === currentTask };
        setTrials(prev => [...prev, newTrial]);
        setPhase('result');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [phase, countdown, currentTask]);

  useEffect(() => {
    if (phase !== 'result') return;
    const currentTrials = trials;
    const timer = setTimeout(() => {
      if (currentTrialNumber < totalTrials - 1) {
        setCurrentTrialNumber(n => n + 1);
        setCurrentTask(trainingMode);
        setPhase('instruction');
      } else {
        const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
        const finalCorrect = currentTrials.filter(t => t.correct).length;
        const finalAccuracy = currentTrials.length > 0 ? (finalCorrect / currentTrials.length) * 100 : 0;
        onComplete({
          patientId: selectedPatientId,
          totalTrials: currentTrials.length,
          correctPredictions: finalCorrect,
          accuracy: Math.round(finalAccuracy * 10) / 10,
          duration,
          trainingMode,
          trialCount: totalTrials,
          status: 'pending_analysis',
          sourceFile: eegData ? 'imported_eeg' : undefined,
        });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [phase, currentTrialNumber, totalTrials]);

  const openSetupModal = () => { if (selectedPatientId) setShowSetupModal(true); };

  const confirmSetupAndStart = () => {
    setShowSetupModal(false);
    setIsSessionActive(true);
    setTrials([]);
    setCurrentTrialNumber(0);
    setSessionStartTime(Date.now());
    setCurrentTask(trainingMode);
    setPhase('instruction');
  };

  const stopSession = () => { setIsSessionActive(false); setPhase('idle'); };

  const lastTrial = trials[trials.length - 1];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>
          <div>
            <h2 className="text-2xl text-gray-900">Training Session</h2>
            <p className="text-sm text-gray-500">Motor Imagery BCI Training</p>
          </div>
        </div>
        {!isSessionActive && selectedPatientId && (
          <Button className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700" onClick={openSetupModal}>
            <Play className="w-4 h-4 mr-2" />Start Session
          </Button>
        )}
        {isSessionActive && (
          <Button variant="destructive" onClick={stopSession}>
            <Square className="w-4 h-4 mr-2" />Stop Session
          </Button>
        )}
      </div>

      {!isSessionActive && (
        <Card>
          <CardHeader><CardTitle className="text-base">Select Patient</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a patient for training" />
              </SelectTrigger>
              <SelectContent>
                {patients.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} - {p.condition}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {isSessionActive && patient && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-gray-500">Patient</p>
                  <p className="text-lg text-gray-900">{patient.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Training Hand</p>
                  <Badge className={trainingMode === 'LEFT_HAND' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                    {trainingMode === 'LEFT_HAND' ? '← Left Hand' : 'Right Hand →'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Trial Progress</p>
                  <p className="text-lg text-gray-900">{currentTrialNumber + 1} / {totalTrials}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Current Accuracy</p>
                  <p className="text-lg text-gray-900">{accuracy.toFixed(1)}%</p>
                </div>
              </div>
              <Progress value={(currentTrialNumber / totalTrials) * 100} className="mt-4 h-2" />
            </CardContent>
          </Card>

          <EEGVisualization isRecording={phase === 'acquisition'} eegData={eegData} />

          <Card>
            <CardContent className="pt-6">
              <div className="min-h-[300px] flex flex-col items-center justify-center">
                {phase === 'instruction' && (
                  <div className="text-center space-y-4">
                    <p className="text-sm text-gray-600">Prepare to imagine:</p>
                    <div className={`text-6xl p-8 rounded-2xl ${currentTask === 'LEFT_HAND' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {currentTask === 'LEFT_HAND' ? '← LEFT HAND' : 'RIGHT HAND →'}
                    </div>
                  </div>
                )}
                {phase === 'countdown' && (
                  <div className="text-center space-y-4">
                    <p className="text-sm text-gray-600">Get ready...</p>
                    <div className="text-8xl text-gray-900 animate-pulse">{countdown}</div>
                  </div>
                )}
                {phase === 'acquisition' && (
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-lg text-gray-900">Imagine {currentTask.replace('_', ' ')}</p>
                    <p className="text-sm text-gray-600">Recording brain signals...</p>
                  </div>
                )}
                {phase === 'result' && lastTrial && (
                  <div className="text-center space-y-6 w-full max-w-xl">
                    <div className={`flex items-center justify-center gap-3 p-6 rounded-2xl ${lastTrial.correct ? 'bg-green-100' : 'bg-red-100'}`}>
                      {lastTrial.correct ? <CheckCircle className="w-12 h-12 text-green-600" /> : <XCircle className="w-12 h-12 text-red-600" />}
                      <div className="text-left">
                        <p className={`text-2xl ${lastTrial.correct ? 'text-green-900' : 'text-red-900'}`}>{lastTrial.correct ? 'Success!' : 'Incorrect'}</p>
                        <p className={`text-sm ${lastTrial.correct ? 'text-green-700' : 'text-red-700'}`}>Prediction: {lastTrial.predictedTask.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Expected Task</p>
                        <p className="text-sm text-gray-900">{lastTrial.expectedTask.replace('_', ' ')}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Model Prediction</p>
                        <p className="text-sm text-gray-900">{lastTrial.predictedTask.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <FlaskConical className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-xs text-amber-700"><span className="font-medium">Analysis pending</span> — EEG model pipeline not yet integrated. Results are simulated.</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-6 text-center"><p className="text-sm text-gray-500">Trials Completed</p><p className="text-3xl text-gray-900">{trials.length}</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><p className="text-sm text-gray-500">Correct Predictions</p><p className="text-3xl text-green-600">{correctCount}</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><p className="text-sm text-gray-500">Current Accuracy</p><p className="text-3xl text-cyan-600">{accuracy.toFixed(1)}%</p></CardContent></Card>
          </div>
        </>
      )}

      {/* Training Setup Modal */}
      <Dialog open={showSetupModal} onOpenChange={setShowSetupModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Training Setup</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-2">
            <p className="text-sm text-gray-600">
              Configure the training session for <span className="font-medium text-gray-900">{patient?.name ?? 'this patient'}</span>.
            </p>

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Training Hand</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTrainingMode('LEFT_HAND')}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${trainingMode === 'LEFT_HAND' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                >
                  <div className="text-2xl mb-1">←</div>
                  <div className="text-sm font-medium">Left Hand</div>
                </button>
                <button
                  onClick={() => setTrainingMode('RIGHT_HAND')}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${trainingMode === 'RIGHT_HAND' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                >
                  <div className="text-2xl mb-1">→</div>
                  <div className="text-sm font-medium">Right Hand</div>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Number of Trials</p>
              <div className="flex flex-wrap gap-2">
                {TRIAL_COUNT_OPTIONS.map(count => (
                  <button
                    key={count}
                    onClick={() => setTotalTrials(count)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${totalTrials === count ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Estimated duration: ~{Math.ceil(totalTrials * 0.4)} minutes
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
              <p className="text-gray-700"><span className="font-medium">Hand:</span> {trainingMode === 'LEFT_HAND' ? 'Left Hand ←' : 'Right Hand →'}</p>
              <p className="text-gray-700"><span className="font-medium">Trials:</span> {totalTrials}</p>
              {eegData && <p className="text-gray-500 text-xs">EEG source: imported file (simulated live playback)</p>}
            </div>

            <div className="flex gap-3">
              <Button className="flex-1 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700" onClick={confirmSetupAndStart}>
                <Play className="w-4 h-4 mr-2" />Start Training
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowSetupModal(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
