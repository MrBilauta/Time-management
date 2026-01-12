import { useState } from 'react';
import { Users, FolderKanban, FileText, DollarSign, BarChart3, LogOut, Clock, Calendar, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UserManagement from '@/components/UserManagement';
import ProjectManagement from '@/components/ProjectManagement';
import InvoiceManagement from '@/components/InvoiceManagement';
import TimesheetApprovals from '@/components/TimesheetApprovals';
import LeaveApprovals from '@/components/LeaveApprovals';
import ReimbursementApprovals from '@/components/ReimbursementApprovals';
import Reports from '@/components/Reports';

const AdminDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('users');

  const menuItems = [
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'timesheets', label: 'Timesheet Approvals', icon: Clock },
    { id: 'leaves', label: 'Leave Approvals', icon: Calendar },
    { id: 'reimbursements', label: 'Reimbursements', icon: Receipt },
    { id: 'invoices', label: 'Invoices', icon: DollarSign },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="flex min-h-screen" data-testid="admin-dashboard">
      <aside className="sidebar">
        <div className="mb-8">
          <h1 className="text-xl font-bold">Admin Portal</h1>
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
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'projects' && <ProjectManagement user={user} />}
          {activeTab === 'invoices' && <InvoiceManagement />}
          {activeTab === 'reports' && <Reports />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
