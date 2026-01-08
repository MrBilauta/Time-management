import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Receipt } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ReimbursementManagement = ({ user }) => {
  const [reimbursements, setReimbursements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    amount: 0,
    description: '',
  });
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    fetchReimbursements();
  }, []);

  const fetchReimbursements = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/reimbursements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReimbursements(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch reimbursements');
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload only PDF or image files (JPG, PNG)');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('amount', formData.amount);
      formDataToSend.append('description', formData.description);
      if (selectedFile) {
        formDataToSend.append('file', selectedFile);
      }

      await axios.post(`${BACKEND_URL}/api/reimbursements/with-file`, formDataToSend, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
      });
      toast.success('Reimbursement submitted');
      setOpen(false);
      setFormData({
        amount: 0,
        description: '',
      });
      setSelectedFile(null);
      fetchReimbursements();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit reimbursement');
    }
  };

  const deleteReimbursement = async (id) => {
    if (!window.confirm('Are you sure you want to delete this reimbursement?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${BACKEND_URL}/api/reimbursements/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Reimbursement deleted');
      fetchReimbursements();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete reimbursement');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div data-testid="reimbursement-management">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Reimbursements</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="submit-reimbursement-button">
              <Plus size={20} className="mr-2" />
              Submit Reimbursement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Reimbursement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="reimbursement-form">
              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  required
                  data-testid="amount-input"
                />
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea
                  placeholder="Describe the expense"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  data-testid="description-input"
                />
              </div>
              <div>
                <Label>Receipt/Bill (Optional)</Label>
                <Input
                  placeholder="Upload reference or note"
                  value={formData.receipt}
                  onChange={(e) => setFormData({ ...formData, receipt: e.target.value })}
                  data-testid="receipt-input"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="submit-reimbursement-form-button">
                Submit Reimbursement
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {reimbursements.map((reimbursement) => (
          <Card key={reimbursement.id} data-testid={`reimbursement-card-${reimbursement.id}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt size={20} />
                    ${reimbursement.amount.toFixed(2)}
                  </CardTitle>
                  <CardDescription>{reimbursement.description}</CardDescription>
                </div>
                <span className={`status-badge status-${reimbursement.status}`}>
                  {reimbursement.status}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reimbursement.comments && (
                  <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-sm font-semibold text-yellow-900">Manager Comments:</p>
                    <p className="text-sm text-yellow-800 mt-1">{reimbursement.comments}</p>
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
    </div>
  );
};

export default ReimbursementManagement;
