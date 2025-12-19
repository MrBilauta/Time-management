import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Send } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TimesheetManagement = ({ user }) => {
  const [timesheets, setTimesheets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState([{
    project_code: '',
    description: '',
    activity_type: 'billable',
    mon: 0, tue: 0, wed: 0, thu: 0, fri: 0
  }]);
  const [weekStart, setWeekStart] = useState('');

  useEffect(() => {
    fetchTimesheets();
    fetchProjects();
    // Set current week's Monday
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    setWeekStart(monday.toISOString().split('T')[0]);
  }, []);

  const fetchTimesheets = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/timesheets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTimesheets(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch timesheets');
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects');
    }
  };

  const addEntry = () => {
    setEntries([...entries, {
      project_code: '',
      description: '',
      activity_type: 'billable',
      mon: 0, tue: 0, wed: 0, thu: 0, fri: 0
    }]);
  };

  const updateEntry = (index, field, value) => {
    const updated = [...entries];
    updated[index][field] = value;
    
    // Auto-fetch project description
    if (field === 'project_code') {
      const project = projects.find(p => p.project_code === value);
      if (project) {
        updated[index].description = project.description;
      }
    }
    
    setEntries(updated);
  };

  const calculateTotal = () => {
    return entries.reduce((total, entry) => {
      return total + (parseFloat(entry.mon) || 0) + (parseFloat(entry.tue) || 0) + 
             (parseFloat(entry.wed) || 0) + (parseFloat(entry.thu) || 0) + (parseFloat(entry.fri) || 0);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const total = calculateTotal();
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${BACKEND_URL}/api/timesheets`, {
        week_start: weekStart,
        entries,
        total_hours: total
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Timesheet created successfully');
      setOpen(false);
      setEntries([{
        project_code: '',
        description: '',
        activity_type: 'billable',
        mon: 0, tue: 0, wed: 0, thu: 0, fri: 0
      }]);
      fetchTimesheets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create timesheet');
    }
  };

  const submitTimesheet = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${BACKEND_URL}/api/timesheets/${id}/submit`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Timesheet submitted for approval');
      fetchTimesheets();
    } catch (error) {
      toast.error('Failed to submit timesheet');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div data-testid="timesheet-management">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">My Timesheets</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-timesheet-button">
              <Plus size={20} className="mr-2" />
              New Timesheet
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Weekly Timesheet</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="timesheet-form">
              <div>
                <Label>Week Starting (Monday)</Label>
                <Input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  required
                  data-testid="week-start-input"
                />
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border p-2 text-left text-sm">Project Code</th>
                      <th className="border p-2 text-left text-sm">Activity Type</th>
                      <th className="border p-2 text-sm">Mon</th>
                      <th className="border p-2 text-sm">Tue</th>
                      <th className="border p-2 text-sm">Wed</th>
                      <th className="border p-2 text-sm">Thu</th>
                      <th className="border p-2 text-sm">Fri</th>
                      <th className="border p-2 text-sm">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => {
                      const rowTotal = (parseFloat(entry.mon) || 0) + (parseFloat(entry.tue) || 0) + 
                                      (parseFloat(entry.wed) || 0) + (parseFloat(entry.thu) || 0) + (parseFloat(entry.fri) || 0);
                      return (
                        <tr key={index}>
                          <td className="border p-2">
                            <Select value={entry.project_code} onValueChange={(val) => updateEntry(index, 'project_code', val)}>
                              <SelectTrigger className="w-40" data-testid={`project-select-${index}`}>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {projects.map((project) => (
                                  <SelectItem key={project.id} value={project.project_code}>
                                    {project.project_code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="border p-2">
                            <Select value={entry.activity_type} onValueChange={(val) => updateEntry(index, 'activity_type', val)}>
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="billable">Billable</SelectItem>
                                <SelectItem value="non-billable">Non-billable</SelectItem>
                                <SelectItem value="leave">Leave</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              className="input-hours"
                              value={entry.mon}
                              onChange={(e) => updateEntry(index, 'mon', e.target.value)}
                              data-testid={`mon-${index}`}
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              className="input-hours"
                              value={entry.tue}
                              onChange={(e) => updateEntry(index, 'tue', e.target.value)}
                              data-testid={`tue-${index}`}
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              className="input-hours"
                              value={entry.wed}
                              onChange={(e) => updateEntry(index, 'wed', e.target.value)}
                              data-testid={`wed-${index}`}
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              className="input-hours"
                              value={entry.thu}
                              onChange={(e) => updateEntry(index, 'thu', e.target.value)}
                              data-testid={`thu-${index}`}
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              className="input-hours"
                              value={entry.fri}
                              onChange={(e) => updateEntry(index, 'fri', e.target.value)}
                              data-testid={`fri-${index}`}
                            />
                          </td>
                          <td className="border p-2 text-center font-semibold">{rowTotal}h</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-between items-center">
                <Button type="button" variant="outline" onClick={addEntry} data-testid="add-row-button">
                  Add Row
                </Button>
                <div className="text-lg font-bold">Weekly Total: {calculateTotal()}h</div>
              </div>
              
              <Button type="submit" className="w-full" data-testid="save-timesheet-button">
                Save Timesheet
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {timesheets.map((timesheet) => (
          <Card key={timesheet.id} data-testid={`timesheet-card-${timesheet.id}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Week of {new Date(timesheet.week_start).toLocaleDateString()}</CardTitle>
                  <CardDescription>{timesheet.total_hours} hours</CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                  <span className={`status-badge status-${timesheet.status}`}>
                    {timesheet.status}
                  </span>
                  {timesheet.status === 'draft' && (
                    <Button size="sm" onClick={() => submitTimesheet(timesheet.id)} data-testid={`submit-timesheet-${timesheet.id}`}>
                      <Send size={16} className="mr-1" />
                      Submit
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
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
              </div>
              {timesheet.comments && (
                <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
                  <p className="text-sm font-semibold text-yellow-900">Manager Comments:</p>
                  <p className="text-sm text-yellow-800 mt-1">{timesheet.comments}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TimesheetManagement;
