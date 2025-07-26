import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  Activity, 
  Users, 
  Database, 
  Server, 
  RefreshCw, 
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface SystemMetrics {
  timeRange: string;
  errors: {
    total: number;
    byLevel: Record<string, number>;
  };
  performance: {
    totalRequests: number;
    avgDuration: number;
    maxDuration: number;
  };
  functions: Array<{
    name: string;
    executions: number;
  }>;
  users: {
    activeLastWeek: number;
  };
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  services: {
    database: {
      status: string;
      responseTime: number;
    };
    functions: {
      status: string;
      recentErrors: number;
    };
  };
}

interface Alert {
  id: string;
  timestamp: string;
  message: string;
  functionName?: string;
  userId?: string;
  metadata?: any;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, healthRes, alertsRes] = await Promise.all([
        fetch('/.netlify/functions/monitor/metrics'),
        fetch('/.netlify/functions/monitor/health'),
        fetch('/.netlify/functions/monitor/alerts')
      ]);

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setHealth(healthData);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts || []);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'down':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nixbit Admin Dashboard</h1>
            <p className="text-gray-600">System monitoring and analytics</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
            <Button onClick={fetchDashboardData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* System Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              {health && getStatusIcon(health.status)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className={getStatusColor(health?.status || 'unknown')}>
                  {health?.status || 'Loading...'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Errors (24h)</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.errors.total || 0}</div>
              <p className="text-xs text-gray-500">
                Critical: {metrics?.errors.byLevel.error || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.performance.avgDuration ? 
                  formatDuration(metrics.performance.avgDuration) : 
                  'N/A'
                }
              </div>
              <p className="text-xs text-gray-500">
                {metrics?.performance.totalRequests || 0} total requests
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.users.activeLastWeek || 0}</div>
              <p className="text-xs text-gray-500">Last 7 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Monitoring */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Error Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Error Breakdown (24h)</CardTitle>
                  <CardDescription>Errors by severity level</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(metrics?.errors.byLevel || {}).map(([level, count]) => (
                      <div key={level} className="flex justify-between items-center">
                        <span className="capitalize">{level}</span>
                        <Badge variant={level === 'error' ? 'destructive' : 'secondary'}>
                          {count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Function Execution Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Function Executions (24h)</CardTitle>
                  <CardDescription>Most active functions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {metrics?.functions.slice(0, 5).map((func) => (
                      <div key={func.name} className="flex justify-between items-center">
                        <span className="text-sm">{func.name}</span>
                        <Badge variant="outline">{func.executions}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>System performance over the last 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {metrics?.performance.totalRequests || 0}
                    </div>
                    <p className="text-sm text-gray-500">Total Requests</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {metrics?.performance.avgDuration ? 
                        formatDuration(metrics.performance.avgDuration) : 
                        'N/A'
                      }
                    </div>
                    <p className="text-sm text-gray-500">Average Duration</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {metrics?.performance.maxDuration ? 
                        formatDuration(metrics.performance.maxDuration) : 
                        'N/A'
                      }
                    </div>
                    <p className="text-sm text-gray-500">Max Duration</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Critical errors and warnings from the last 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No alerts in the last 24 hours</p>
                  ) : (
                    alerts.map((alert) => (
                      <Alert key={alert.id}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="flex justify-between items-center">
                          <span>{alert.functionName || 'System'}</span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(alert.timestamp)}
                          </span>
                        </AlertTitle>
                        <AlertDescription>{alert.message}</AlertDescription>
                      </Alert>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Database Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Status</span>
                      <div className="flex items-center gap-2">
                        {health && getStatusIcon(health.services.database.status)}
                        <span className={getStatusColor(health?.services.database.status || 'unknown')}>
                          {health?.services.database.status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Response Time</span>
                      <span>{health?.services.database.responseTime || 0}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Functions Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Functions Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Status</span>
                      <div className="flex items-center gap-2">
                        {health && getStatusIcon(health.services.functions.status)}
                        <span className={getStatusColor(health?.services.functions.status || 'unknown')}>
                          {health?.services.functions.status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Recent Errors</span>
                      <span>{health?.services.functions.recentErrors || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}