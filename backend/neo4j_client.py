import os
import logging
from dotenv import load_dotenv
from neo4j import GraphDatabase
from neo4j.graph import Node, Relationship, Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")

class Neo4jClient:
    def __init__(self):
        self.driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))

    def close(self):
        self.driver.close()

    def query(self, cypher_query, parameters=None):
        """
        Execute a Cypher query and return raw records.
        """
        with self.driver.session() as session:
            result = session.run(cypher_query, parameters or {})
            return [dict(record) for record in result]

    def execute_and_format(self, cypher_query, parameters=None):
        """
        Execute a Cypher query, extract nodes/links for graph visualization, 
        and return table format results alongside graph data.
        """
        with self.driver.session() as session:
            result = session.run(cypher_query, parameters or {})
            records = [dict(record) for record in result]
            
            # Extract graph data
            graph_data = self.parse_graph_from_records(records)
            
            # Format clean table records (remove path objects from JSON response)
            table_records = []
            for record in records:
                clean_record = {}
                for k, v in record.items():
                    if isinstance(v, (Node, Relationship, Path, list)):
                        # Skip or format if list contains graph elements
                        if isinstance(v, list) and len(v) > 0 and isinstance(v[0], (Node, Relationship, Path)):
                            continue
                        continue
                    clean_record[k] = v
                if clean_record:
                    table_records.append(clean_record)
                else:
                    # If query returns nodes directly
                    table_records.append({k: (v.get("name") if isinstance(v, Node) else str(v)) for k, v in record.items()})

            return {
                "table": table_records if table_records else records,
                "graph": graph_data
            }

    def parse_graph_from_records(self, records):
        """
        Parses list of records from Neo4j driver and extracts unique nodes and relationships.
        """
        nodes_dict = {}
        links_list = []
        seen_links = set()

        def add_node(node):
            if isinstance(node, Node):
                # element_id is unique across Neo4j
                node_id = str(node.element_id)
                labels = list(node.labels)
                group = labels[0] if labels else "Unknown"
                
                # Exclude embedding from properties to keep payload light
                props = dict(node)
                if "embedding" in props:
                    del props["embedding"]

                nodes_dict[node_id] = {
                    "id": node_id,
                    "label": props.get("name", "Unnamed"),
                    "group": group,
                    "properties": props
                }

        def add_rel(rel):
            if isinstance(rel, Relationship):
                start_id = str(rel.start_node.element_id)
                end_id = str(rel.end_node.element_id)
                rel_id = str(rel.element_id)
                
                add_node(rel.start_node)
                add_node(rel.end_node)
                
                link_key = f"{start_id}-{end_id}-{rel.type}"
                if link_key not in seen_links:
                    seen_links.add(link_key)
                    links_list.append({
                        "id": rel_id,
                        "source": start_id,
                        "target": end_id,
                        "type": rel.type,
                        "properties": dict(rel)
                    })

        for record in records:
            for val in record.values():
                if isinstance(val, Node):
                    add_node(val)
                elif isinstance(val, Relationship):
                    add_rel(val)
                elif isinstance(val, Path):
                    for node in val.nodes:
                        add_node(node)
                    for rel in val.relationships:
                        add_rel(rel)
                elif isinstance(val, list):
                    for item in val:
                        if isinstance(item, Node):
                            add_node(item)
                        elif isinstance(item, Relationship):
                            add_rel(item)
                        elif isinstance(item, Path):
                            for node in item.nodes:
                                add_node(node)
                            for rel in item.relationships:
                                add_rel(rel)

        return {
            "nodes": list(nodes_dict.values()),
            "links": links_list
        }

    def init_database_indexes(self):
        """
        Creates constraints and vector indexes for Disease and Medicine embeddings.
        """
        queries = [
            # Unique ID constraints
            "CREATE CONSTRAINT patient_id_unique IF NOT EXISTS FOR (p:Patient) REQUIRE p.id IS UNIQUE",
            "CREATE CONSTRAINT disease_id_unique IF NOT EXISTS FOR (d:Disease) REQUIRE d.id IS UNIQUE",
            "CREATE CONSTRAINT medicine_id_unique IF NOT EXISTS FOR (m:Medicine) REQUIRE m.id IS UNIQUE",
            "CREATE CONSTRAINT doctor_id_unique IF NOT EXISTS FOR (d:Doctor) REQUIRE d.id IS UNIQUE",
            "CREATE CONSTRAINT symptom_id_unique IF NOT EXISTS FOR (s:Symptom) REQUIRE s.id IS UNIQUE",
            
            # Vector Index for Diseases
            """
            CREATE VECTOR INDEX disease_embeddings IF NOT EXISTS
            FOR (d:Disease) ON (d.embedding)
            OPTIONS {indexConfig: {
              `vector.dimensions`: 384,
              `vector.similarity_function`: 'cosine'
            }}
            """,
            
            # Vector Index for Medicines (useful if searching medicines semantically)
            """
            CREATE VECTOR INDEX medicine_embeddings IF NOT EXISTS
            FOR (m:Medicine) ON (m.embedding)
            OPTIONS {indexConfig: {
              `vector.dimensions`: 384,
              `vector.similarity_function`: 'cosine'
            }}
            """
        ]
        
        with self.driver.session() as session:
            for q in queries:
                try:
                    session.run(q)
                    logger.info(f"Successfully executed schema setup query: {q.strip().splitlines()[0]}")
                except Exception as e:
                    logger.warning(f"Could not execute schema setup query: {e}")

    def query_drug_disease_conflicts(self, medicine_name: str):
        """
        Query 1: Drug-Disease Conflict Detection
        """
        cypher = """
        MATCH path1 = (p:Patient)-[:PRESCRIBED]->(m:Medicine)
        WHERE m.name = $medicineName
        WITH p, m, path1
        MATCH path2 = (p)-[:DIAGNOSED_WITH]->(d:Disease)<-[:CONTRAINDICATED_WITH*1..2]-(m)
        RETURN p.name AS patient_name, m.name AS medicine_name, d.name AS conflicting_disease, path1, path2
        """
        return self.execute_and_format(cypher, {"medicineName": medicine_name})

    def query_complex_patient_history(self, disease_name: str):
        """
        Query 2: Complex Patient History
        """
        cypher = """
        MATCH path1 = (p:Patient)-[:DIAGNOSED_WITH]->(d:Disease)
        WHERE d.name = $diseaseName
        WITH p, d, path1
        MATCH path2 = (p)-[:PRESCRIBED]->(m:Medicine)
        RETURN p.name AS patient_name, p.age AS patient_age, collect(DISTINCT m.name) AS medicines, collect(DISTINCT d.name) AS diseases, collect(path1) AS paths1, collect(path2) AS paths2
        """
        return self.execute_and_format(cypher, {"diseaseName": disease_name})

    def query_medicine_network(self):
        """
        Query 3: Medicine Network (who takes what)
        """
        cypher = """
        MATCH path = (p:Patient)-[r:PRESCRIBED]->(m:Medicine)-[:TREATS]->(d:Disease)
        RETURN p.name AS patient_name, m.name AS medicine_name, d.name AS disease_name, r.dosage AS dosage, path
        ORDER BY m.name
        """
        return self.execute_and_format(cypher)

    def query_doctors_patient_load(self):
        """
        Query 4: Doctor's Patient Load
        """
        cypher = """
        MATCH path = (doc:Doctor)<-[:TREATED_BY]-(p:Patient)-[:DIAGNOSED_WITH]->(d:Disease)
        RETURN doc.name AS doctor_name, doc.specialization AS specialization, count(p) AS patient_count, collect(DISTINCT d.name) AS diseases_treated, collect(path) AS paths
        ORDER BY patient_count DESC
        """
        return self.execute_and_format(cypher)

    def query_symptom_pathway(self):
        """
        Query 5: Symptom Pathway
        """
        cypher = """
        MATCH path = (p:Patient)-[:DIAGNOSED_WITH]->(d:Disease)-[:HAS_SYMPTOM]->(s:Symptom)
        RETURN p.name AS patient_name, d.name AS disease_name, collect(DISTINCT s.name) AS symptoms, collect(path) AS paths
        """
        return self.execute_and_format(cypher)

    def get_all_drug_disease_conflicts(self):
        """
        Returns all active drug conflicts in the entire system.
        """
        cypher = """
        MATCH path1 = (p:Patient)-[:PRESCRIBED]->(m:Medicine)
        MATCH path2 = (p)-[:DIAGNOSED_WITH]->(d:Disease)<-[:CONTRAINDICATED_WITH*1..2]-(m)
        RETURN p.name AS patient_name, m.name AS medicine_name, d.name AS conflicting_disease, path1, path2
        """
        return self.execute_and_format(cypher)

    def vector_search_diseases(self, query_embedding, limit=3):
        """
        Run cosine similarity vector search for Diseases based on embedding description.
        Expands to return the disease node, its symptoms, and patients diagnosed with it.
        """
        cypher = """
        CALL db.index.vector.queryNodes('disease_embeddings', $limit, $queryEmbedding)
        YIELD node, score
        WITH node, score
        OPTIONAL MATCH path1 = (node)-[:HAS_SYMPTOM]->(s:Symptom)
        OPTIONAL MATCH path2 = (p:Patient)-[:DIAGNOSED_WITH]->(node)
        RETURN node, score, collect(path1) AS symptom_paths, collect(path2) AS patient_paths
        """
        
        with self.driver.session() as session:
            result = session.run(cypher, {"queryEmbedding": query_embedding, "limit": limit})
            records = [dict(record) for record in result]
            
            # Format clean table representation
            table_records = []
            for r in records:
                disease = r["node"]
                table_records.append({
                    "disease_name": disease.get("name"),
                    "icd_code": disease.get("icd_code"),
                    "description": disease.get("description"),
                    "similarity_score": round(r["score"], 4)
                })
            
            # Parse graph data
            graph_data = self.parse_graph_from_records(records)
            
            return {
                "table": table_records,
                "graph": graph_data
            }

    def get_full_graph(self):
        """
        Returns the entire database nodes and edges for visualization.
        """
        cypher = "MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m"
        return self.execute_and_format(cypher)
