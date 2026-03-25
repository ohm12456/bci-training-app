import { useState, useEffect, useCallback, useRef } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { SignupScreen } from './components/SignupScreen';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Dashboard } from './components/Dashboard';
import { PatientManagement } from './components/PatientManagement';
import { PatientDetail } from './components/PatientDetail';
import { TrainingSession, SessionData } from './components/TrainingSession';
import { SessionSummary } from './components/SessionSummary';
import { ReportsPage } from './components/ReportsPage';
import { DoctorAccount } from './components/DoctorAccount';
import { supabase } from '../utils/supabase';
import { patientService, Patient, SessionRecord as Session } from '../services/patients';
import { Toaster, toast } from 'sonner';
import { ImportedEEGFile, EEGChannelData } from './types';

type Page =
  | 'dashboard'
  | 'patients'
  | 'patientDetail'
  | 'training'
  | 'sessionSummary'
  | 'reports'
  | 'account';
type AuthScreen = 'login' | 'signup';

export default function App() {
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [importedEEGFiles, setImportedEEGFiles] = useState<ImportedEEGFile[]>([]);
  const [activeEEGData, setActiveEEGData] = useState<EEGChannelData | null>(null);

  // Track which token we've already loaded data for (avoid double-loads)
  const loadedForToken = useRef<string | null>(null);

  // ── Load patients (backend only – no mock fallback) ───────────────────────
  const loadPatients = useCallback(
    async (token?: string) => {
      const authToken = token || accessToken;
      if (!authToken) return;
      try {
        // const data = await patientService.getPatients(authToken);
        // console.log(`Patient ${JSON.stringify(data)}`)
        let { data, error } = await supabase.from('patients').select('*');

        if (error) {
          throw error;
        }

        const mappedPatients = (data || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          age: row.age,
          condition: row.medical_condition || '',
          doctorNotes: row.doctor_notes || '',
          createdAt: row.created_at || new Date().toISOString(),
          lastSessionAccuracy: row.last_session_accuracy ?? 0,
        }));

        setPatients(mappedPatients);
      } catch (err) {
        // getPatients now throws with the real server error message
        const msg = err instanceof Error ? err.message : 'Failed to load patient data';
        console.error('Error loading patients:', msg);
        toast.error(msg, { id: 'load-patients-err' });
        setPatients([]);
      }
    },
    [accessToken]
  );

  // ── Load sessions (backend only – no mock fallback) ───────────────────────
  const loadSessions = useCallback(
    async (token?: string) => {
      const authToken = token || accessToken;
      if (!authToken) return;
      try {
        const data = await patientService.getAllSessions(authToken);
        setSessions(data || []);
      } catch (err) {
        console.error('Error loading sessions:', err);
        toast.error('Failed to load session data. Please refresh the page.', {
          id: 'load-sessions-err',
        });
      }
    },
    [accessToken]
  );

  // ── Auth state listener (session restore, OAuth redirect, token refresh) ──
  useEffect(() => {
    // First, check for an existing session before subscribing to changes
    let cancelled = false;

    const restoreSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error) {
        console.error('Session restore error:', error.message);
        setLoading(false);
        return;
      }

      if (session) {
        const userData = {
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name || session.user.email!.split('@')[0],
        };
        setUser(userData);
        setAccessToken(session.access_token);
        setIsLoggedIn(true);
        console.log('Session restored for user:', userData.email);
      }
      setLoading(false);
    };

    restoreSession();

    // Then subscribe to future changes (token refresh, sign-out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, '| session:', session ? 'present' : 'null');

      if (session) {
        const userData = {
          id: session.user.id,
          email: session.user.email!,
          name:
            session.user.user_metadata?.name || session.user.email!.split('@')[0],
        };
        setUser(userData);
        setAccessToken(session.access_token);
        setIsLoggedIn(true);
      } else {
        setUser(null);
        setAccessToken(null);
        setIsLoggedIn(false);
        setPatients([]);
        setSessions([]);
        setImportedEEGFiles([]);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // ── Load data whenever we have a new valid token ───────────────────────────
  useEffect(() => {
    if (isLoggedIn && accessToken && loadedForToken.current !== accessToken) {
      loadedForToken.current = accessToken;
      loadPatients(accessToken);
      loadSessions(accessToken);
      // Restore EEG file history from localStorage
      try {
        const raw = localStorage.getItem('bci_eeg_files');
        if (raw) {
          const files = JSON.parse(raw) as ImportedEEGFile[];
          setImportedEEGFiles(files);
        }
      } catch {}
    }
    if (!isLoggedIn) {
      loadedForToken.current = null;
    }
  }, [isLoggedIn, accessToken, loadPatients, loadSessions]);

  // ── Debug helpers on window ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !accessToken) return;

    (window as any).debugBCI = {
      checkUserData: async () => {
        const data = await patientService.debugUserData(accessToken);
        console.log('=== USER DATA DEBUG ===', data);
        return data;
      },
      reseedData: async () => {
        const result = await patientService.reseedData(accessToken);
        console.log('=== RESEED RESULT ===', result);
        if (result && !result.error) {
          toast.success(`Reseeded ${result.patientsCreated} patients with sample data`);
          await loadPatients(accessToken);
          await loadSessions(accessToken);
        } else {
          toast.error('Failed to reseed data');
        }
        return result;
      },
      reloadData: async () => {
        await loadPatients(accessToken);
        await loadSessions(accessToken);
        toast.success('Data reloaded');
      },
    };
    console.log('Debug: window.debugBCI.checkUserData() | .reseedData() | .reloadData()');
  }, [accessToken, loadPatients, loadSessions]);

  // Reload both after any mutation
  const handleDataChange = async () => {
    if (!accessToken) return;
    await Promise.all([loadPatients(accessToken), loadSessions(accessToken)]);
  };

  // ── Auth handlers ──────────────────────────────────────────────────────────
  // Called by LoginScreen / SignupScreen immediately after successful auth
  const handleLogin = (
    token: string,
    userData: { id: string; email: string; name: string }
  ) => {
    // onAuthStateChange will also fire, but setting state here gives instant UI update
    setAccessToken(token);
    setUser(userData);
    setIsLoggedIn(true);
    toast.success(`Welcome back, ${userData.name}!`);
  };

  const handleSignup = (
    token: string,
    userData: { id: string; email: string; name: string }
  ) => {
    setAccessToken(token);
    setUser(userData);
    setIsLoggedIn(true);
    toast.success(`Welcome to BCI Training System, ${userData.name}!`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange will clear user/token state
    setCurrentPage('dashboard');
    setSelectedPatientId(undefined);
    setSessionData(null);
    toast.success('Signed out successfully');
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNavigate = (page: string, patientId?: string) => {
    setCurrentPage(page as Page);
    if (patientId) setSelectedPatientId(patientId);
  };

  const handleViewPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    setCurrentPage('patientDetail');
  };

  const handleStartTraining = (patientId?: string) => {
    if (patientId) setSelectedPatientId(patientId);
    setCurrentPage('training');
  };

  // ── Training session completion – saves to backend with proper error ────────
  const handleSessionComplete = async (data: SessionData) => {
    let saveSucceeded = false;

    if (accessToken && data.patientId) {
      try {
        const saved = await patientService.addSession(accessToken, data.patientId, {
          date: new Date().toISOString(),
          totalTrials: data.totalTrials,
          correctPredictions: data.correctPredictions,
          accuracy: data.accuracy,
          duration: data.duration,
          trainingMode: data.trainingMode,
          trialCount: data.trialCount,
          status: data.status || 'pending_analysis',
          sourceFile: data.sourceFile,
        });

        if (saved) {
          saveSucceeded = true;
          await handleDataChange();
        } else {
          toast.error(
            'Session completed but could not be saved to the database. ' +
              'Please note the results and check your connection.',
            { duration: 8000 }
          );
        }
      } catch (err) {
        console.error('Failed to save training session:', err);
        toast.error(
          'Session completed but saving failed due to a network error. ' +
            'Please note the results manually.',
          { duration: 8000 }
        );
      }
    }

    if (!data.patientId) {
      toast.info('Session completed without a patient assigned — data not saved.');
    } else if (saveSucceeded) {
      toast.success('Training session saved successfully!');
    }

    setSessionData(data);
    setCurrentPage('sessionSummary');
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
    setSelectedPatientId(undefined);
    setSessionData(null);
  };

  // ── EEG file callbacks from TopBar ─────────────────────────────────────────
  const EEG_FILES_KEY = 'bci_eeg_files';

  const handleEEGFileImported = (file: ImportedEEGFile) => {
    const withId: ImportedEEGFile = { ...file, id: `eeg_${Date.now()}_${Math.random().toString(36).slice(2)}` };
    setImportedEEGFiles((prev) => {
      const updated = [withId, ...prev];
      try { localStorage.setItem(EEG_FILES_KEY, JSON.stringify(updated.map(f => ({ ...f, file: undefined, previewData: undefined })))); } catch {}
      return updated;
    });
    if (file.previewData) {
      setActiveEEGData(file.previewData);
    }
  };

  const handleEEGFilesLoaded = (files: ImportedEEGFile[]) => {
    setImportedEEGFiles(files);
  };

  const handleDeleteEEGFile = (fileId: string) => {
    setImportedEEGFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      try { localStorage.setItem(EEG_FILES_KEY, JSON.stringify(updated.map(f => ({ ...f, file: undefined, previewData: undefined })))); } catch {}
      return updated;
    });
  };

  const handleSetActiveEEGFile = (file: ImportedEEGFile) => {
    if (file.previewData) setActiveEEGData(file.previewData);
  };

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard': return 'Dashboard';
      case 'patients': return 'Patient Management';
      case 'patientDetail': return 'Patient Details';
      case 'training': return 'Training Session';
      case 'sessionSummary': return 'Session Summary';
      case 'reports': return 'Reports & Analytics';
      case 'account': return 'Account Settings';
      default: return 'BCI Training System';
    }
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Auth screens ───────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    if (authScreen === 'signup') {
      return (
        <SignupScreen
          onSignup={handleSignup}
          onSwitchToLogin={() => setAuthScreen('login')}
        />
      );
    }
    return (
      <LoginScreen
        onLogin={handleLogin}
        onSwitchToSignup={() => setAuthScreen('signup')}
      />
    );
  }

  // ── Main application layout ────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="flex h-screen bg-gray-50">
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar
            title={getPageTitle()}
            accessToken={accessToken}
            patients={patients}
            importedEEGFiles={importedEEGFiles}
            activePatientId={selectedPatientId}
            onEEGFileImported={handleEEGFileImported}
            onEEGFilesLoaded={handleEEGFilesLoaded}
          />

          <main className="flex-1 overflow-y-auto">
            {currentPage === 'dashboard' && (
              <Dashboard
                onNavigate={handleNavigate}
                patients={patients}
                sessions={sessions}
              />
            )}

            {currentPage === 'patients' && accessToken && (
              <PatientManagement
                onViewPatient={handleViewPatient}
                accessToken={accessToken}
                patients={patients}
                onDataChange={handleDataChange}
              />
            )}

            {currentPage === 'patientDetail' && selectedPatientId && (
              <PatientDetail
                patientId={selectedPatientId}
                onBack={() => setCurrentPage('patients')}
                onStartTraining={handleStartTraining}
                patients={patients}
                sessions={sessions}
                importedEEGFiles={importedEEGFiles}
                onDeleteEEGFile={handleDeleteEEGFile}
                onSetActiveEEGFile={handleSetActiveEEGFile}
              />
            )}

            {currentPage === 'training' && (
              <TrainingSession
                initialPatientId={selectedPatientId}
                onBack={() => setCurrentPage('dashboard')}
                onComplete={handleSessionComplete}
                patients={patients}
                eegData={activeEEGData}
              />
            )}

            {currentPage === 'sessionSummary' && sessionData && (
              <SessionSummary
                sessionData={sessionData}
                onBackToDashboard={handleBackToDashboard}
                onNewSession={() => setCurrentPage('training')}
              />
            )}

            {currentPage === 'reports' && (
              <ReportsPage
                patients={patients}
                sessions={sessions}
                accessToken={accessToken}
              />
            )}

            {currentPage === 'account' && user && (
              <DoctorAccount user={user} accessToken={accessToken} />
            )}
          </main>
        </div>
      </div>
    </>
  );
}