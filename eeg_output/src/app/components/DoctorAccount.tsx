import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { UserCircle, Mail, Building, Briefcase, Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface DoctorAccountProps {
  user: { id: string; email: string; name: string };
  accessToken?: string | null;
}

export function DoctorAccount({ user, accessToken }: DoctorAccountProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [doctorInfo, setDoctorInfo] = useState({
    id: user.id,
    name: user.name,
    email: user.email,
    hospital: 'Central Medical Center',
    department: 'Neurology & Rehabilitation'
  });

  const handleSave = () => {
    setIsEditing(false);
    toast.success('Profile updated successfully');
    console.log('Saving doctor info:', doctorInfo);
  };

  const handleCancel = () => {
    setDoctorInfo({
      id: user.id,
      name: user.name,
      email: user.email,
      hospital: 'Central Medical Center',
      department: 'Neurology & Rehabilitation'
    });
    setIsEditing(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-gray-900">Doctor Account</h2>
          <p className="text-sm text-gray-500">Manage your profile and settings</p>
        </div>
        {!isEditing && (
          <Button
            className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        )}
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 bg-gradient-to-br from-cyan-100 to-teal-100 rounded-full flex items-center justify-center">
              <UserCircle className="w-16 h-16 text-cyan-600" />
            </div>
            <div>
              <p className="text-xl text-gray-900">{doctorInfo.name}</p>
              <p className="text-sm text-gray-500">ID: {doctorInfo.id.substring(0, 8)}</p>
            </div>
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-gray-500" />
                Full Name
              </Label>
              <Input
                id="name"
                value={doctorInfo.name}
                onChange={(e) => setDoctorInfo({ ...doctorInfo, name: e.target.value })}
                disabled={!isEditing}
                className={!isEditing ? 'bg-gray-50' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-500" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={doctorInfo.email}
                onChange={(e) => setDoctorInfo({ ...doctorInfo, email: e.target.value })}
                disabled={!isEditing}
                className={!isEditing ? 'bg-gray-50' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hospital" className="flex items-center gap-2">
                <Building className="w-4 h-4 text-gray-500" />
                Hospital
              </Label>
              <Input
                id="hospital"
                value={doctorInfo.hospital}
                onChange={(e) => setDoctorInfo({ ...doctorInfo, hospital: e.target.value })}
                disabled={!isEditing}
                className={!isEditing ? 'bg-gray-50' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department" className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-gray-500" />
                Department
              </Label>
              <Input
                id="department"
                value={doctorInfo.department}
                onChange={(e) => setDoctorInfo({ ...doctorInfo, department: e.target.value })}
                disabled={!isEditing}
                className={!isEditing ? 'bg-gray-50' : ''}
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-3 pt-4">
              <Button
                className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700"
                onClick={handleSave}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Settings */}
      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-900">EEG Device Configuration</p>
              <p className="text-xs text-gray-500">Configure EEG headset settings</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.info('Feature coming soon')}>Configure</Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-900">Training Parameters</p>
              <p className="text-xs text-gray-500">Adjust default training settings</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.info('Feature coming soon')}>Adjust</Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-900">Data Export</p>
              <p className="text-xs text-gray-500">Export session data and reports</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.success('Exporting data...')}>Export</Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-900">Security Settings</p>
              <p className="text-xs text-gray-500">Change password and security options</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.info('Feature coming soon')}>Manage</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}