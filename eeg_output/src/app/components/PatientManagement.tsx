import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Plus, Search, Edit, Trash2, Eye, AlertCircle, RefreshCw } from 'lucide-react';
import { Badge } from './ui/badge';
import { Patient, patientService } from '../../services/patients';
import { toast } from 'sonner';

interface PatientManagementProps {
  onViewPatient: (patientId: string) => void;
  accessToken: string;
  patients: Patient[];
  onDataChange: () => Promise<void>;
}

export function PatientManagement({
  onViewPatient,
  accessToken,
  patients,
  onDataChange,
}: PatientManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '',
    condition: '',
    doctorNotes: '',
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.condition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await onDataChange();
    setRefreshing(false);
    toast.success('Patient list refreshed');
  };

  // ── Add Patient ─────────────────────────────────────────────────────────────
  const handleAddPatient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setAddError(null);

    if (!newPatient.name.trim() || !newPatient.age || !newPatient.condition.trim()) {
      setAddError('Please fill in all required fields (Name, Age, Condition).');
      return;
    }
    if (!accessToken) {
      setAddError('Authentication error. Please sign in again.');
      return;
    }

    setLoading(true);

    try {
      const result = await patientService.addPatient(accessToken, {
        name: newPatient.name.trim(),
        age: parseInt(newPatient.age),
        condition: newPatient.condition.trim(),
        doctorNotes: newPatient.doctorNotes.trim() || undefined,
      });

      // addPatient now throws on failure, so if we reach here it succeeded
      toast.success(`Patient "${result.name}" added successfully`);
      setNewPatient({ name: '', age: '', condition: '', doctorNotes: '' });
      setIsAddDialogOpen(false);
      await onDataChange();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error occurred';
      console.error('Add patient error:', err);
      setAddError(msg);
      toast.error('Could not save patient — please try again');
    }

    setLoading(false);
  };

  // ── Edit Patient ────────────────────────────────────────────────────────────
  const handleEditPatient = (patient: Patient) => {
    setEditingPatient({ ...patient });
    setEditError(null);
    setIsEditDialogOpen(true);
  };

  const handleUpdatePatient = async () => {
    if (!editingPatient || !accessToken) return;

    setEditError(null);

    if (!editingPatient.name.trim() || !editingPatient.condition.trim()) {
      setEditError('Name and Condition are required.');
      return;
    }

    setLoading(true);

    const result = await patientService.updatePatient(accessToken, editingPatient.id, {
      name: editingPatient.name.trim(),
      age: editingPatient.age,
      condition: editingPatient.condition.trim(),
      doctorNotes: editingPatient.doctorNotes,
    });

    if (result) {
      toast.success('Patient updated successfully');
      setIsEditDialogOpen(false);
      setEditingPatient(null);
      await onDataChange();
    } else {
      setEditError('Failed to update patient. Please check your connection and try again.');
      toast.error('Could not update patient — please try again');
    }

    setLoading(false);
  };

  // ── Delete Patient ──────────────────────────────────────────────────────────
  const handleDeleteClick = (patientId: string) => {
    setDeletingPatientId(patientId);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPatientId) return;

    setLoading(true);
    setIsDeleteConfirmOpen(false);

    try {
      await patientService.deletePatient(accessToken, deletingPatientId);
      toast.success('Patient and associated records deleted');
      await onDataChange();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete patient';
      console.error('Delete patient error:', err);
      toast.error(`Delete failed: ${msg}`);
    }

    setDeletingPatientId(null);
    setLoading(false);
  };

  const deletingPatientName =
    deletingPatientId
      ? patients.find((p) => p.id === deletingPatientId)?.name || 'this patient'
      : 'this patient';

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Patient Management</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700"
                onClick={() => {
                  setAddError(null);
                  setNewPatient({ name: '', age: '', condition: '', doctorNotes: '' });
                  setIsAddDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Patient
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name or condition…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Last Accuracy</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="text-gray-400 space-y-2">
                        <p className="text-sm">No patients in the system yet.</p>
                        <p className="text-xs">
                          Click "Add Patient" to register the first patient, or refresh to load existing data.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500 text-sm">
                      No patients match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPatients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="text-gray-500 text-xs font-mono">
                        {patient.id}
                      </TableCell>
                      <TableCell className="text-gray-900 font-medium">{patient.name}</TableCell>
                      <TableCell className="text-gray-600">{patient.age}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {patient.condition}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            patient.lastSessionAccuracy >= 80
                              ? 'bg-green-100 text-green-700'
                              : patient.lastSessionAccuracy >= 70
                              ? 'bg-blue-100 text-blue-700'
                              : patient.lastSessionAccuracy > 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }
                        >
                          {patient.lastSessionAccuracy > 0
                            ? `${patient.lastSessionAccuracy}%`
                            : 'No data'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => onViewPatient(patient.id)}>
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEditPatient(patient)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50 hover:border-red-300"
                            onClick={() => handleDeleteClick(patient.id)}
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredPatients.length} of {patients.length} patients
          </div>
        </CardContent>
      </Card>

      {/* ── Add Patient Dialog ──────────────────────────────────────────────── */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        if (!open) { setAddError(null); setNewPatient({ name: '', age: '', condition: '', doctorNotes: '' }); }
        setIsAddDialogOpen(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Patient</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPatient} className="space-y-4 mt-4">
            {addError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{addError}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="add-name">Patient Name *</Label>
              <Input
                id="add-name"
                value={newPatient.name}
                onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                placeholder="Enter patient full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-age">Age *</Label>
              <Input
                id="add-age"
                type="number"
                min="1"
                max="120"
                value={newPatient.age}
                onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                placeholder="Enter age"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-condition">Medical Condition *</Label>
              <Input
                id="add-condition"
                value={newPatient.condition}
                onChange={(e) => setNewPatient({ ...newPatient, condition: e.target.value })}
                placeholder="e.g., Stroke Recovery"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-notes">Doctor Notes</Label>
              <Textarea
                id="add-notes"
                value={newPatient.doctorNotes}
                onChange={(e) => setNewPatient({ ...newPatient, doctorNotes: e.target.value })}
                placeholder="Initial clinical notes (optional)"
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700"
                disabled={!newPatient.name || !newPatient.age || !newPatient.condition || loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : (
                  'Add Patient'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setAddError(null);
                  setNewPatient({ name: '', age: '', condition: '', doctorNotes: '' });
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Patient Dialog ─────────────────────────────────────────────── */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (!open) { setEditError(null); setEditingPatient(null); }
        setIsEditDialogOpen(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
          </DialogHeader>
          {editingPatient && (
            <div className="space-y-4 mt-4">
              {editError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{editError}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Patient Name *</Label>
                <Input
                  id="edit-name"
                  value={editingPatient.name}
                  onChange={(e) => setEditingPatient({ ...editingPatient, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-age">Age *</Label>
                <Input
                  id="edit-age"
                  type="number"
                  min="1"
                  max="120"
                  value={editingPatient.age}
                  onChange={(e) =>
                    setEditingPatient({ ...editingPatient, age: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-condition">Medical Condition *</Label>
                <Input
                  id="edit-condition"
                  value={editingPatient.condition}
                  onChange={(e) =>
                    setEditingPatient({ ...editingPatient, condition: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Doctor Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editingPatient.doctorNotes}
                  onChange={(e) =>
                    setEditingPatient({ ...editingPatient, doctorNotes: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  onClick={handleUpdatePatient}
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setIsEditDialogOpen(false); setEditingPatient(null); }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ───────────────────────────────────────────── */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <p className="text-sm text-gray-700">
              Are you sure you want to permanently delete <strong>{deletingPatientName}</strong>?
              This will also remove all associated training sessions and EEG files.
            </p>
            <p className="text-xs text-red-600 font-medium">This action cannot be undone.</p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsDeleteConfirmOpen(false); setDeletingPatientId(null); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDeleteConfirm}
                disabled={loading}
              >
                {loading ? 'Deleting…' : 'Delete Patient'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}