import type { WorkflowNode, WorkflowEdge } from '@/types';

export interface TemplateDefinition {
  name: string;
  description: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimated_time: string;
  featured?: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, unknown>;
  author?: string;
}

export const DEFAULT_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'Content Generator',
    description: 'Generate SEO-optimized content for marketing and social media using AI.',
    category: 'Marketing',
    difficulty: 'Beginner',
    estimated_time: '2 mins',
    featured: true,
    variables: {},
    nodes: [
      { id: '1', type: 'custom', position: { x: 100, y: 150 }, data: { node_type: 'webhook', label: 'Trigger: New Request', config: { url: 'https://dummyjson.com/posts/add' } } },
      { id: '2', type: 'custom', position: { x: 400, y: 150 }, data: { node_type: 'ai_prompt', label: 'AI Writer', config: { prompt: 'Write an SEO-optimized blog post about ${topic} including these keywords: ${keywords}.', system_prompt: 'You are an expert content marketer.' } } },
      { id: '3', type: 'custom', position: { x: 700, y: 150 }, data: { node_type: 'email', label: 'Send Draft', config: { to: 'marketing@company.com', subject: 'New Draft Ready: ${topic}', body: 'Here is the generated content:\n\n${ai_writer.result}' } } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' }
    ]
  },
  {
    name: 'Sales Analysis',
    description: 'Analyze weekly sales data from your CRM and identify emerging trends.',
    category: 'Analytics',
    difficulty: 'Intermediate',
    estimated_time: '5 mins',
    featured: true,
    variables: {},
    nodes: [
      { id: '1', type: 'custom', position: { x: 100, y: 150 }, data: { node_type: 'api_call', label: 'Fetch Sales Data', config: { url: 'https://dummyjson.com/products?limit=10', method: 'GET', headers: {} } } },
      { id: '2', type: 'custom', position: { x: 400, y: 150 }, data: { node_type: 'ai_prompt', label: 'Analyze Trends', config: { prompt: 'Analyze this sales data and provide 3 key insights: ${fetch_sales_data.response}', system_prompt: 'You are a senior data analyst.' } } },
      { id: '3', type: 'custom', position: { x: 700, y: 150 }, data: { node_type: 'database', label: 'Save Report', config: { operation: 'insert', table: 'sales_reports', data: { insights: '${analyze_trends.result}', date: '${current_date}' } } } },
      { id: '4', type: 'custom', position: { x: 1000, y: 150 }, data: { node_type: 'notification', label: 'Notify Team', config: { title: 'Weekly Sales Analysis Ready', message: 'The AI has identified new trends.', channel: 'Slack' } } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e3-4', source: '3', target: '4' }
    ]
  },
  {
    name: 'Report Generator',
    description: 'Generate and distribute periodic PDF reports via email.',
    category: 'Analytics',
    difficulty: 'Intermediate',
    estimated_time: '4 mins',
    variables: {},
    nodes: [
      { id: '1', type: 'custom', position: { x: 100, y: 150 }, data: { node_type: 'database', label: 'Fetch Analytics', config: { operation: 'select', table: 'analytics_daily', query: 'SELECT * FROM analytics_daily WHERE date >= date_sub(current_date, 7)' } } },
      { id: '2', type: 'custom', position: { x: 400, y: 150 }, data: { node_type: 'ai_prompt', label: 'Summarize Report', config: { prompt: 'Summarize the weekly analytics data into a short executive summary: ${fetch_analytics.result}' } } },
      { id: '3', type: 'custom', position: { x: 700, y: 150 }, data: { node_type: 'email', label: 'Distribute Report', config: { to: 'execs@company.com', subject: 'Weekly Analytics Report', body: '${summarize_report.result}' } } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' }
    ]
  },
  {
    name: 'CRM Update',
    description: 'Keep CRM records up to date automatically when a customer makes a purchase.',
    category: 'Sales',
    difficulty: 'Beginner',
    estimated_time: '1 min',
    variables: {},
    nodes: [
      { id: '1', type: 'custom', position: { x: 100, y: 150 }, data: { node_type: 'webhook', label: 'Stripe Webhook', config: { url: 'https://dummyjson.com/posts/add' } } },
      { id: '2', type: 'custom', position: { x: 400, y: 150 }, data: { node_type: 'condition', label: 'Check Payment Status', config: { condition: "${stripe_webhook.status} == 'succeeded'" } } },
      { id: '3', type: 'custom', position: { x: 700, y: 50 }, data: { node_type: 'api_call', label: 'Update CRM (Success)', config: { url: 'https://dummyjson.com/users/1', method: 'PUT', body: { firstName: 'Customer' } } } },
      { id: '4', type: 'custom', position: { x: 700, y: 250 }, data: { node_type: 'notification', label: 'Alert Sales (Failed)', config: { title: 'Payment Failed', message: 'Customer ${stripe_webhook.customer_email} payment failed.', channel: 'Slack' } } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3', sourceHandle: 'true' },
      { id: 'e2-4', source: '2', target: '4', sourceHandle: 'false' }
    ]
  },
  {
    name: 'HR Onboarding',
    description: 'Automate employee onboarding workflows by provisioning accounts and sending intro emails.',
    category: 'HR',
    difficulty: 'Advanced',
    estimated_time: '10 mins',
    featured: true,
    variables: {},
    nodes: [
      { id: '1', type: 'custom', position: { x: 100, y: 150 }, data: { node_type: 'webhook', label: 'HR System Trigger', config: { url: 'https://dummyjson.com/posts/add' } } },
      { id: '2', type: 'custom', position: { x: 400, y: 150 }, data: { node_type: 'api_call', label: 'Create Google Workspace', config: { url: 'https://dummyjson.com/users/add', method: 'POST', body: { email: '${employee_email}', firstName: '${first_name}' } } } },
      { id: '3', type: 'custom', position: { x: 700, y: 150 }, data: { node_type: 'delay', label: 'Wait for Sync', config: { duration: '30000' } } },
      { id: '4', type: 'custom', position: { x: 1000, y: 150 }, data: { node_type: 'email', label: 'Welcome Email', config: { to: '${employee_email}', subject: 'Welcome to the team, ${first_name}!', body: 'Your accounts are ready. Check out the onboarding doc.' } } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e3-4', source: '3', target: '4' }
    ]
  },
  {
    name: 'Customer Support AI',
    description: 'Automatically categorize and respond to simple customer support tickets.',
    category: 'Support',
    difficulty: 'Intermediate',
    estimated_time: '3 mins',
    variables: {},
    nodes: [
      { id: '1', type: 'custom', position: { x: 100, y: 150 }, data: { node_type: 'webhook', label: 'Zendesk Ticket', config: { url: 'https://dummyjson.com/posts/add' } } },
      { id: '2', type: 'custom', position: { x: 400, y: 150 }, data: { node_type: 'ai_prompt', label: 'Categorize & Respond', config: { prompt: 'Analyze this ticket: "${ticket_body}". 1) What is the category? 2) Draft a polite response.', system_prompt: 'You are a customer support agent. Return JSON with { category, response }' } } },
      { id: '3', type: 'custom', position: { x: 700, y: 150 }, data: { node_type: 'api_call', label: 'Update Ticket', config: { url: 'https://dummyjson.com/posts/1', method: 'PUT', body: { title: '${ai_response}' } } } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' }
    ]
  },
  {
    name: 'Lead Qualification',
    description: 'Score incoming leads via AI before adding them to the CRM.',
    category: 'Sales',
    difficulty: 'Intermediate',
    estimated_time: '4 mins',
    variables: {},
    nodes: [
      { id: '1', type: 'custom', position: { x: 100, y: 150 }, data: { node_type: 'webhook', label: 'Typeform Submit', config: { url: 'https://dummyjson.com/posts/add' } } },
      { id: '2', type: 'custom', position: { x: 400, y: 150 }, data: { node_type: 'ai_prompt', label: 'Score Lead', config: { prompt: 'Based on this company size (${company_size}) and budget (${budget}), score this lead out of 100.' } } },
      { id: '3', type: 'custom', position: { x: 700, y: 150 }, data: { node_type: 'condition', label: 'Score > 70?', config: { condition: "${score_lead.result} > 70" } } },
      { id: '4', type: 'custom', position: { x: 1000, y: 50 }, data: { node_type: 'api_call', label: 'Add to CRM (High Value)', config: { url: 'https://dummyjson.com/users/add', method: 'POST' } } },
      { id: '5', type: 'custom', position: { x: 1000, y: 250 }, data: { node_type: 'email', label: 'Nurture Campaign (Low Value)', config: { to: '${lead_email}', subject: 'Thanks for your interest' } } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e3-4', source: '3', target: '4', sourceHandle: 'true' },
      { id: 'e3-5', source: '3', target: '5', sourceHandle: 'false' }
    ]
  },
  {
    name: 'Social Media Scheduler',
    description: 'Generate multi-platform social posts and schedule them via Buffer or Hootsuite.',
    category: 'Marketing',
    difficulty: 'Beginner',
    estimated_time: '2 mins',
    variables: {},
    nodes: [
      { id: '1', type: 'custom', position: { x: 100, y: 150 }, data: { node_type: 'webhook', label: 'Blog RSS Feed', config: { url: 'https://dummyjson.com/posts/add' } } },
      { id: '2', type: 'custom', position: { x: 400, y: 150 }, data: { node_type: 'ai_prompt', label: 'Write Tweets & LinkedIn', config: { prompt: 'Turn this blog excerpt into a 280 character tweet and a professional LinkedIn post: ${blog_excerpt}' } } },
      { id: '3', type: 'custom', position: { x: 700, y: 150 }, data: { node_type: 'api_call', label: 'Schedule Post', config: { url: 'https://dummyjson.com/posts/add', method: 'POST', body: { title: '${ai_post_text}', userId: 1 } } } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' }
    ]
  },
  {
    name: 'Email Marketing',
    description: 'Automate customized email outreach campaigns based on user behavior.',
    category: 'Marketing',
    difficulty: 'Intermediate',
    estimated_time: '4 mins',
    featured: true,
    variables: {},
    nodes: [
      { id: '1', type: 'custom', position: { x: 100, y: 150 }, data: { node_type: 'database', label: 'Find Inactive Users', config: { operation: 'select', table: 'users', query: 'last_login < now() - interval 30 day' } } },
      { id: '2', type: 'custom', position: { x: 400, y: 150 }, data: { node_type: 'ai_prompt', label: 'Personalize Email', config: { prompt: 'Write a re-engagement email for ${user.first_name} who used feature ${user.favorite_feature}.' } } },
      { id: '3', type: 'custom', position: { x: 700, y: 150 }, data: { node_type: 'email', label: 'Send Outreach', config: { to: '${user.email}', subject: 'We miss you, ${user.first_name}!', body: '${personalize_email.result}' } } },
      { id: '4', type: 'custom', position: { x: 1000, y: 150 }, data: { node_type: 'database', label: 'Log Campaign', config: { operation: 'insert', table: 'email_logs' } } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e3-4', source: '3', target: '4' }
    ]
  },
  {
    name: 'Document Summarizer',
    description: 'Read uploaded documents and generate an AI-powered summary instantly.',
    category: 'Productivity',
    difficulty: 'Beginner',
    estimated_time: '1 min',
    variables: {},
    nodes: [
      { id: '1', type: 'custom', position: { x: 100, y: 150 }, data: { node_type: 'webhook', label: 'File Uploaded', config: { url: 'https://dummyjson.com/posts/add' } } },
      { id: '2', type: 'custom', position: { x: 400, y: 150 }, data: { node_type: 'api_call', label: 'Extract Text', config: { url: 'https://dummyjson.com/posts/1', method: 'GET' } } },
      { id: '3', type: 'custom', position: { x: 700, y: 150 }, data: { node_type: 'ai_prompt', label: 'Summarize Text', config: { prompt: 'Summarize the following text in 3 bullet points: ${extract_text.text}' } } },
      { id: '4', type: 'custom', position: { x: 1000, y: 150 }, data: { node_type: 'notification', label: 'Send Summary', config: { title: 'Document Summary', message: '${summarize_text.result}', channel: 'Email' } } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e3-4', source: '3', target: '4' }
    ]
  }
];

export const COMMUNITY_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'Social Media Poster',
    description: 'Auto-post across Twitter and LinkedIn.',
    category: 'Marketing',
    difficulty: 'Beginner',
    estimated_time: '2 mins',
    author: 'alex_dev',
    variables: {},
    nodes: [
      { id: '1', type: 'custom', position: { x: 100, y: 150 }, data: { node_type: 'webhook', label: 'Schedule Trigger', config: { url: 'https://dummyjson.com/posts/add' } } },
      { id: '2', type: 'custom', position: { x: 400, y: 150 }, data: { node_type: 'api_call', label: 'Post to LinkedIn', config: { url: 'https://dummyjson.com/posts/add', method: 'POST' } } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' }
    ]
  },
  {
    name: 'Weekly Metric Digest',
    description: 'Aggregate KPIs and send via Slack.',
    category: 'Analytics',
    difficulty: 'Intermediate',
    estimated_time: '5 mins',
    author: 'data_ninja',
    variables: {},
    nodes: [
      { id: '1', type: 'custom', position: { x: 100, y: 150 }, data: { node_type: 'database', label: 'Query KPIs', config: { operation: 'select', table: 'metrics' } } },
      { id: '2', type: 'custom', position: { x: 400, y: 150 }, data: { node_type: 'notification', label: 'Slack Notification', config: { channel: 'Slack', message: 'KPIs: ${metrics}' } } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' }
    ]
  }
];
