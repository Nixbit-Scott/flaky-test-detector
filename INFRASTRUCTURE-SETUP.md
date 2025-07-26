# Infrastructure Setup Guide

## Budget Analysis ($200 AUD/month)

### Current Infrastructure Costs
- **Supabase Pro**: $25 USD (~$38 AUD) - Database + Auth
- **Netlify Pro**: $19 USD (~$29 AUD) - Functions + Hosting  
- **Domain**: ~$15 AUD/year (~$1.25 AUD/month)

**Total Current**: ~$68 AUD/month
**Remaining Budget**: ~$132 AUD/month

### Email Service Options

#### Option 1: SendGrid (Recommended)
```
Free tier: 100 emails/day
Essentials: $19.95 USD (~$30 AUD) for 40k emails/month
Pro: $89.95 USD (~$135 AUD) for 100k emails/month
```
**Recommendation**: Start with Essentials plan
**Cost**: ~$30 AUD/month

#### Option 2: Postmark
```
Developer: $10 USD (~$15 AUD) for 10k emails/month
Standard: $50 USD (~$75 AUD) for 50k emails/month
```
**Recommendation**: Start with Developer plan
**Cost**: ~$15 AUD/month

#### Option 3: AWS SES (Most Cost-Effective)
```
$0.10 per 1,000 emails
~$5 AUD for 50k emails/month
```
**Recommendation**: Best for high volume, requires more setup
**Cost**: ~$5-10 AUD/month

### Custom Monitoring vs External Services

#### External Services (What we're avoiding)
- **Sentry**: $26 USD (~$40 AUD) for 10k errors/month
- **Datadog**: $15 USD (~$23 AUD) per host
- **New Relic**: $25 USD (~$38 AUD) per month

#### Our Custom Solution
- **Cost**: $0 additional (uses existing Supabase + Netlify)
- **Storage**: Monitoring data stored in existing Supabase database
- **Processing**: Uses existing Netlify Functions
- **Dashboard**: Custom React dashboard hosted on Netlify

## Final Budget Allocation

```
Current Infrastructure:     $68 AUD
Email Service (Postmark):   $15 AUD
Buffer for growth:          $117 AUD
                           -----------
Total:                     $200 AUD
```

## Setup Instructions

### 1. Email Service Setup

#### For Postmark (Recommended)
1. Sign up at [postmarkapp.com](https://postmarkapp.com)
2. Create a server and get your Server Token
3. Add to Netlify environment variables:
   ```
   POSTMARK_SERVER_TOKEN=your_token_here
   FROM_EMAIL=noreply@nixbit.dev
   FROM_NAME=Nixbit Flaky Test Detector
   ```

#### For SendGrid (Alternative)
1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create an API key with mail send permissions
3. Add to Netlify environment variables:
   ```
   SENDGRID_API_KEY=your_api_key_here
   FROM_EMAIL=noreply@nixbit.dev
   FROM_NAME=Nixbit Flaky Test Detector
   ```

### 2. Database Migration
Run the database migration to add monitoring tables:

```bash
cd backend
npx prisma migrate dev --name add-monitoring-logs
npx prisma generate
```

### 3. Deploy Monitoring Functions
The following new functions will be deployed automatically:
- `/.netlify/functions/email` - Email sending service
- `/.netlify/functions/monitor` - Monitoring data collection
- `/.netlify/functions/monitor/metrics` - System metrics API
- `/.netlify/functions/monitor/health` - Health check API
- `/.netlify/functions/monitor/alerts` - Alerts API

### 4. Admin Dashboard Setup
The admin dashboard will be available at `/admin` route with:
- Real-time system metrics
- Error tracking and alerts
- Performance monitoring
- Health status checks

### 5. Monitoring Integration
Use the monitoring utilities in existing functions:

```typescript
import { createMonitor, extractUserContext } from './monitoring-utils';

export const handler = async (event, context) => {
  const monitor = createMonitor('function-name');
  
  try {
    // Your function logic
    const result = await yourFunction();
    
    // Log success
    await monitor.logPerformance();
    
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    // Log error with context
    await monitor.logError(error, extractUserContext(event));
    throw error;
  }
};
```

## Monitoring Features

### 1. Error Tracking
- Automatic error logging with stack traces
- Error rate monitoring and alerting
- Function-specific error analytics

### 2. Performance Monitoring
- Response time tracking
- Function execution metrics
- Cold start detection

### 3. Health Monitoring
- Database connectivity checks
- System status overview
- Service degradation detection

### 4. Custom Alerts
- Email notifications for critical errors
- Threshold-based alerting
- Pattern detection for repeated issues

### 5. Admin Dashboard
- Real-time metrics visualization
- Historical data analysis
- User activity tracking

## Cost Comparison

### Custom Solution Total Cost
```
Existing infrastructure:    $68 AUD
Email service (Postmark):   $15 AUD
                           -----------
Total:                     $83 AUD/month
Savings vs external:       $117 AUD/month
```

### External Services Cost
```
Current infrastructure:     $68 AUD
Sentry:                    $40 AUD
Email service:             $15 AUD
Monitoring service:        $25 AUD
                           -----------
Total:                     $148 AUD/month
```

**Monthly Savings**: $65 AUD (~$780 AUD/year)

## Maintenance and Scaling

### Data Retention
- Monitoring logs: 30 days (configurable)
- Error logs: 90 days
- Performance metrics: 7 days detailed, 30 days aggregated

### Scaling Considerations
- Monitoring data is stored in Supabase (included in current plan)
- Functions scale automatically with Netlify
- Email costs scale with usage

### Future Enhancements
- Automated weekly reports
- Slack/Discord integration
- Custom metric dashboards
- API response time tracking

This setup provides enterprise-grade monitoring at a fraction of the cost of external services while staying well within your $200 AUD budget.