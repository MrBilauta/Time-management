import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Calendar } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LeaveManagement = ({ user }) => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    days: 1,
    reason: '',
  });

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/leaves`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeaves(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch leaves');
      setLoading(false);
    }
  };

  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${BACKEND_URL}/api/leaves`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Leave application submitted');
      setOpen(false);
      setFormData({
        start_date: '',
        end_date: '',
        days: 1,
        reason: '',
      });
      fetchLeaves();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to apply for leave');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div data-testid="leave-management">
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">Leave Balance</h3>
            <p className="text-sm text-blue-700">Available days</p>
          </div>
          <div className="text-3xl font-bold text-blue-900" data-testid="leave-balance">{user.leave_balance || 0} days</div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Leave Applications</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="apply-leave-button">
              <Plus size={20} className="mr-2" />
              Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="leave-form">
              <div>
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => {
                    const days = calculateDays(e.target.value, formData.end_date);
                    setFormData({ ...formData, start_date: e.target.value, days });
                  }}
                  required
                  data-testid="start-date-input"
                />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => {
                    const days = calculateDays(formData.start_date, e.target.value);
                    setFormData({ ...formData, end_date: e.target.value, days });
                  }}
                  required
                  data-testid="end-date-input"
                />
              </div>
              <div>
                <Label>Number of Days</Label>
                <Input
                  type="number"
                  value={formData.days}
                  onChange={(e) => setFormData({ ...formData, days: parseFloat(e.target.value) })}
                  required
                  data-testid="days-input"
                />
              </div>
              <div>
                <Label>Reason *</Label>
                <Textarea
                  placeholder="Please provide a reason for your leave"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                  data-testid="reason-input"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="submit-leave-button">
                Submit Application
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {leaves.map((leave) => (
          <Card key={leave.id} data-testid={`leave-card-${leave.id}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar size={20} />
                    {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                  </CardTitle>
                  <CardDescription>{leave.days} {leave.days === 1 ? 'day' : 'days'}</CardDescription>
                </div>
                <span className={`status-badge status-${leave.status}`}>
                  {leave.status}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Reason:</p>
                  <p className="text-sm text-gray-600">{leave.reason}</p>
                </div>
                {leave.comments && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-sm font-semibold text-yellow-900">Manager Comments:</p>
                    <p className="text-sm text-yellow-800 mt-1">{leave.comments}</p>
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-2">
                  Applied on: {new Date(leave.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default LeaveManagement;
