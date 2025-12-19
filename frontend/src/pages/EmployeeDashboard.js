import { useState } from 'react';
import { Clock, Calendar, Receipt, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TimesheetManagement from '@/components/TimesheetManagement';
import LeaveManagement from '@/components/LeaveManagement';
import ReimbursementManagement from '@/components/ReimbursementManagement';
import Profile from '@/components/Profile';

const EmployeeDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('timesheets');

  const menuItems = [
    { id: 'timesheets', label: 'My Timesheets', icon: Clock },
    { id: 'leaves', label: 'Leave Management', icon: Calendar },
    { id: 'reimbursements', label: 'Reimbursements', icon: Receipt },
    { id: 'profile', label: 'My Profile', icon: User },
  ];

  return (
    <div className="flex min-h-screen" data-testid="employee-dashboard">
      <aside className="sidebar">
        <div className="mb-8">
          <h1 className="text-xl font-bold">Employee Portal</h1>
          <p className="text-sm text-blue-200 mt-1">{user.name}</p>
          <p className="text-xs text-blue-300">{user.email}</p>
        </div>
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left ${activeTab === item.id ? 'active bg-white/20' : ''}`}
                data-testid={`nav-${item.id}`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <Button
          onClick={onLogout}
          variant="ghost"
          className="w-full mt-8 text-white hover:bg-white/10"
          data-testid="logout-button"
        >
          <LogOut size={20} className="mr-2" />
          Logout
        </Button>
      </aside>
      <main className="main-content">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'timesheets' && <TimesheetManagement user={user} />}
          {activeTab === 'leaves' && <LeaveManagement user={user} />}
          {activeTab === 'reimbursements' && <ReimbursementManagement user={user} />}
          {activeTab === 'profile' && <Profile user={user} />}
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboard;
