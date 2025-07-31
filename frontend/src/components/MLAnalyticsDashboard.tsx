import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Brain,
  Target,
  Clock,
  DollarSign,
  Activity,
  Zap,
  Shield,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Settings,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  Users,
  Gauge
} from 'lucide-react';

interface MLInsight {
  failurePredictions: Array<{
    testId: string;
    testName: string;
    failureProbability: number;
    confidence: number;
    businessImpact: 'low' | 'medium' | 'high' | 'critical';
    timeWindow: string;
    riskFactors: string[];
    recommendations: string[];
  }>;
  stabilityForecasts: Array<{
    metric: string;
    currentValue: number;
    predictedValue: number;
    trend: 'improving' | 'stable' | 'declining';
    confidence: number;
    timeHorizon: number;
  }>;
  intelligentRecommendations: Array<{
    id: string;
    category: 'preventive' | 'corrective' | 'optimization';
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    expectedImpact: number;
    implementation: string;
    timeEstimate: string;
  }>;
  modelPerformance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    retrainingRecommendation: boolean;
    modelDrift: {
      driftScore: number;
      driftType: string;
      recommendation: string;
    };
  };
  predictionAccuracy: Array<{
    model: string;
    accuracy: number;
    trend: 'improving' | 'stable' | 'declining';
    lastUpdated: string;
  }>;
  confidenceDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  featureImportance: Array<{
    feature: string;
    importance: number;
    description: string;
  }>;
}

interface TimeSeriesData {
  trends: Array<{
    metric: string;
    data: Array<{
      timestamp: string;
      value: number;
      prediction?: number;
      confidence?: number;
    }>;
    forecast: Array<{
      timestamp: string;
      predicted: number;
      lower: number;
      upper: number;
    }>;
  }>;
  anomalies: Array<{
    timestamp: string;
    metric: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    impact: string;
  }>;
  seasonalPatterns: Array<{
    pattern: string;
    period: string;
    strength: number;
    nextOccurrence: string;
  }>;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];
const RISK_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626'
};

export const MLAnalyticsDashboard: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('30');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [refreshInterval, setRefreshInterval] = useState(300000); // 5 minutes

  // Fetch ML insights
  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: ['ml-insights', organizationId, selectedTimeRange],
    queryFn: async (): Promise<MLInsight> => {
      const response = await fetch(`/api/advanced-analytics/organization/${organizationId}/insights?timeWindowDays=${selectedTimeRange}`);
      if (!response.ok) throw new Error('Failed to fetch ML insights');
      const result = await response.json();
      return result.data;
    },
    refetchInterval
  });

  // Fetch predictions
  const { data: predictions, isLoading: predictionsLoading } = useQuery({
    queryKey: ['ml-predictions', organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/advanced-analytics/organization/${organizationId}/predictions`);
      if (!response.ok) throw new Error('Failed to fetch predictions');
      const result = await response.json();
      return result.data;
    },
    refetchInterval
  });

  // Fetch time series analysis
  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useQuery({
    queryKey: ['time-series', organizationId, selectedTimeRange],
    queryFn: async (): Promise<TimeSeriesData> => {
      const response = await fetch(`/api/advanced-analytics/organization/${organizationId}/time-series-analysis?startDate=${new Date(Date.now() - parseInt(selectedTimeRange) * 24 * 60 * 60 * 1000).toISOString()}`);
      if (!response.ok) throw new Error('Failed to fetch time series data');
      const result = await response.json();
      return result.data;
    },
    refetchInterval
  });

  // Fetch model performance
  const { data: modelPerformance, isLoading: modelLoading } = useQuery({
    queryKey: ['model-performance', organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/advanced-analytics/organization/${organizationId}/ml-model-performance`);
      if (!response.ok) throw new Error('Failed to fetch model performance');
      const result = await response.json();
      return result.data;
    },
    refetchInterval
  });

  const isLoading = insightsLoading || predictionsLoading || timeSeriesLoading || modelLoading;

  const renderOverviewTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Key Metrics Cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">High Risk Tests</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {predictions?.summary?.highRiskTests || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            Tests with >70% failure probability
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Model Accuracy</CardTitle>
          <Brain className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {modelPerformance?.modelPerformance?.accuracy ? 
              `${(modelPerformance.modelPerformance.accuracy * 100).toFixed(1)}%` : 
              'N/A'
            }
          </div>
          <p className="text-xs text-muted-foreground">
            Overall prediction accuracy
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Recommendations</CardTitle>
          <Target className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {insights?.intelligentRecommendations?.length || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            ML-generated improvements
          </p>
        </CardContent>
      </Card>

      {/* Failure Predictions Chart */}
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <CardTitle>Test Failure Predictions</CardTitle>
          <CardDescription>
            ML-predicted failure probabilities for high-risk tests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={predictions?.predictions?.slice(0, 10) || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="testName" 
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis 
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              />
              <Tooltip
                formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Failure Probability']}
                labelFormatter={(label) => `Test: ${label}`}
              />
              <Bar 
                dataKey="failureProbability" 
                fill={(entry) => {
                  const value = entry as number;
                  if (value > 0.7) return RISK_COLORS.critical;
                  if (value > 0.5) return RISK_COLORS.high;
                  if (value > 0.3) return RISK_COLORS.medium;
                  return RISK_COLORS.low;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Model Performance Radar */}
      <Card>
        <CardHeader>
          <CardTitle>Model Performance</CardTitle>
          <CardDescription>
            ML model quality metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={modelPerformance?.modelPerformance ? [
              { metric: 'Accuracy', value: modelPerformance.modelPerformance.accuracy * 100 },
              { metric: 'Precision', value: modelPerformance.modelPerformance.precision * 100 },
              { metric: 'Recall', value: modelPerformance.modelPerformance.recall * 100 },
              { metric: 'F1 Score', value: modelPerformance.modelPerformance.f1Score * 100 }
            ] : []}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis domain={[0, 100]} />
              <Radar dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  const renderPredictionsTab = () => (
    <div className="space-y-6">
      {/* Predictions Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Critical Risk</p>
                <p className="text-lg font-bold">{predictions?.summary?.criticalBusinessImpact || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Gauge className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
                <p className="text-lg font-bold">
                  {predictions?.summary?.averageConfidence ? 
                    `${(predictions.summary.averageConfidence * 100).toFixed(1)}%` : 
                    'N/A'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Predictions</p>
                <p className="text-lg font-bold">{predictions?.summary?.totalPredictions || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">High Risk</p>
                <p className="text-lg font-bold">{predictions?.summary?.highRiskTests || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Predictions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Test Failure Predictions</CardTitle>
          <CardDescription>
            ML-powered analysis of test failure probability and risk factors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {predictions?.predictions?.slice(0, 20).map((prediction, index) => (
              <div key={prediction.testId} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium">{prediction.testName}</h4>
                    <Badge variant={
                      prediction.businessImpact === 'critical' ? 'destructive' :
                      prediction.businessImpact === 'high' ? 'secondary' :
                      prediction.businessImpact === 'medium' ? 'outline' : 'default'
                    }>
                      {prediction.businessImpact}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Risk Factors: {prediction.riskFactors?.join(', ') || 'None identified'}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Failure Probability</p>
                    <div className="flex items-center space-x-2">
                      <Progress 
                        value={prediction.failureProbability * 100} 
                        className="w-20"
                      />
                      <span className="text-sm font-medium">
                        {(prediction.failureProbability * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <span className="text-sm font-medium">
                      {(prediction.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTimeSeriesTab = () => (
    <div className="space-y-6">
      {/* Metric Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Test Metric Trends</CardTitle>
          <CardDescription>
            Historical trends with ML forecasting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={timeSeriesData?.trends?.[0]?.data || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleString()}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#8884d8" 
                name="Actual"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="prediction" 
                stroke="#ff7c7c" 
                strokeDasharray="5 5"
                name="Predicted"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Anomalies */}
      <Card>
        <CardHeader>
          <CardTitle>Detected Anomalies</CardTitle>
          <CardDescription>
            ML-detected unusual patterns in test execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {timeSeriesData?.anomalies?.map((anomaly, index) => (
              <Alert key={index} variant={anomaly.severity === 'critical' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="flex items-center justify-between">
                  <span>{anomaly.metric} Anomaly</span>
                  <Badge variant={
                    anomaly.severity === 'critical' ? 'destructive' :
                    anomaly.severity === 'high' ? 'secondary' :
                    'outline'
                  }>
                    {anomaly.severity}
                  </Badge>
                </AlertTitle>
                <AlertDescription>
                  <p>{anomaly.description}</p>
                  <p className="text-xs mt-1">
                    Detected at: {new Date(anomaly.timestamp).toLocaleString()}
                  </p>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Seasonal Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>Seasonal Patterns</CardTitle>
          <CardDescription>
            Recurring patterns identified by ML analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {timeSeriesData?.seasonalPatterns?.map((pattern, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">{pattern.pattern}</h4>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Period: {pattern.period}</span>
                      <span>Strength: {(pattern.strength * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-xs">
                      Next: {new Date(pattern.nextOccurrence).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderRecommendationsTab = () => (
    <div className="space-y-6">
      {/* Recommendations by Priority */}
      {['critical', 'high', 'medium', 'low'].map((priority) => {
        const priorityRecommendations = insights?.intelligentRecommendations?.filter(
          rec => rec.priority === priority
        ) || [];
        
        if (priorityRecommendations.length === 0) return null;

        return (
          <Card key={priority}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span className="capitalize">{priority} Priority Recommendations</span>
                <Badge variant={
                  priority === 'critical' ? 'destructive' :
                  priority === 'high' ? 'secondary' :
                  'outline'
                }>
                  {priorityRecommendations.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {priorityRecommendations.map((rec, index) => (
                  <div key={rec.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium">{rec.title}</h4>
                          <Badge variant="outline">{rec.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Expected Impact:</span>
                            <div className="flex items-center space-x-2 mt-1">
                              <Progress value={rec.expectedImpact * 100} className="flex-1" />
                              <span>{(rec.expectedImpact * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Time Estimate:</span>
                            <p className="font-medium">{rec.timeEstimate}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Implementation:</span>
                            <p className="font-medium text-xs">{rec.implementation}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                        <Button size="sm">
                          Implement
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderModelPerformanceTab = () => (
    <div className="space-y-6">
      {/* Model Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Accuracy</p>
              <p className="text-2xl font-bold">
                {modelPerformance?.modelPerformance?.accuracy ? 
                  `${(modelPerformance.modelPerformance.accuracy * 100).toFixed(1)}%` : 
                  'N/A'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Precision</p>
              <p className="text-2xl font-bold">
                {modelPerformance?.modelPerformance?.precision ? 
                  `${(modelPerformance.modelPerformance.precision * 100).toFixed(1)}%` : 
                  'N/A'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Recall</p>
              <p className="text-2xl font-bold">
                {modelPerformance?.modelPerformance?.recall ? 
                  `${(modelPerformance.modelPerformance.recall * 100).toFixed(1)}%` : 
                  'N/A'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">F1 Score</p>
              <p className="text-2xl font-bold">
                {modelPerformance?.modelPerformance?.f1Score ? 
                  `${(modelPerformance.modelPerformance.f1Score * 100).toFixed(1)}%` : 
                  'N/A'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Importance */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Importance</CardTitle>
          <CardDescription>
            Most influential factors in ML predictions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart 
              data={modelPerformance?.featureImportance?.slice(0, 10) || []}
              layout="horizontal"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 1]} />
              <YAxis dataKey="feature" type="category" width={150} />
              <Tooltip 
                formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Importance']}
              />
              <Bar dataKey="importance" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Model Drift Detection */}
      {modelPerformance?.modelRecommendations?.driftDetected && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Model Drift Detected</AlertTitle>
          <AlertDescription>
            The ML model performance has degraded. 
            {modelPerformance.modelRecommendations.retrainingNeeded && 
              ' Retraining is recommended.'
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Confidence Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Prediction Confidence Distribution</CardTitle>
          <CardDescription>
            Distribution of confidence scores across predictions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={modelPerformance?.confidenceDistribution || []}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                label={({ range, percentage }) => `${range}: ${percentage}%`}
              >
                {(modelPerformance?.confidenceDistribution || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading ML analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ML Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Advanced machine learning insights for test optimization
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetchInsights()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="timeseries">Time Series</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="models">Model Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {renderOverviewTab()}
        </TabsContent>

        <TabsContent value="predictions" className="mt-6">
          {renderPredictionsTab()}
        </TabsContent>

        <TabsContent value="timeseries" className="mt-6">
          {renderTimeSeriesTab()}
        </TabsContent>

        <TabsContent value="recommendations" className="mt-6">
          {renderRecommendationsTab()}
        </TabsContent>

        <TabsContent value="models" className="mt-6">
          {renderModelPerformanceTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MLAnalyticsDashboard;