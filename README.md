# Healthcare Knowledge Graph Explorer (Neo4j + Vector Search + GraphRAG)

An interactive medical dashboard designed to visualize relationships between **Patients**, **Diseases**, **Medicines**, **Doctors**, and **Symptoms** using a Neo4j graph database. The system integrates natural language **Semantic Search** using local SentenceTransformers (`all-MiniLM-L6-v2`) and **Grounded GraphRAG** with Claude 3.5 Sonnet to prevent clinical hallucinations.

---

## Key Features

1. **Interactive 2D Graph Visualizer**: Fully interactive node network rendering Patient, Disease, Medicine, Doctor, and Symptom paths. Color-coded nodes and highlighting support for active query results.
2. **Clinical Decision Support (Drug Conflict Detection)**: Automated background checker detecting Drug-Drug and Drug-Disease contraindications (e.g. Paxlovid vs Amlodipine, Ibuprofen vs Asthma) alerting providers of patient risks.
3. **Pre-built Cypher Console**: A developer pane executing 5 complex pre-defined clinical queries with single-click buttons + an open Cypher console.
4. **Natural Language Semantic Search**: Uses vector embeddings stored directly in Neo4j to find matches for clinical searches (e.g., searching "difficulty breathing and chronic fatigue" retrieves COVID-19 and Asthma).
5. **Claude 3.5 Sonnet GraphRAG**: An AI clinician chat that answers queries grounded strictly in the active graph path context, featuring a "Hallucination Prevention Active" safety badge.

---

## Tech Stack

*   **Frontend**: React (Vite) + `react-force-graph-2d` + `lucide-react`
*   **Backend**: Python FastAPI + `neo4j` Python Driver + `sentence-transformers` (for generating 384-dimensional dense vectors)
*   **AI Engine**: Anthropic Claude Python SDK (`claude-3-5-sonnet-20241022`)
*   **Database**: Neo4j (v5+ with Vector Index support)

---

## Project Structure

```text
/healthcare-graphrag
  /backend
    Dockerfile
    main.py          # FastAPI application routes
    neo4j_client.py  # Driver connection, schema constraints & queries
    embeddings.py    # sentence-transformers helper for dense embeddings
    seed_data.py     # Schema index definition and mock clinical database seeding
    requirements.txt # Python dependency file
  /frontend
    index.html       # Vite HTML entry point loading Google fonts
    vite.config.js   # Dev server proxying and configuration
    package.json     # Frontend dependencies
    /src
      main.jsx       # React bootstrap
      App.jsx        # Master state and dashboard layout coordinator
      index.css      # Custom styling sheets and colors
      /components
        StatsCards.jsx      # Dashboard numbers and conflict flashing alarms
        GraphVisualizer.jsx # react-force-graph-2d and metadata panel
        CypherPanel.jsx     # Pre-built queries and console console
        SemanticSearch.jsx  # Symptom-disease semantic searching
        AIChat.jsx          # Claude Grounded AI and badges
  docker-compose.yml # Orchestrates Neo4j + Backend containerization
  README.md          # Setup instructions
```

---

## Environment Setup (`.env`)

Ensure you have a `.env` file in your root workspace containing the following configuration:

```env
ANTHROPIC_API_KEY=your-claude-api-key-here
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=yourpassword
```

---

## Setup & Running Locally

### 1. Database Seeding & Setup

Run your Neo4j database container. Ensure ports `7474` (HTTP) and `7687` (Bolt) are accessible.

Create a virtual environment, activate it, and install dependencies:

```bash
# In the root workspace directory
python -m venv venv
venv\Scripts\activate

# Install requirements
pip install -r backend/requirements.txt
```

Seed the Neo4j schema indexes and load clinical mock records:

```bash
python -m backend.seed_data
```
*This script registers database constraints, creates vector indexes for Disease and Medicine embeddings, generates 384-dimensional dense embeddings for disease descriptions, and seeds patients, medications, and doctors.*

### 2. Run Python FastAPI Backend

With the virtual environment active, start the dev server:

```bash
python -m uvicorn backend.main:app --reload --port 8000
```
The API documentation will be interactive at [http://localhost:8000/docs](http://localhost:8000/docs).

### 3. Run React Frontend

In a separate terminal panel, navigate to `/frontend`:

```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the Healthcare GraphRAG Dashboard.

---

## Docker Compose Setup (Single Command)

If you prefer to run both Neo4j and the FastAPI backend inside Docker:

```bash
docker-compose up --build
```
*Note: Make sure to stop any local Neo4j instances running on port 7687 before starting Docker Compose to avoid port binding conflicts.*

---

## Verifying Features

*   **Drug-Disease Conflict Alerts**: Click on the red glowing "Conflict Alerts" card in the Stats board to filter the graph. You will see patient `Bob Brown` highlighted, who has **Asthma** and is prescribed **Ibuprofen** (a contraindicated drug-disease link), and patient `Frank Harris` who has **COVID-19** and is taking both **Paxlovid** and **Amlodipine** (contraindicated drug-drug link).
*   **Semantic Search**: Query `"shortness of breath and fever"` in the semantic search bar. The system uses sentence-transformers to calculate similarity and highlights **COVID-19** and **Asthma** in red, bringing their symptoms and treatment pathways to the visualizer.
*   **AI RAG Chatting**: After running a query, ask Claude: *"What is the risk profile for Frank Harris and what doctor is treating him?"*. Claude reads the returned graph context, sees that Frank is treated by Dr. Miller and is taking contraindicated medications Paxlovid + Amlodipine, and prints a structured clinical warning with a glowing checkmark: **"Hallucination Prevention Active"**.
