import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Users } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ProjectManagement = ({ user }) => {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [formData, setFormData] = useState({
    project_code: '',
    description: '',
    project_manager_id: user.id,
    estimated_hours: 0,
    sub_codes: [],
    team_members: [],
  });

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch projects');
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data.filter(u => u.role === 'employee' || u.role === 'manager'));
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      if (editMode) {
        await axios.put(`${BACKEND_URL}/api/projects/${editingProjectId}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Project updated successfully');
      } else {
        await axios.post(`${BACKEND_URL}/api/projects`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Project created successfully');
      }
      
      setOpen(false);
      setEditMode(false);
      setEditingProjectId(null);
      setFormData({
        project_code: '',
        description: '',
        project_manager_id: user.id,
        estimated_hours: 0,
        sub_codes: [],
        team_members: [],
      });
      fetchProjects();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${editMode ? 'update' : 'create'} project`);
    }
  };

  const openEditDialog = (project) => {
    setEditMode(true);
    setEditingProjectId(project.id);
    setFormData({
      project_code: project.project_code,
      description: project.description,
      project_manager_id: project.project_manager_id,
      estimated_hours: project.estimated_hours,
      sub_codes: project.sub_codes || [],
      team_members: project.team_members || [],
    });
    setOpen(true);
  };

  const deleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${BACKEND_URL}/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Project deleted successfully');
      fetchProjects();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete project');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div data-testid="project-management">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-project-button">
              <Plus size={20} className="mr-2" />
              Create Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="project-form">
              <div>
                <Label>Project Code *</Label>
                <Input
                  placeholder="e.g., AWHCL-25001"
                  value={formData.project_code}
                  onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
                  required
                  data-testid="project-code-input"
                />
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea
                  placeholder="Project description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  data-testid="project-description-input"
                />
              </div>
              <div>
                <Label>Estimated Hours *</Label>
                <Input
                  type="number"
                  placeholder="e.g., 160"
                  value={formData.estimated_hours}
                  onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) })}
                  required
                  data-testid="project-hours-input"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="submit-project-button">
                Create Project
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <Card key={project.id} data-testid={`project-card-${project.id}`}>
            <CardHeader>
              <CardTitle className="text-lg">{project.project_code}</CardTitle>
              <CardDescription className="line-clamp-2">{project.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Estimated Hours:</span>
                  <span className="font-semibold">{project.estimated_hours}h</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Users size={16} className="mr-2" />
                  <span>{project.team_members?.length || 0} members</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ProjectManagement;
