import React, { useState } from 'react';
import { X, Building2, Mail, Globe } from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';

interface CreateOrganizationModalProps {
  onClose: () => void;
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  onClose,
}) => {
  const { createOrganization } = useOrganization();
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    billingEmail: '',
    plan: 'starter' as 'starter' | 'team' | 'enterprise',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$29',
      description: 'Perfect for small teams getting started',
      features: ['Up to 3 team members', '5 projects', 'Basic flaky test detection', 'Email support'],
      maxMembers: 3,
      maxProjects: 5,
    },
    {
      id: 'team',
      name: 'Team',
      price: '$59',
      description: 'For growing development teams',
      features: ['Up to 10 team members', '15 projects', 'Advanced analytics', 'Priority support'],
      maxMembers: 10,
      maxProjects: 15,
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '$99',
      description: 'For large organizations with complex needs',
      features: ['Unlimited team members', 'Unlimited projects', 'Custom integrations', 'Dedicated support'],
      maxMembers: 999,
      maxProjects: 999,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createOrganization(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Create New Organization
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* Organization Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Organization Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter organization name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Domain (Optional)
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    name="domain"
                    value={formData.domain}
                    onChange={handleInputChange}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="company.com"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Used for email verification when inviting team members
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billing Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    name="billingEmail"
                    value={formData.billingEmail}
                    onChange={handleInputChange}
                    required
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="billing@company.com"
                  />
                </div>
              </div>
            </div>

            {/* Plan Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Choose Your Plan</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map(plan => (
                  <div
                    key={plan.id}
                    className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                      formData.plan === plan.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${plan.popular ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, plan: plan.id as any }))}
                  >
                    {plan.popular && (
                      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                        <span className="bg-blue-500 text-white px-3 py-1 text-xs font-medium rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center">
                      <h4 className="text-lg font-semibold text-gray-900">{plan.name}</h4>
                      <div className="text-2xl font-bold text-gray-900 mt-2">
                        {plan.price}
                        <span className="text-sm font-normal text-gray-500">/month</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{plan.description}</p>
                    </div>

                    <ul className="mt-4 space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 flex-shrink-0"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        <div>Up to {plan.maxMembers === 999 ? 'unlimited' : plan.maxMembers} members</div>
                        <div>Up to {plan.maxProjects === 999 ? 'unlimited' : plan.maxProjects} projects</div>
                      </div>
                    </div>

                    <input
                      type="radio"
                      name="plan"
                      value={plan.id}
                      checked={formData.plan === plan.id}
                      onChange={() => setFormData(prev => ({ ...prev, plan: plan.id as any }))}
                      className="sr-only"
                    />
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name || !formData.billingEmail}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              Create Organization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrganizationModal;