import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Calendar, Briefcase, Users, FileText } from 'lucide-react';

const Profile = ({ user }) => {
  return (
    <div data-testid="profile">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h2>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={20} />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-600">Full Name</p>
              <p className="text-base" data-testid="profile-name">{user.name}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Email</p>
              <p className="text-base" data-testid="profile-email">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Date of Birth</p>
              <p className="text-base" data-testid="profile-dob">{user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString() : 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Date of Joining</p>
              <p className="text-base" data-testid="profile-doj">{user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString() : 'Not set'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase size={20} />
              Professional Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-600">Role</p>
              <p className="text-base capitalize" data-testid="profile-role">{user.role}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Designation</p>
              <p className="text-base" data-testid="profile-designation">{user.designation || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Practice/Department</p>
              <p className="text-base" data-testid="profile-practice">{user.practice || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Leave Balance</p>
              <p className="text-base font-semibold text-green-600" data-testid="profile-leave-balance">{user.leave_balance || 0} days</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
