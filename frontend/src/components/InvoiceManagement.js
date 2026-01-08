import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, DollarSign } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const InvoiceManagement = () => {
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    project_id: '',
    milestone_name: '',
    milestone_description: '',
    milestone_due_date: '',
    estimated_hours: 0,
    estimated_cost: 0,
    payment_terms: '',
    notes: '',
  });

  useEffect(() => {
    fetchInvoices();
    fetchProjects();
  }, []);

  const fetchInvoices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInvoices(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch invoices');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${BACKEND_URL}/api/invoices`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Invoice created successfully');
      setOpen(false);
      setFormData({
        project_id: '',
        milestone_name: '',
        milestone_description: '',
        milestone_due_date: '',
        estimated_hours: 0,
        estimated_cost: 0,
        payment_terms: '',
        notes: '',
      });
      fetchInvoices();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create invoice');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div data-testid="invoice-management">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-invoice-button">
              <Plus size={20} className="mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="invoice-form">
              <div>
                <Label>Project *</Label>
                <Select value={formData.project_id} onValueChange={(val) => setFormData({ ...formData, project_id: val })}>
                  <SelectTrigger data-testid="invoice-project-select">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.project_code} - {project.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Milestone Name *</Label>
                <Input
                  placeholder="e.g., Phase 1, Milestone A"
                  value={formData.milestone_name}
                  onChange={(e) => setFormData({ ...formData, milestone_name: e.target.value })}
                  data-testid="invoice-milestone-name-input"
                  required
                />
              </div>
              <div>
                <Label>Milestone Description</Label>
                <Textarea
                  placeholder="Describe the milestone deliverables"
                  value={formData.milestone_description}
                  onChange={(e) => setFormData({ ...formData, milestone_description: e.target.value })}
                  data-testid="invoice-milestone-desc-input"
                />
              </div>
              <div>
                <Label>Milestone Due Date</Label>
                <Input
                  type="date"
                  value={formData.milestone_due_date}
                  onChange={(e) => setFormData({ ...formData, milestone_due_date: e.target.value })}
                  data-testid="invoice-due-date-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Estimated Hours *</Label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="0"
                    value={formData.estimated_hours}
                    onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) })}
                    required
                    data-testid="invoice-hours-input"
                  />
                </div>
                <div>
                  <Label>Estimated Cost *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.estimated_cost}
                    onChange={(e) => setFormData({ ...formData, estimated_cost: parseFloat(e.target.value) })}
                    required
                    data-testid="invoice-cost-input"
                  />
                </div>
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Input
                  placeholder="e.g., Net 30, Due on completion"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  data-testid="invoice-payment-terms-input"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional notes or comments"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  data-testid="invoice-notes-input"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="submit-invoice-button">
                Create Invoice
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {invoices.map((invoice) => {
          const project = projects.find(p => p.id === invoice.project_id);
          return (
            <Card key={invoice.id} data-testid={`invoice-card-${invoice.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign size={20} />
                      {project?.project_code || 'Unknown Project'}
                    </CardTitle>
                    <CardDescription>{invoice.milestone_name || 'No milestone'}</CardDescription>
                  </div>
                  <span className={`status-badge status-${invoice.status}`}>
                    {invoice.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Estimated</p>
                      <p className="text-sm font-semibold">{invoice.estimated_hours}h / ${invoice.estimated_cost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Actual</p>
                      <p className="text-sm font-semibold">{invoice.actual_hours}h / ${invoice.actual_cost.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Created: {new Date(invoice.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default InvoiceManagement;
