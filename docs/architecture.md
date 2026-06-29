#AIOps Monitoring Agent Architecture
#GOAL
Build an AIOps system capable of:
Log collecting: Collect logs from services through HTTP endpoints and Docker services
Metrics scraping: Collect metrics (CPU, memory, request rate, error rate) from containers
Context building (MCP): When discover event of interest (error spike, abnormal latency), automatically gather the context surrounding it, the logs from +-5 minutes, metrics of the current state, log from related services\
AI Agent: Receive the Event + context bundle, call the LLM to assign a severity level, find the root cause, gives reccomendation
Alert manager: Manage alert cleverly, classified related alerts
#Techstack for the project
1.Backend: Node.JS + Typescript, express, prisma
2.AI Layer: Google Gemini API
3.Storage: ElasticSearch for logs collecting, PostGreSQL for state + incidents alert
4.Monitoring Stack: Docker Compose, Prometheus (Prometheus Monitoring with Julius | PromLabs )
5.Log collection: Docker API
#High level architecture diagram
Docker containers that is running applications —> Log Collector through Docker API → Metrics Scraper using Prometheus, CPU Memory usage through CAdvisor (works with Prometheus) → Anomaly Detector using data from Prometheus →  Find the event of interest → Context Builder (MCP) → AI Agent → CLI Output
#Components
Log collector
Responsibilities:
- Read docker container logs
- Normalize log format
- Store logs using ELK stack, store state + incidents alert using Postgres
Input: 
- Docker API stream
Output:
- Structured log records
Metrics Scrapers
Responsibilities:
- Query Prometheus metrics
- Collect CPU, memory, latency, error rate
Output:
- Metrics snapshot
Anomaly detector
Responsibilities:
- Detect latency spikes
- Detect error spikes
- Detect service failures
- (In Future) Use machine learning algorithms to better detect anomaly
Output: 
- Event of interest
Example:

{
type: "LATENCY_SPIKE",
service: "node-api"
}
Context builder
Responsibilities:
- Gather recent logs
- Gather related metrics
- Gather logs from dependent services
Problem: If we put every log into the context builder, it will build up token really quick and this is not good since it will be a waste
Fix: Use the summary field to my advantage and build a slim context window
Output:
Context bundle
{
event: {},
logs: [],
metrics: [],
relatedServices: []
}
AI Agent
Responsibilities:
- Analyze incidents
- Determine severity
- Suggest root causes
- Recommend remediation
Input: 
- Context bundle
Output:
Severity, root cause, and recommendations
Alert manager
Responsibilities:
- Group related incidents
- Avoid duplicated alerts
- Display alerts to user