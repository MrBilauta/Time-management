import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'employee',
    designation: '',
    practice: '',
    date_of_joining: '',
    date_of_birth: '',
    reporting_manager_id: '',
    leave_balance: 20,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
      setManagers(response.data.filter(u => u.role === 'manager' || u.role === 'admin'));
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch users');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      if (editMode) {
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        delete updateData.email;
        
        await axios.put(`${BACKEND_URL}/api/users/${editingUserId}`, updateData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('User updated successfully');
      } else {
        await axios.post(`${BACKEND_URL}/api/users`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('User created successfully');
      }
      
      setOpen(false);
      setEditMode(false);
      setEditingUserId(null);
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'employee',
        designation: '',
        practice: '',
        date_of_joining: '',
        date_of_birth: '',
        reporting_manager_id: '',
        leave_balance: 20,
      });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${editMode ? 'update' : 'create'} user`);
    }
  };

  const openEditDialog = (user) => {
    setEditMode(true);
    setEditingUserId(user.id);
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      designation: user.designation || '',
      practice: user.practice || '',
      date_of_joining: user.date_of_joining || '',
      date_of_birth: user.date_of_birth || '',
      reporting_manager_id: user.reporting_manager_id || '',
      leave_balance: user.leave_balance || 20,
    });
    setOpen(true);
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${BACKEND_URL}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div data-testid="user-management">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <Dialog open={open} onOpenChange={(val) => {
          setOpen(val);
          if (!val) {
            setEditMode(false);
            setEditingUserId(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="add-user-button" onClick={() => {
              setEditMode(false);
              setEditingUserId(null);
              setFormData({
                email: '',
                password: '',
                name: '',
                role: 'employee',
                designation: '',
                practice: '',
                date_of_joining: '',
                date_of_birth: '',
                reporting_manager_id: '',
                leave_balance: 20,
              });
            }}>
              <Plus size={20} className="mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editMode ? 'Edit User' : 'Create New User'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="user-form">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="user-name-input"
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    data-testid="user-email-input"
                  />
                </div>
                <div>
                  <Label>Password {editMode ? '(leave blank to keep current)' : '*'}</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editMode}
                    data-testid="user-password-input"
                  />
                </div>
                <div>
                  <Label>Role *</Label>
                  <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
                    <SelectTrigger data-testid="user-role-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Designation</Label>
                  <Input
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    data-testid="user-designation-input"
                  />
                </div>
                <div>
                  <Label>Practice/Department</Label>
                  <Input
                    value={formData.practice}
                    onChange={(e) => setFormData({ ...formData, practice: e.target.value })}
                    data-testid="user-practice-input"
                  />
                </div>
                <div>
                  <Label>Date of Joining</Label>
                  <Input
                    type="date"
                    value={formData.date_of_joining}
                    onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                    data-testid="user-doj-input"
                  />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    data-testid="user-dob-input"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Leave Balance (Days)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.leave_balance}
                    onChange={(e) => setFormData({ ...formData, leave_balance: parseFloat(e.target.value) })}
                    data-testid="user-leave-balance-input"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Reporting Manager</Label>
                  <Select value={formData.reporting_manager_id} onValueChange={(val) => setFormData({ ...formData, reporting_manager_id: val })}>
                    <SelectTrigger data-testid="user-manager-select">
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.name} ({manager.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" data-testid="submit-user-button">
                {editMode ? 'Update User' : 'Create User'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Practice</TableHead>
              <TableHead>Leave Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <span className={`status-badge ${
                    user.role === 'admin' ? 'status-approved' :
                    user.role === 'manager' ? 'status-submitted' :
                    'status-draft'
                  }`}>
                    {user.role}
                  </span>
                </TableCell>
                <TableCell>{user.designation || '-'}</TableCell>
                <TableCell>{user.practice || '-'}</TableCell>
                <TableCell>{user.leave_balance} days</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UserManagement;
