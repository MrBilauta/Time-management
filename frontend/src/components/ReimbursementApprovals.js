import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Check, X, Receipt } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ReimbursementApprovals = ({ user }) => {
  const [reimbursements, setReimbursements] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedReimbursement, setSelectedReimbursement] = useState(null);
  const [comments, setComments] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState('');

  useEffect(() => {
    fetchReimbursements();
    fetchUsers();
  }, []);

  const fetchReimbursements = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/reimbursements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReimbursements(response.data.filter(r => r.status === 'pending'));
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch reimbursements');
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
      
      const response = await axios.post(`${BACKEND_URL}/api/reimbursements/${selectedReimbursement.id}/approve`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success(response.data.message || 'Reimbursement approved');
      setDialogOpen(false);
      setComments('');
      fetchReimbursements();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve reimbursement');
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
      
      const response = await axios.post(`${BACKEND_URL}/api/reimbursements/${selectedReimbursement.id}/reject`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success(response.data.message || 'Reimbursement rejected');
      setDialogOpen(false);
      setComments('');
      fetchReimbursements();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject reimbursement');
    }
  };

  const openDialog = (reimbursement, actionType) => {
    setSelectedReimbursement(reimbursement);
    setAction(actionType);
    setDialogOpen(true);
  };

  const downloadReceipt = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/reimbursements/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition ? contentDisposition.split('filename=')[1].replace(/"/g, '') : 'receipt';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Receipt downloaded');
    } catch (error) {
      toast.error('Failed to download receipt');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div data-testid="reimbursement-approvals">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Reimbursement Approvals</h2>
      
      {reimbursements.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No pending reimbursement approvals
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reimbursements.map((reimbursement) => (
            <Card key={reimbursement.id} data-testid={`approval-reimbursement-${reimbursement.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt size={20} />
                      {users[reimbursement.user_id]?.name || 'Unknown User'}
                    </CardTitle>
                    <CardDescription>
                      ${reimbursement.amount.toFixed(2)}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => openDialog(reimbursement, 'approve')}
                      data-testid={`approve-reimbursement-btn-${reimbursement.id}`}
                    >
                      <Check size={16} className="mr-1" />
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => openDialog(reimbursement, 'reject')}
                      data-testid={`reject-reimbursement-btn-${reimbursement.id}`}
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
                    <p className="text-sm font-semibold text-gray-700">Description:</p>
                    <p className="text-sm text-gray-600">{reimbursement.description}</p>
                  </div>
                  {reimbursement.receipt && (
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-sm font-semibold text-blue-900">Receipt Attached:</p>
                      <p className="text-sm text-blue-700">{reimbursement.receipt.filename || 'Document attached'}</p>
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Submitted on: {new Date(reimbursement.created_at).toLocaleDateString()}
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
              {action === 'approve' ? 'Approve Reimbursement' : 'Reject Reimbursement'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Comments {action === 'reject' && '*'}</Label>
              <Textarea
                placeholder={action === 'approve' ? 'Add optional comments' : 'Please provide a reason for rejection'}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                data-testid="reimbursement-approval-comments-input"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={action === 'approve' ? handleApprove : handleReject}
                className="flex-1"
                variant={action === 'approve' ? 'default' : 'destructive'}
                data-testid="confirm-reimbursement-action-button"
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

export default ReimbursementApprovals;
