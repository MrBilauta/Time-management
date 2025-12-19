import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { BarChart3, Clock, Users } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Reports = () => {
  const [timesheetSummary, setTimesheetSummary] = useState({});
  const [projectHours, setProjectHours] = useState({});
  const [users, setUsers] = useState({});
  const [projects, setProjects] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const [timesheetRes, projectRes, usersRes, projectsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/reports/timesheet-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${BACKEND_URL}/api/reports/project-hours`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${BACKEND_URL}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${BACKEND_URL}/api/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setTimesheetSummary(timesheetRes.data);
      setProjectHours(projectRes.data);
      
      const userMap = {};
      usersRes.data.forEach(u => { userMap[u.id] = u; });
      setUsers(userMap);
      
      const projectMap = {};
      projectsRes.data.forEach(p => { projectMap[p.project_code] = p; });
      setProjects(projectMap);
      
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch reports');
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div data-testid="reports">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Reports & Analytics</h2>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={20} />
              Timesheet Summary by Employee
            </CardTitle>
            <CardDescription>Approved timesheets overview</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Weeks</TableHead>
                  <TableHead>Avg Hours/Week</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(timesheetSummary).map(([userId, data]) => (
                  <TableRow key={userId}>
                    <TableCell className="font-medium">
                      {users[userId]?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>{data.total_hours}h</TableCell>
                    <TableCell>{data.weeks}</TableCell>
                    <TableCell>{(data.total_hours / data.weeks).toFixed(1)}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={20} />
              Hours by Project
            </CardTitle>
            <CardDescription>Total approved hours per project</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Total Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(projectHours).map(([code, hours]) => (
                  <TableRow key={code}>
                    <TableCell className="font-medium">{code}</TableCell>
                    <TableCell>{projects[code]?.description || '-'}</TableCell>
                    <TableCell>{hours.toFixed(1)}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
