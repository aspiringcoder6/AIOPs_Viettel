#AIOps Monitoring Agent Architecture
#GOAL
Build an AIOps system capable of:
Log collecting: Collect logs from services through HTTP endpoints and Docker services
Metrics scraping: Collect metrics (CPU, memory, request rate, error rate) from containers (Done)
Context building (MCP): When discover event of interest (error spike, abnormal latency), automatically gather the context surrounding it, the logs from +-5 minutes, metrics of the current state, log from related services (Done)
AI Agent: Receive the Event + context bundle, call the LLM to assign a severity level, find the root cause, gives reccomendation (Done)
Alert manager: Manage alert cleverly, classified related alerts (Done)
#Techstack for the project 
1.Backend: Node.JS + Typescript, express, prisma
2.AI Layer: Google Gemini API
3.Storage: ElasticSearch for logs collecting, PostGreSQL for state + incidents alert
4.Monitoring Stack: Docker Compose, Prometheus (Prometheus Monitoring with Julius | PromLabs )
5.Log collection: Docker API
#High level architecture diagram
Docker containers that is running applications —> Log Collector through Docker API → Metrics Scraper using Prometheus, CPU Memory usage through CAdvisor (works with Prometheus) → Anomaly Detector using data from Prometheus →  Find the event of interest → Context Builder (MCP) → AI Agent → CLI Output / Dashboard visualization
#Components
Log collector
Responsibilities:
- Read docker container logs
- Normalize log format
- Store logs using ELK stack, store state + incidents alert using Postgres
- Pull logs from the event service as well as related services through the service_dependencies table
- Prioritize ERROR/WARN logs from the other dependant service. 
Input: 
- Docker API stream
Output:
- Structured log records
Metrics Scrapers
Responsibilities:
- Query Prometheus metrics
- Collect CPU, memory, latency, error rate
Output:
- Metrics snapshot that are compacted into service/value groups instead of full Prometheus responses
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
Context builder has service dependency awereness, using the service dependencies table, that for now, the relations inside are created and set by the designer of the system. So if someone use this, they have to define all different relationships between parts of their system for it to work.
Responsibilities:
- Gather recent logs
- Gather related metrics
- Gather logs from dependent services
- Rank the logs by relevance and capped with CONTEXT_MAX_LOGS
Problem: If we put every log into the context builder, it will build up token really quick and this is not good since it will be a waste
Fix: Use the summary field to my advantage and build a slim context window
Problem 2: If we put a limit on logs, we may miss out on important logs when sending to AI Agent
Fix 2: Add a relevancy score to each logs, such that when we rank them and we limit them, we can get more relevant logs to the problem
Better Fix 2: Pass the top level thread to AI Agent and make it decide which logs to read to find the root cause of the problem (IN FUTURE)
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
- Send mail to user if service is down due to errors (IF ENOUGH TIME)
Dashboard Visualization:
Techstack:
- Frontend: ReactJS
- Backend: NodeJS to receive data from AIOps backend
Input:
- Data from PostgreSQL and Elastic Search 
Ouput:
- Alert visualization/ recommendation
- Incidents table and specific incidents info
- Data, metrics recordings