import { prisma } from './database.service';
import { FlakyTestDetectionService } from './flaky-test-detection.service';
import { logger } from '../utils/logger';

export interface RetryCondition {
  id: string;
  type: 'error_pattern' | 'test_pattern' | 'time_window' | 'failure_rate' | 'environment' | 'custom';
  operator: 'equals' | 'contains' | 'regex' | 'greater_than' | 'less_than' | 'between';
  value: string | number;
  metadata?: Record<string, any>;
}

export interface BackoffStrategy {
  type: 'immediate' | 'linear' | 'exponential' | 'fibonacci' | 'polynomial' | 'custom';
  baseDelay: number; // milliseconds
  maxDelay?: number; // milliseconds
  multiplier?: number;
  jitter?: boolean;
  jitterType?: 'uniform' | 'exponential';
  customFormula?: string; // For custom backoff
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number; // Number of consecutive failures to open circuit
  recoveryTimeout: number; // Time in ms before attempting recovery
  halfOpenMaxCalls: number; // Max calls to allow in half-open state
}

export interface RetryPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number; // Higher priority policies are evaluated first
  
  // Retry behavior
  maxRetries: number;
  backoffStrategy: BackoffStrategy;
  
  // Conditions when to apply this policy
  conditions: RetryCondition[];
  
  // Circuit breaker configuration
  circuitBreaker: CircuitBreakerConfig;
  
  // Time-based restrictions
  timeWindows?: Array<{
    startTime: string; // HH:MM format
    endTime: string;
    timezone: string;
    allowRetries: boolean;
  }>;
  
  // Advanced settings
  onlyFlakyTests: boolean;
  confidenceThreshold: number;
  concurrentRetryLimit?: number;
  retryBudget?: {
    maxRetriesPerHour: number;
    maxRetriesPerDay: number;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface RetryDecision {
  shouldRetry: boolean;
  reason: string;
  policyUsed?: string;
  retryAttempt: number;
  delayMs: number;
  confidence?: number;
  nextRetryAt?: Date;
  budgetRemaining?: {
    hourly: number;
    daily: number;
  };
}

export interface RetryAttemptResult {
  testName: string;
  testSuite?: string;
  policyId: string;
  attempt: number;
  result: 'success' | 'failure' | 'timeout' | 'skipped';
  duration: number;
  delayUsed: number;
  errorMessage?: string;
  timestamp: Date;
}

/**
 * Advanced retry policies service with intelligent backoff strategies,
 * conditional retry logic, circuit breakers, and comprehensive analytics
 */
export class AdvancedRetryPoliciesService {
  private static circuitBreakerStates = new Map<string, {
    state: 'closed' | 'open' | 'half-open';
    failureCount: number;
    lastFailureTime?: Date;
    halfOpenCallCount: number;
  }>();

  private static retryBudgets = new Map<string, {
    hourly: { count: number; resetTime: Date };
    daily: { count: number; resetTime: Date };
  }>();

  /**
   * Evaluate retry policies and determine if a test should be retried
   */
  static async evaluateRetryPolicies(
    projectId: string,
    testName: string,
    testSuite: string | undefined,
    currentAttempt: number,
    errorMessage?: string,
    context?: Record<string, any>
  ): Promise<RetryDecision> {
    try {
      // Get active retry policies for the project, ordered by priority
      const policies = await this.getActiveRetryPolicies(projectId);
      
      if (policies.length === 0) {
        return {
          shouldRetry: false,
          reason: 'No active retry policies configured',
          retryAttempt: currentAttempt,
          delayMs: 0,
        };
      }

      // Evaluate each policy in priority order
      for (const policy of policies) {
        logger.debug(`Evaluating retry policy: ${policy.name}`, {
          projectId,
          testName,
          policyId: policy.id,
        });

        const decision = await this.evaluatePolicy(
          policy,
          projectId,
          testName,
          testSuite,
          currentAttempt,
          errorMessage,
          context
        );

        // If policy says to retry, use it
        if (decision.shouldRetry) {
          logger.info(`Retry approved by policy: ${policy.name}`, {
            projectId,
            testName,
            policyId: policy.id,
            delayMs: decision.delayMs,
          });
          
          return {
            ...decision,
            policyUsed: policy.name,
          };
        }

        // If policy explicitly says not to retry (not just doesn't match), stop
        if (decision.reason.includes('blocked') || decision.reason.includes('exceeded')) {
          logger.info(`Retry blocked by policy: ${policy.name}`, {
            projectId,
            testName,
            policyId: policy.id,
            reason: decision.reason,
          });
          
          return decision;
        }
      }

      return {
        shouldRetry: false,
        reason: 'No retry policies matched the test conditions',
        retryAttempt: currentAttempt,
        delayMs: 0,
      };

    } catch (error) {
      logger.error('Error evaluating retry policies:', error);
      
      return {
        shouldRetry: false,
        reason: `Error evaluating policies: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryAttempt: currentAttempt,
        delayMs: 0,
      };
    }
  }

  /**
   * Evaluate a single retry policy
   */
  private static async evaluatePolicy(
    policy: RetryPolicy,
    projectId: string,
    testName: string,
    testSuite: string | undefined,
    currentAttempt: number,
    errorMessage?: string,
    context?: Record<string, any>
  ): Promise<RetryDecision> {
    // Check max retries
    if (currentAttempt >= policy.maxRetries) {
      return {
        shouldRetry: false,
        reason: `Maximum retries (${policy.maxRetries}) exceeded for policy ${policy.name}`,
        retryAttempt: currentAttempt,
        delayMs: 0,
      };
    }

    // Check circuit breaker
    const circuitBreakerResult = this.checkCircuitBreaker(policy, testName);
    if (!circuitBreakerResult.allowed) {
      return {
        shouldRetry: false,
        reason: `Circuit breaker is ${circuitBreakerResult.state} for policy ${policy.name}`,
        retryAttempt: currentAttempt,
        delayMs: 0,
      };
    }

    // Check retry budget
    const budgetResult = await this.checkRetryBudget(policy, projectId);
    if (!budgetResult.allowed) {
      return {
        shouldRetry: false,
        reason: `Retry budget exceeded for policy ${policy.name}: ${budgetResult.reason}`,
        retryAttempt: currentAttempt,
        delayMs: 0,
        budgetRemaining: budgetResult.remaining,
      };
    }

    // Check time windows
    if (!this.isWithinAllowedTimeWindow(policy)) {
      return {
        shouldRetry: false,
        reason: `Current time is outside allowed retry windows for policy ${policy.name}`,
        retryAttempt: currentAttempt,
        delayMs: 0,
      };
    }

    // Check if conditions match
    const conditionsMatch = await this.evaluateConditions(
      policy.conditions,
      testName,
      testSuite,
      errorMessage,
      context
    );

    if (!conditionsMatch) {
      return {
        shouldRetry: false,
        reason: `Test conditions do not match policy ${policy.name}`,
        retryAttempt: currentAttempt,
        delayMs: 0,
      };
    }

    // Check flaky test requirements
    if (policy.onlyFlakyTests) {
      const isFlaky = await FlakyTestDetectionService.isTestFlaky(
        projectId,
        testName,
        testSuite
      );

      if (!isFlaky) {
        return {
          shouldRetry: false,
          reason: `Test is not identified as flaky (required by policy ${policy.name})`,
          retryAttempt: currentAttempt,
          delayMs: 0,
        };
      }

      // Check confidence threshold
      const flakyPattern = await this.getFlakyTestPattern(projectId, testName, testSuite);
      const confidence = flakyPattern?.confidence || 0;

      if (confidence < policy.confidenceThreshold) {
        return {
          shouldRetry: false,
          reason: `Flaky confidence (${Math.round(confidence * 100)}%) below threshold (${Math.round(policy.confidenceThreshold * 100)}%) for policy ${policy.name}`,
          retryAttempt: currentAttempt,
          delayMs: 0,
          confidence,
        };
      }
    }

    // Calculate delay using backoff strategy
    const delayMs = this.calculateBackoffDelay(
      policy.backoffStrategy,
      currentAttempt + 1
    );

    const nextRetryAt = new Date(Date.now() + delayMs);

    return {
      shouldRetry: true,
      reason: `Retry approved by policy ${policy.name}`,
      retryAttempt: currentAttempt + 1,
      delayMs,
      nextRetryAt,
      budgetRemaining: budgetResult.remaining,
    };
  }

  /**
   * Calculate backoff delay based on strategy
   */
  private static calculateBackoffDelay(
    strategy: BackoffStrategy,
    attempt: number
  ): number {
    let delay: number;

    switch (strategy.type) {
      case 'immediate':
        delay = 0;
        break;

      case 'linear':
        delay = strategy.baseDelay * attempt;
        break;

      case 'exponential':
        delay = strategy.baseDelay * Math.pow(strategy.multiplier || 2, attempt - 1);
        break;

      case 'fibonacci':
        delay = strategy.baseDelay * this.fibonacciNumber(attempt);
        break;

      case 'polynomial':
        const power = strategy.multiplier || 2;
        delay = strategy.baseDelay * Math.pow(attempt, power);
        break;

      case 'custom':
        delay = this.evaluateCustomFormula(strategy.customFormula || '', attempt, strategy.baseDelay);
        break;

      default:
        delay = strategy.baseDelay;
    }

    // Apply max delay limit
    if (strategy.maxDelay && delay > strategy.maxDelay) {
      delay = strategy.maxDelay;
    }

    // Apply jitter if enabled
    if (strategy.jitter) {
      delay = this.applyJitter(delay, strategy.jitterType || 'uniform');
    }

    return Math.max(0, Math.round(delay));
  }

  /**
   * Apply jitter to delay
   */
  private static applyJitter(delay: number, jitterType: 'uniform' | 'exponential'): number {
    switch (jitterType) {
      case 'uniform':
        // Add random jitter up to 25% of the delay
        const jitter = Math.random() * 0.25 * delay;
        return delay + jitter;

      case 'exponential':
        // Exponential jitter
        const factor = Math.random();
        return delay * factor;

      default:
        return delay;
    }
  }

  /**
   * Calculate Fibonacci number for backoff
   */
  private static fibonacciNumber(n: number): number {
    if (n <= 1) return 1;
    if (n === 2) return 1;
    
    let a = 1, b = 1;
    for (let i = 3; i <= n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return b;
  }

  /**
   * Evaluate custom backoff formula
   */
  private static evaluateCustomFormula(formula: string, attempt: number, baseDelay: number): number {
    try {
      // Simple formula evaluation with security restrictions
      const sanitizedFormula = formula.replace(/[^0-9+\-*/()\s.attempt baseDelay Math.pow Math.log Math.sqrt]/g, '');
      
      // Replace variables
      const processedFormula = sanitizedFormula
        .replace(/\battempt\b/g, attempt.toString())
        .replace(/\bbaseDelay\b/g, baseDelay.toString());

      // Use Function constructor with restricted scope
      const evaluator = new Function('Math', `return ${processedFormula}`);
      const result = evaluator(Math);

      return typeof result === 'number' && !isNaN(result) ? result : baseDelay;
    } catch (error) {
      logger.warn('Failed to evaluate custom backoff formula:', error);
      return baseDelay;
    }
  }

  /**
   * Check circuit breaker state
   */
  private static checkCircuitBreaker(
    policy: RetryPolicy,
    testIdentifier: string
  ): { allowed: boolean; state: string } {
    if (!policy.circuitBreaker.enabled) {
      return { allowed: true, state: 'disabled' };
    }

    const key = `${policy.id}:${testIdentifier}`;
    const state = this.circuitBreakerStates.get(key) || {
      state: 'closed' as const,
      failureCount: 0,
      halfOpenCallCount: 0,
    };

    const now = new Date();

    switch (state.state) {
      case 'closed':
        return { allowed: true, state: 'closed' };

      case 'open':
        // Check if recovery timeout has passed
        if (state.lastFailureTime && 
            now.getTime() - state.lastFailureTime.getTime() >= policy.circuitBreaker.recoveryTimeout) {
          // Move to half-open state
          state.state = 'half-open';
          state.halfOpenCallCount = 0;
          this.circuitBreakerStates.set(key, state);
          return { allowed: true, state: 'half-open' };
        }
        return { allowed: false, state: 'open' };

      case 'half-open':
        if (state.halfOpenCallCount < policy.circuitBreaker.halfOpenMaxCalls) {
          return { allowed: true, state: 'half-open' };
        }
        return { allowed: false, state: 'half-open-saturated' };

      default:
        return { allowed: true, state: 'unknown' };
    }
  }

  /**
   * Update circuit breaker state based on retry result
   */
  static updateCircuitBreaker(
    policyId: string,
    testIdentifier: string,
    success: boolean,
    circuitBreakerConfig: CircuitBreakerConfig
  ): void {
    if (!circuitBreakerConfig.enabled) return;

    const key = `${policyId}:${testIdentifier}`;
    const state = this.circuitBreakerStates.get(key) || {
      state: 'closed' as const,
      failureCount: 0,
      halfOpenCallCount: 0,
    };

    if (success) {
      // Reset failure count on success
      state.failureCount = 0;
      
      if (state.state === 'half-open') {
        // Close circuit after successful half-open calls
        state.state = 'closed';
        state.halfOpenCallCount = 0;
      }
    } else {
      // Increment failure count
      state.failureCount++;
      state.lastFailureTime = new Date();

      if (state.state === 'half-open') {
        // Failed in half-open, go back to open
        state.state = 'open';
        state.halfOpenCallCount = 0;
      } else if (state.failureCount >= circuitBreakerConfig.failureThreshold) {
        // Open circuit breaker
        state.state = 'open';
      }
    }

    if (state.state === 'half-open') {
      state.halfOpenCallCount++;
    }

    this.circuitBreakerStates.set(key, state);
  }

  /**
   * Check retry budget limits
   */
  private static async checkRetryBudget(
    policy: RetryPolicy,
    projectId: string
  ): Promise<{ allowed: boolean; reason?: string; remaining?: { hourly: number; daily: number } }> {
    if (!policy.retryBudget) {
      return { allowed: true };
    }

    const key = `${policy.id}:${projectId}`;
    const now = new Date();
    
    let budget = this.retryBudgets.get(key);
    
    // Initialize or reset budgets if needed
    if (!budget) {
      budget = {
        hourly: { count: 0, resetTime: new Date(now.getTime() + 60 * 60 * 1000) },
        daily: { count: 0, resetTime: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      };
      this.retryBudgets.set(key, budget);
    }

    // Reset hourly budget if expired
    if (now >= budget.hourly.resetTime) {
      budget.hourly = { count: 0, resetTime: new Date(now.getTime() + 60 * 60 * 1000) };
    }

    // Reset daily budget if expired
    if (now >= budget.daily.resetTime) {
      budget.daily = { count: 0, resetTime: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
    }

    const remaining = {
      hourly: Math.max(0, policy.retryBudget.maxRetriesPerHour - budget.hourly.count),
      daily: Math.max(0, policy.retryBudget.maxRetriesPerDay - budget.daily.count),
    };

    // Check limits
    if (budget.hourly.count >= policy.retryBudget.maxRetriesPerHour) {
      return {
        allowed: false,
        reason: `Hourly retry budget exceeded (${policy.retryBudget.maxRetriesPerHour})`,
        remaining,
      };
    }

    if (budget.daily.count >= policy.retryBudget.maxRetriesPerDay) {
      return {
        allowed: false,
        reason: `Daily retry budget exceeded (${policy.retryBudget.maxRetriesPerDay})`,
        remaining,
      };
    }

    return { allowed: true, remaining };
  }

  /**
   * Consume retry budget
   */
  static consumeRetryBudget(policyId: string, projectId: string): void {
    const key = `${policyId}:${projectId}`;
    const budget = this.retryBudgets.get(key);
    
    if (budget) {
      budget.hourly.count++;
      budget.daily.count++;
    }
  }

  /**
   * Check if current time is within allowed retry windows
   */
  private static isWithinAllowedTimeWindow(policy: RetryPolicy): boolean {
    if (!policy.timeWindows || policy.timeWindows.length === 0) {
      return true; // No restrictions
    }

    const now = new Date();
    
    return policy.timeWindows.some(window => {
      // Parse time strings (HH:MM format)
      const [startHour, startMinute] = window.startTime.split(':').map(Number);
      const [endHour, endMinute] = window.endTime.split(':').map(Number);
      
      // Create time objects for comparison (using current date)
      const startTime = new Date(now);
      startTime.setHours(startHour, startMinute, 0, 0);
      
      const endTime = new Date(now);
      endTime.setHours(endHour, endMinute, 0, 0);
      
      // Handle cross-midnight windows
      if (endTime <= startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }
      
      const withinWindow = now >= startTime && now <= endTime;
      
      return window.allowRetries ? withinWindow : !withinWindow;
    });
  }

  /**
   * Evaluate retry conditions
   */
  private static async evaluateConditions(
    conditions: RetryCondition[],
    testName: string,
    testSuite: string | undefined,
    errorMessage?: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    if (conditions.length === 0) {
      return true; // No conditions means always match
    }

    // All conditions must match (AND logic)
    for (const condition of conditions) {
      const matches = await this.evaluateCondition(
        condition,
        testName,
        testSuite,
        errorMessage,
        context
      );
      
      if (!matches) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  private static async evaluateCondition(
    condition: RetryCondition,
    testName: string,
    testSuite: string | undefined,
    errorMessage?: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    let actualValue: any;

    // Get the actual value based on condition type
    switch (condition.type) {
      case 'error_pattern':
        actualValue = errorMessage || '';
        break;

      case 'test_pattern':
        actualValue = testName;
        break;

      case 'time_window':
        actualValue = new Date().getHours();
        break;

      case 'failure_rate':
        // Would need to calculate actual failure rate
        actualValue = context?.failureRate || 0;
        break;

      case 'environment':
        actualValue = context?.environment || process.env.NODE_ENV || '';
        break;

      case 'custom':
        actualValue = context?.[condition.metadata?.field || ''] || '';
        break;

      default:
        return false;
    }

    // Apply the operator
    return this.applyOperator(actualValue, condition.operator, condition.value);
  }

  /**
   * Apply comparison operator
   */
  private static applyOperator(
    actualValue: any,
    operator: string,
    expectedValue: string | number
  ): boolean {
    switch (operator) {
      case 'equals':
        return actualValue === expectedValue;

      case 'contains':
        return String(actualValue).includes(String(expectedValue));

      case 'regex':
        try {
          const regex = new RegExp(String(expectedValue));
          return regex.test(String(actualValue));
        } catch {
          return false;
        }

      case 'greater_than':
        return Number(actualValue) > Number(expectedValue);

      case 'less_than':
        return Number(actualValue) < Number(expectedValue);

      case 'between':
        if (Array.isArray(expectedValue) && expectedValue.length === 2) {
          const num = Number(actualValue);
          return num >= Number(expectedValue[0]) && num <= Number(expectedValue[1]);
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Get active retry policies for a project
   */
  private static async getActiveRetryPolicies(projectId: string): Promise<RetryPolicy[]> {
    // This would typically fetch from database
    // For now, return default policies - in real implementation, would use Prisma
    
    const defaultPolicies: RetryPolicy[] = [
      {
        id: 'flaky-tests-policy',
        name: 'Flaky Tests Policy',
        description: 'Retry known flaky tests with exponential backoff',
        enabled: true,
        priority: 100,
        maxRetries: 3,
        backoffStrategy: {
          type: 'exponential',
          baseDelay: 1000,
          maxDelay: 30000,
          multiplier: 2,
          jitter: true,
          jitterType: 'uniform',
        },
        conditions: [],
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          recoveryTimeout: 60000,
          halfOpenMaxCalls: 3,
        },
        onlyFlakyTests: true,
        confidenceThreshold: 0.7,
        retryBudget: {
          maxRetriesPerHour: 50,
          maxRetriesPerDay: 200,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
      },
    ];

    return defaultPolicies;
  }

  /**
   * Get flaky test pattern from database
   */
  private static async getFlakyTestPattern(
    projectId: string,
    testName: string,
    testSuite?: string
  ) {
    const whereClause = {
      projectId,
      testName,
      ...(testSuite ? { testSuite } : { testSuite: null }),
    };

    return await prisma.flakyTestPattern.findUnique({
      where: {
        projectId_testName_testSuite: whereClause as any,
      },
    });
  }

  /**
   * Record retry attempt result
   */
  static async recordRetryAttempt(result: RetryAttemptResult): Promise<void> {
    try {
      // In a real implementation, this would save to a retry_attempts table
      logger.info('Retry attempt recorded', {
        testName: result.testName,
        policyId: result.policyId,
        attempt: result.attempt,
        result: result.result,
        duration: result.duration,
      });

      // Update circuit breaker based on result
      const policy = (await this.getActiveRetryPolicies('')).find(p => p.id === result.policyId);
      if (policy) {
        this.updateCircuitBreaker(
          result.policyId,
          `${result.testName}:${result.testSuite || ''}`,
          result.result === 'success',
          policy.circuitBreaker
        );
      }

    } catch (error) {
      logger.error('Failed to record retry attempt:', error);
    }
  }
}