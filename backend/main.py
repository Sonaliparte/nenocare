import os
import logging
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic
from dotenv import load_dotenv

# Import our custom modules
from backend.embeddings import get_embedding
from backend.neo4j_client import Neo4jClient
from backend.seed_data import seed_database

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Healthcare GraphRAG API", version="1.0.0")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Neo4j client
neo4j_client = Neo4jClient()

# Initialize Anthropic Claude Client
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    logger.warning("ANTHROPIC_API_KEY not found in environment variables. AI analysis endpoint will fail.")

claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

# Pydantic schemas for request validation
class CypherQueryRequest(BaseModel):
    query: str
    parameters: Optional[Dict[str, Any]] = None

class VectorSearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 3

class AIAnalyzeRequest(BaseModel):
    query: str
    graph_context: Dict[str, Any]

@app.on_event("shutdown")
def shutdown_event():
    neo4j_client.close()

@app.get("/")
def read_root():
    return {"message": "Healthcare GraphRAG Backend is running."}

@app.post("/seed")
def seed_db():
    """
    Trigger database seeding. Clears and seeds database.
    """
    try:
        seed_database()
        return {"status": "success", "message": "Database successfully seeded with mock clinical data."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database seeding failed: {str(e)}")

@app.post("/query/cypher")
def execute_cypher(req: CypherQueryRequest):
    """
    Execute any Cypher query. Returns tabular results + graph nodes/edges.
    """
    try:
        result = neo4j_client.execute_and_format(req.query, req.parameters)
        return result
    except Exception as e:
        logger.error(f"Cypher error: {e}")
        raise HTTPException(status_code=400, detail=f"Cypher execution failed: {str(e)}")

@app.post("/search/vector")
def vector_search(req: VectorSearchRequest):
    """
    Semantic vector search on Disease embeddings. 
    Encodes query text and matches using Neo4j vector search index.
    """
    try:
        query_vector = get_embedding(req.query)
        result = neo4j_client.vector_search_diseases(query_vector, limit=req.limit)
        return result
    except Exception as e:
        logger.error(f"Vector search error: {e}")
        raise HTTPException(status_code=500, detail=f"Vector search failed: {str(e)}")

@app.get("/graph/full")
def get_full_graph():
    """
    Return full database graph (nodes and relationships) for the visualizer.
    """
    try:
        return neo4j_client.get_full_graph()
    except Exception as e:
        logger.error(f"Error fetching full graph: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch full graph: {str(e)}")

@app.get("/alerts/drug-conflicts")
def get_drug_conflicts():
    """
    Return all active drug conflicts in the database.
    """
    try:
        return neo4j_client.get_all_drug_disease_conflicts()
    except Exception as e:
        logger.error(f"Error fetching drug conflicts: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch drug conflicts: {str(e)}")

@app.post("/ai/analyze")
def ai_analyze(req: AIAnalyzeRequest):
    """
    Run Claude API with the current graph context.
    Instructs the LLM to strictly base answers on provided clinical graph records to prevent hallucinations.
    """
    if not claude_client:
        raise HTTPException(status_code=500, detail="Anthropic Claude client is not configured. ANTHROPIC_API_KEY is missing.")
    
    try:
        # Format graph nodes and links into a structured string context
        nodes = req.graph_context.get("nodes", [])
        links = req.graph_context.get("links", [])
        
        if not nodes and not links:
            # Fallback if no context was selected or passed
            context_text = "No active graph context provided. The database query returned no matching nodes or edges."
            is_grounded = False
        else:
            is_grounded = True
            context_text = "### Knowledge Graph Nodes:\n"
            for node in nodes:
                properties = ", ".join(f"{k}: {v}" for k, v in node.get("properties", {}).items())
                context_text += f"- Label: [{node.get('group')}] | Name: {node.get('label')} | Properties: {{{properties}}}\n"
            
            context_text += "\n### Knowledge Graph Relationships (Connections):\n"
            # Map node IDs to node names for readable paths
            id_to_name = {n["id"]: f"{n['label']} ({n['group']})" for n in nodes}
            for link in links:
                source_name = id_to_name.get(link["source"], f"ID:{link['source']}")
                target_name = id_to_name.get(link["target"], f"ID:{link['target']}")
                properties = ", ".join(f"{k}: {v}" for k, v in link.get("properties", {}).items())
                context_text += f"- {source_name} -[:{link['type']} {{{properties}}}]-> {target_name}\n"

        system_prompt = (
            "You are a clinical GraphRAG assistant. You analyze patient medical records, diseases, "
            "symptoms, doctors, and drug contraindications based ON the provided Neo4j Graph Context.\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. Rely ONLY on the clear facts in the Graph Context. Do NOT make up any connections or clinical facts.\n"
            "2. If the Graph Context does not contain the answer or does not mention the patient/medicine/disease, "
            "explicitly state: 'Based on the current Neo4j graph context, I cannot find this information.'\n"
            "3. Identify drug-disease and drug-drug contraindications if visible in the context (e.g. Paxlovid + Amlodipine "
            "or Ibuprofen + Asthma) and explain why the patient is at risk.\n"
            "4. Keep your answer highly professional, clinical, concise, and structured (use bullet points)."
        )
        
        user_message = f"Graph Context:\n{context_text}\n\nQuestion: {req.query}"
        
        logger.info("Sending request to Claude...")
        message = claude_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            temperature=0.0,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_message}
            ]
        )
        
        ai_response = message.content[0].text
        
        return {
            "answer": ai_response,
            "grounded": is_grounded,
            "context_summary": f"Analyzed {len(nodes)} nodes and {len(links)} relationships."
        }
        
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
