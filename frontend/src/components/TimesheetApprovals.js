import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TimesheetApprovals = ({ user }) => {
  const [timesheets, setTimesheets] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [comments, setComments] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState('');

  useEffect(() => {
    fetchTimesheets();
    fetchUsers();
  }, []);

  const fetchTimesheets = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/timesheets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTimesheets(response.data.filter(t => t.status === 'submitted'));
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch timesheets');
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
      await axios.post(`${BACKEND_URL}/api/timesheets/${selectedTimesheet.id}/approve`, 
        { comments },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Timesheet approved');
      setDialogOpen(false);
      setComments('');
      fetchTimesheets();
    } catch (error) {
      toast.error('Failed to approve timesheet');
    }
  };

  const handleReject = async () => {
    if (!comments.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${BACKEND_URL}/api/timesheets/${selectedTimesheet.id}/reject`, 
        { comments },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Timesheet rejected');
      setDialogOpen(false);
      setComments('');
      fetchTimesheets();
    } catch (error) {
      toast.error('Failed to reject timesheet');
    }
  };

  const openDialog = (timesheet, actionType) => {
    setSelectedTimesheet(timesheet);
    setAction(actionType);
    setDialogOpen(true);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div data-testid="timesheet-approvals">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Timesheet Approvals</h2>
      
      {timesheets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No pending timesheet approvals
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {timesheets.map((timesheet) => (
            <Card key={timesheet.id} data-testid={`approval-timesheet-${timesheet.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>
                      {users[timesheet.user_id]?.name || 'Unknown User'}
                    </CardTitle>
                    <CardDescription>
                      Week of {new Date(timesheet.week_start).toLocaleDateString()} • {timesheet.total_hours} hours
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => openDialog(timesheet, 'approve')}
                      data-testid={`approve-btn-${timesheet.id}`}
                    >
                      <Check size={16} className="mr-1" />
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => openDialog(timesheet, 'reject')}
                      data-testid={`reject-btn-${timesheet.id}`}
                    >
                      <X size={16} className="mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Mon</TableHead>
                      <TableHead className="text-center">Tue</TableHead>
                      <TableHead className="text-center">Wed</TableHead>
                      <TableHead className="text-center">Thu</TableHead>
                      <TableHead className="text-center">Fri</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheet.entries.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{entry.project_code}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded ${
                            entry.activity_type === 'billable' ? 'bg-green-100 text-green-700' :
                            entry.activity_type === 'leave' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {entry.activity_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{entry.mon || 0}</TableCell>
                        <TableCell className="text-center">{entry.tue || 0}</TableCell>
                        <TableCell className="text-center">{entry.wed || 0}</TableCell>
                        <TableCell className="text-center">{entry.thu || 0}</TableCell>
                        <TableCell className="text-center">{entry.fri || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? 'Approve Timesheet' : 'Reject Timesheet'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Comments {action === 'reject' && '*'}</Label>
              <Textarea
                placeholder={action === 'approve' ? 'Add optional comments' : 'Please provide a reason for rejection'}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                data-testid="approval-comments-input"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={action === 'approve' ? handleApprove : handleReject}
                className="flex-1"
                variant={action === 'approve' ? 'default' : 'destructive'}
                data-testid="confirm-action-button"
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

export default TimesheetApprovals;
