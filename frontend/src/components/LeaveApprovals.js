import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Check, X, Calendar } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LeaveApprovals = ({ user }) => {
  const [leaves, setLeaves] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [comments, setComments] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState('');

  useEffect(() => {
    fetchLeaves();
    fetchUsers();
  }, []);

  const fetchLeaves = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/leaves`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeaves(response.data.filter(l => l.status === 'pending'));
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch leave applications');
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userMap = {};
      response.data.forEach(u => {
        userMap[u.id] = u;
      });
      setUsers(userMap);
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  const handleApprove = async () => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      if (comments) formData.append('comments', comments);
      
      const response = await axios.post(`${BACKEND_URL}/api/leaves/${selectedLeave.id}/approve`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success(response.data.message || 'Leave approved');
      setDialogOpen(false);
      setComments('');
      fetchLeaves();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve leave');
    }
  };

  const handleReject = async () => {
    if (!comments.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('comments', comments);
      
      const response = await axios.post(`${BACKEND_URL}/api/leaves/${selectedLeave.id}/reject`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success(response.data.message || 'Leave rejected');
      setDialogOpen(false);
      setComments('');
      fetchLeaves();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject leave');
    }
  };

  const openDialog = (leave, actionType) => {
    setSelectedLeave(leave);
    setAction(actionType);
    setDialogOpen(true);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div data-testid="leave-approvals">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Leave Approvals</h2>
      
      {leaves.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No pending leave approvals
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {leaves.map((leave) => (
            <Card key={leave.id} data-testid={`approval-leave-${leave.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar size={20} />
                      {users[leave.user_id]?.name || 'Unknown User'}
                    </CardTitle>
                    <CardDescription>
                      {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()} • {leave.days} {leave.days === 1 ? 'day' : 'days'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => openDialog(leave, 'approve')}
                      data-testid={`approve-leave-btn-${leave.id}`}
                    >
                      <Check size={16} className="mr-1" />
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => openDialog(leave, 'reject')}
                      data-testid={`reject-leave-btn-${leave.id}`}
                    >
                      <X size={16} className="mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Reason:</p>
                    <p className="text-sm text-gray-600">{leave.reason}</p>
                  </div>
                  <div className="text-xs text-gray-500">
                    Applied on: {new Date(leave.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-600">
                    Employee Balance: {users[leave.user_id]?.leave_balance || 0} days
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? 'Approve Leave' : 'Reject Leave'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Comments {action === 'reject' && '*'}</Label>
              <Textarea
                placeholder={action === 'approve' ? 'Add optional comments' : 'Please provide a reason for rejection'}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                data-testid="leave-approval-comments-input"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={action === 'approve' ? handleApprove : handleReject}
                className="flex-1"
                variant={action === 'approve' ? 'default' : 'destructive'}
                data-testid="confirm-leave-action-button"
              >
                {action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </Button>
              <Button 
                onClick={() => {
                  setDialogOpen(false);
                  setComments('');
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveApprovals;
