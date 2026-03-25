import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CheckCircle, TrendingUp, Clock, Award, FlaskConical } from 'lucide-react';
import { SessionData } from './TrainingSession';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SessionSummaryProps {
  sessionData: SessionData;
  onBackToDashboard: () => void;
  onNewSession: () => void;
}

export function SessionSummary({ sessionData, onBackToDashboard, onNewSession }: SessionSummaryProps) {
  const incorrectPredictions = sessionData.totalTrials - sessionData.correctPredictions;

  const chartData = [
    { name: 'Correct', value: sessionData.correctPredictions, color: '#10b981' },
    { name: 'Incorrect', value: incorrectPredictions, color: '#ef4444' },
  ];

  const getPerformanceLevel = (accuracy: number) => {
    if (accuracy >= 80) return { level: 'Excellent', color: 'green' };
    if (accuracy >= 70) return { level: 'Good', color: 'blue' };
    if (accuracy >= 60) return { level: 'Fair', color: 'yellow' };
    return { level: 'Needs Improvement', color: 'red' };
  };

  const performance = getPerformanceLevel(sessionData.accuracy);
  const durationMinutes = Math.floor(sessionData.duration / 60);
  const durationSeconds = sessionData.duration % 60;
  const isPendingAnalysis = sessionData.status === 'pending_analysis' || !sessionData.status;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-cyan-100 to-teal-100 rounded-full mb-4">
          <CheckCircle className="w-10 h-10 text-cyan-600" />
        </div>
        <h2 className="text-3xl text-gray-900">Session Complete!</h2>
        <p className="text-gray-600">Training session finished successfully</p>
      </div>

      {/* Session meta */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-gray-500">Session Date</p>
              <p className="text-xl text-gray-900">{new Date().toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Training Hand</p>
              {sessionData.trainingMode ? (
                <Badge className={sessionData.trainingMode === 'LEFT_HAND' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                  {sessionData.trainingMode === 'LEFT_HAND' ? '← Left Hand' : 'Right Hand →'}
                </Badge>
              ) : <p className="text-sm text-gray-400">N/A</p>}
            </div>
            <div>
              <p className="text-sm text-gray-500">Duration</p>
              <p className="text-xl text-gray-900">{durationMinutes}m {durationSeconds}s</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Analysis Status</p>
              {isPendingAnalysis ? (
                <Badge className="bg-amber-100 text-amber-700">Pending Analysis</Badge>
              ) : (
                <Badge className="bg-green-100 text-green-700">Completed</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis pending notice */}
      {isPendingAnalysis && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <FlaskConical className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Analysis Pending</p>
            <p className="text-xs text-amber-700 mt-0.5">
              The EEG model pipeline is not yet integrated. Accuracy values below are simulated placeholders.
              Final results will be updated once the analysis pipeline is complete.
            </p>
          </div>
        </div>
      )}

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Total Trials</CardTitle>
            <Award className="w-4 h-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-gray-900">{sessionData.totalTrials}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Correct</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-green-600">{sessionData.correctPredictions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Accuracy (simulated)</CardTitle>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-cyan-600">{sessionData.accuracy.toFixed(1)}%</div>
            {isPendingAnalysis && <p className="text-xs text-amber-600 mt-1">Placeholder</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Performance</CardTitle>
            <Clock className="w-4 h-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <Badge
              className={
                performance.color === 'green' ? 'bg-green-100 text-green-700' :
                performance.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                performance.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }
            >
              {performance.level}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card>
        <CardHeader><CardTitle>Session Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Trials</p>
              <p className="text-2xl text-gray-900">{sessionData.totalTrials}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 mb-1">Correct Predictions</p>
              <p className="text-2xl text-green-700">{sessionData.correctPredictions}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-600 mb-1">Incorrect Predictions</p>
              <p className="text-2xl text-red-700">{incorrectPredictions}</p>
            </div>
            <div className="p-4 bg-cyan-50 rounded-lg">
              <p className="text-sm text-cyan-600 mb-1">Accuracy Rate {isPendingAnalysis ? '(simulated)' : ''}</p>
              <p className="text-2xl text-cyan-700">{sessionData.accuracy.toFixed(1)}%</p>
            </div>
          </div>

          {/* Source file info */}
          {sessionData.sourceFile && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
              EEG source: imported file (simulated live playback)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4 justify-center">
        <Button size="lg" variant="outline" onClick={onBackToDashboard}>
          Back to Dashboard
        </Button>
        <Button
          size="lg"
          className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700"
          onClick={onNewSession}
        >
          Start New Session
        </Button>
      </div>
    </div>
  );
}
