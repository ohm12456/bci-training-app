import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Activity, TrendingUp, Users, CheckCircle, Wifi, Signal } from 'lucide-react';
import { Badge } from './ui/badge';
import { Patient, TrainingSession } from '../../services/patients';

interface DashboardProps {
  onNavigate: (page: string, patientId?: string) => void;
  patients: Patient[];
  sessions: TrainingSession[];
}

export function Dashboard({ onNavigate, patients, sessions }: DashboardProps) {
  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const totalPatients = patients.length;
  
  // Find highest accuracy patient
  const highestAccuracyPatient = patients.reduce((highest, current) => {
    return (current.lastSessionAccuracy > (highest?.lastSessionAccuracy || 0)) ? current : highest;
  }, patients[0]);

  const totalSessions = sessions.length;

  return (
    <div className="p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">EEG Device Status</CardTitle>
            <Wifi className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 mb-1">Connected</div>
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Signal Quality</CardTitle>
            <Signal className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 mb-1">Excellent</div>
            <p className="text-xs text-gray-500">95% signal strength</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Active Patients</CardTitle>
            <Users className="w-4 h-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 mb-1">{totalPatients}</div>
            <p className="text-xs text-gray-500">Under your care</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => highestAccuracyPatient && onNavigate('patientDetail', highestAccuracyPatient.id)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Highest Accuracy</CardTitle>
            <TrendingUp className="w-4 h-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            {highestAccuracyPatient ? (
              <>
                <div className="text-2xl text-gray-900 mb-1">{highestAccuracyPatient.lastSessionAccuracy.toFixed(1)}%</div>
                <p className="text-xs text-green-600 font-medium">{highestAccuracyPatient.name}</p>
              </>
            ) : (
              <>
                <div className="text-2xl text-gray-900 mb-1">--%</div>
                <p className="text-xs text-gray-500">No data yet</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Start Training */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-600" />
              Quick Start
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Begin a new BCI training session with a patient. Ensure the EEG device is properly connected and calibrated.
            </p>
            <Button 
              size="lg"
              className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white h-14"
              onClick={() => onNavigate('training')}
            >
              <Activity className="w-5 h-5 mr-2" />
              Start Training Session
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline"
                onClick={() => onNavigate('patients')}
              >
                <Users className="w-4 h-4 mr-2" />
                View Patients
              </Button>
              <Button 
                variant="outline"
                onClick={() => onNavigate('reports')}
              >
                View Reports
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Today's Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Sessions</span>
              <span className="text-sm text-gray-900">{sessions.filter(s => {
                const sessionDate = new Date(s.date);
                const today = new Date();
                return sessionDate.toDateString() === today.toDateString();
              }).length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Patients</span>
              <span className="text-sm text-gray-900">{totalPatients}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Sessions</span>
              <span className="text-sm text-gray-900">{totalSessions}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg Success Rate</span>
              <span className="text-sm text-green-600">
                {sessions.length > 0 
                  ? (sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length).toFixed(1) + '%'
                  : 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Latest Training Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentSessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No training sessions yet</p>
                <p className="text-sm mt-2">Start a training session to see data here</p>
              </div>
            ) : (
              recentSessions.map((session) => {
                const patient = patients.find(p => p.id === session.patientId);
                if (!patient) return null;

                return (
                  <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-100 to-teal-100 rounded-full flex items-center justify-center">
                        <span className="text-sm text-cyan-700">{patient.name.split(' ').map(n => n[0]).join('')}</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-900">{patient.name}</p>
                        <p className="text-xs text-gray-500">{new Date(session.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-900">{session.totalTrials} trials</p>
                        <p className="text-xs text-gray-500">{Math.floor(session.duration / 60)} minutes</p>
                      </div>
                      <Badge 
                        className={
                          session.accuracy >= 80 ? 'bg-green-100 text-green-700' :
                          session.accuracy >= 70 ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }
                      >
                        {session.accuracy}%
                      </Badge>
                      <CheckCircle className={
                        session.accuracy >= 75 ? 'w-5 h-5 text-green-500' : 'w-5 h-5 text-gray-400'
                      } />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
