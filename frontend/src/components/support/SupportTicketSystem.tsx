/**
 * Customer Support Ticket System for Nixbit
 * Provides in-app support ticket creation, tracking, and management
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ChatBubbleLeftRightIcon, 
  DocumentTextIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  PaperAirplaneIcon,
  PaperClipIcon
} from '@heroicons/react/24/outline';

interface SupportTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting_for_customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'technical' | 'billing' | 'feature_request' | 'bug_report' | 'integration' | 'general';
  createdAt: string;
  updatedAt: string;
  lastResponseAt?: string;
  assignedTo?: string;
  responses: TicketResponse[];
  attachments: TicketAttachment[];
  metadata: {
    userAgent?: string;
    url?: string;
    projectId?: string;
    errorDetails?: any;
  };
}

interface TicketResponse {
  id: string;
  message: string;
  author: {
    id: string;
    name: string;
    email: string;
    isStaff: boolean;
  };
  createdAt: string;
  attachments?: TicketAttachment[];
}

interface TicketAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
}

interface CreateTicketData {
  title: string;
  description: string;
  category: SupportTicket['category'];
  priority: SupportTicket['priority'];
  projectId?: string;
  attachments?: File[];
  metadata?: any;
}

const SupportTicketSystem: React.FC = () => {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<'list' | 'create' | 'view'>('list');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/support/tickets', {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
      }
    } catch (err) {
      setError('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (ticketData: CreateTicketData) => {
    try {
      setLoading(true);
      
      // Prepare form data for file uploads
      const formData = new FormData();
      formData.append('title', ticketData.title);
      formData.append('description', ticketData.description);
      formData.append('category', ticketData.category);
      formData.append('priority', ticketData.priority);
      
      if (ticketData.projectId) {
        formData.append('projectId', ticketData.projectId);
      }
      
      if (ticketData.metadata) {
        formData.append('metadata', JSON.stringify(ticketData.metadata));
      }
      
      // Add attachments
      if (ticketData.attachments) {
        ticketData.attachments.forEach((file, index) => {
          formData.append(`attachment_${index}`, file);
        });
      }
      
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.token}` },
        body: formData
      });
      
      if (response.ok) {
        const newTicket = await response.json();
        setTickets(prev => [newTicket, ...prev]);
        setActiveView('view');
        setSelectedTicket(newTicket);
        
        // Track ticket creation
        if (window.gtag) {
          window.gtag('event', 'support_ticket_created', {
            category: ticketData.category,
            priority: ticketData.priority
          });
        }
      } else {
        throw new Error('Failed to create ticket');
      }
    } catch (err) {
      setError('Failed to create support ticket');
    } finally {
      setLoading(false);
    }
  };

  const addResponse = async (ticketId: string, message: string, attachments?: File[]) => {
    try {
      const formData = new FormData();
      formData.append('message', message);
      
      if (attachments) {
        attachments.forEach((file, index) => {
          formData.append(`attachment_${index}`, file);
        });
      }
      
      const response = await fetch(`/api/support/tickets/${ticketId}/responses`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.token}` },
        body: formData
      });
      
      if (response.ok) {
        const updatedTicket = await response.json();
        setSelectedTicket(updatedTicket);
        setTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t));
      }
    } catch (err) {
      setError('Failed to add response');
    }
  };

  const renderTicketList = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Support Tickets</h2>
        <button
          onClick={() => setActiveView('create')}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center"
        >
          <ChatBubbleLeftRightIcon className="w-4 h-4 mr-2" />
          New Ticket
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {tickets.length === 0 && !loading && (
        <div className="text-center py-12">
          <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No support tickets</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new support ticket.</p>
        </div>
      )}

      <div className="space-y-3">
        {tickets.map(ticket => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onClick={() => {
              setSelectedTicket(ticket);
              setActiveView('view');
            }}
          />
        ))}
      </div>
    </div>
  );

  const renderCreateTicket = () => (
    <CreateTicketForm
      onSubmit={createTicket}
      onCancel={() => setActiveView('list')}
      loading={loading}
    />
  );

  const renderTicketView = () => (
    selectedTicket && (
      <TicketView
        ticket={selectedTicket}
        onAddResponse={addResponse}
        onBack={() => setActiveView('list')}
        loading={loading}
      />
    )
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {activeView === 'list' && renderTicketList()}
      {activeView === 'create' && renderCreateTicket()}
      {activeView === 'view' && renderTicketView()}
    </div>
  );
};

const TicketCard: React.FC<{ ticket: SupportTicket; onClick: () => void }> = ({ ticket, onClick }) => {
  const getStatusColor = (status: SupportTicket['status']) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'waiting_for_customer': return 'bg-blue-100 text-blue-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: SupportTicket['priority']) => {
    switch (priority) {
      case 'urgent': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: SupportTicket['status']) => {
    switch (status) {
      case 'resolved':
        return <CheckCircleIcon className="w-4 h-4" />;
      case 'in_progress':
        return <ClockIcon className="w-4 h-4" />;
      default:
        return <ChatBubbleLeftRightIcon className="w-4 h-4" />;
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md cursor-pointer transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-sm font-medium text-gray-900">#{ticket.ticketNumber}</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
              {getStatusIcon(ticket.status)}
              <span className="ml-1">{ticket.status.replace('_', ' ')}</span>
            </span>
            <span className={`text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
              {ticket.priority.toUpperCase()}
            </span>
          </div>
          
          <h3 className="text-sm font-medium text-gray-900 mb-1">{ticket.title}</h3>
          <p className="text-sm text-gray-600 line-clamp-2">{ticket.description}</p>
          
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-500">
              Created {new Date(ticket.createdAt).toLocaleDateString()}
            </span>
            <div className="flex items-center space-x-2">
              {ticket.responses.length > 0 && (
                <span className="text-xs text-gray-500">
                  {ticket.responses.length} response{ticket.responses.length !== 1 ? 's' : ''}
                </span>
              )}
              {ticket.attachments.length > 0 && (
                <PaperClipIcon className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CreateTicketForm: React.FC<{
  onSubmit: (data: CreateTicketData) => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState<CreateTicketData>({
    title: '',
    description: '',
    category: 'general',
    priority: 'medium',
    attachments: []
  });

  const [attachments, setAttachments] = useState<File[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, attachments });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Create Support Ticket</h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Brief description of your issue"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="technical">Technical Issue</option>
              <option value="bug_report">Bug Report</option>
              <option value="integration">Integration Help</option>
              <option value="feature_request">Feature Request</option>
              <option value="billing">Billing Question</option>
              <option value="general">General Support</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            required
            rows={6}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Please provide as much detail as possible about your issue..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Attachments
          </label>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            accept=".png,.jpg,.jpeg,.pdf,.txt,.log,.json"
          />
          <p className="text-xs text-gray-500 mt-1">
            You can attach screenshots, logs, or other relevant files (max 10MB each)
          </p>
          
          {attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center text-sm text-gray-600">
                  <PaperClipIcon className="w-4 h-4 mr-1" />
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <PaperAirplaneIcon className="w-4 h-4 mr-2" />
                Create Ticket
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

const TicketView: React.FC<{
  ticket: SupportTicket;
  onAddResponse: (ticketId: string, message: string, attachments?: File[]) => void;
  onBack: () => void;
  loading: boolean;
}> = ({ ticket, onAddResponse, onBack, loading }) => {
  const [newMessage, setNewMessage] = useState('');
  const [newAttachments, setNewAttachments] = useState<File[]>([]);

  const handleSubmitResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onAddResponse(ticket.id, newMessage, newAttachments);
      setNewMessage('');
      setNewAttachments([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-indigo-600 hover:text-indigo-800 flex items-center"
        >
          ← Back to tickets
        </button>
        <span className="text-sm text-gray-500">#{ticket.ticketNumber}</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">{ticket.title}</h1>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>Status: {ticket.status.replace('_', ' ')}</span>
              <span>Priority: {ticket.priority}</span>
              <span>Category: {ticket.category.replace('_', ' ')}</span>
              <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="prose max-w-none text-gray-700 mb-6">
          {ticket.description}
        </div>

        {ticket.attachments.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Attachments:</h4>
            <div className="space-y-1">
              {ticket.attachments.map(attachment => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                >
                  <PaperClipIcon className="w-4 h-4 mr-1" />
                  {attachment.filename}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Responses */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">
          Conversation ({ticket.responses.length})
        </h3>
        
        {ticket.responses.map(response => (
          <div
            key={response.id}
            className={`bg-white rounded-lg border p-4 ${
              response.author.isStaff ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">{response.author.name}</span>
                {response.author.isStaff && (
                  <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded">
                    Nixbit Support
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {new Date(response.createdAt).toLocaleString()}
              </span>
            </div>
            
            <div className="prose max-w-none text-gray-700">
              {response.message}
            </div>
            
            {response.attachments && response.attachments.length > 0 && (
              <div className="mt-3">
                <div className="space-y-1">
                  {response.attachments.map(attachment => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      <PaperClipIcon className="w-4 h-4 mr-1" />
                      {attachment.filename}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Response Form */}
      {ticket.status !== 'closed' && (
        <form onSubmit={handleSubmitResponse} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Add Response
              </label>
              <textarea
                rows={4}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Type your message here..."
                required
              />
            </div>

            <div>
              <input
                type="file"
                multiple
                onChange={(e) => setNewAttachments(e.target.files ? Array.from(e.target.files) : [])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                accept=".png,.jpg,.jpeg,.pdf,.txt,.log,.json"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !newMessage.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <PaperAirplaneIcon className="w-4 h-4 mr-2" />
                    Send Response
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default SupportTicketSystem;