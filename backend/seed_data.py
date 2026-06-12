import os
import sys
import logging
from datetime import datetime

# Add parent directory to path so we can import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.embeddings import get_embedding
from backend.neo4j_client import Neo4jClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_database():
    client = Neo4jClient()
    
    try:
        logger.info("Initializing database constraints and indexes...")
        client.init_database_indexes()
        
        logger.info("Clearing existing database contents...")
        client.query("MATCH (n) DETACH DELETE n")
        
        # 1. Define Symptoms
        symptoms = [
            {"id": "s1", "name": "Polyuria (Frequent Urination)", "severity": "High"},
            {"id": "s2", "name": "Polydipsia (Excessive Thirst)", "severity": "High"},
            {"id": "s3", "name": "Fatigue", "severity": "Medium"},
            {"id": "s4", "name": "Chest Pain", "severity": "High"},
            {"id": "s5", "name": "Shortness of Breath", "severity": "High"},
            {"id": "s6", "name": "Cough", "severity": "Medium"},
            {"id": "s7", "name": "Loss of Taste/Smell", "severity": "Low"},
            {"id": "s8", "name": "Breast Lump", "severity": "High"},
            {"id": "s9", "name": "Wheezing", "severity": "High"},
            {"id": "s10", "name": "Chronic Sadness", "severity": "Medium"},
            {"id": "s11", "name": "Insomnia", "severity": "Medium"},
            {"id": "s12", "name": "Joint Stiffness", "severity": "Medium"},
            {"id": "s13", "name": "Joint Pain", "severity": "High"},
            {"id": "s14", "name": "Throbbing Headache", "severity": "High"},
            {"id": "s15", "name": "Nausea", "severity": "Low"}
        ]
        
        logger.info("Inserting Symptoms...")
        for sym in symptoms:
            client.query(
                "CREATE (s:Symptom {id: $id, name: $name, severity: $severity})",
                sym
            )

        # 2. Define Diseases with Descriptions & Embeddings
        diseases = [
            {
                "id": "d1", 
                "name": "Diabetes Mellitus Type 2", 
                "icd_code": "E11", 
                "description": "A chronic metabolic condition characterized by high blood sugar, insulin resistance, and relative lack of insulin. Major symptoms include polyuria, frequent urination, polydipsia, excessive thirst, and severe fatigue."
            },
            {
                "id": "d2", 
                "name": "Essential Hypertension", 
                "icd_code": "I10", 
                "description": "A condition in which the blood pressure in the arteries is persistently elevated. It is usually asymptomatic (a silent killer), but long term it increases the risk of heart disease, chest pain, stroke, and kidney failure."
            },
            {
                "id": "d3", 
                "name": "COVID-19 Respiratory Infection", 
                "icd_code": "U07.1", 
                "description": "An acute respiratory disease caused by the SARS-CoV-2 coronavirus. Characterized by fever, dry cough, severe fatigue, loss of taste or smell, shortness of breath, and breathing difficulties."
            },
            {
                "id": "d4", 
                "name": "Breast Cancer", 
                "icd_code": "C50", 
                "description": "A malignant neoplasm of the breast tissue. Symptoms include a palpable breast lump, breast pain, changes in skin texture, and local discomfort."
            },
            {
                "id": "d5", 
                "name": "Chronic Asthma", 
                "icd_code": "J45", 
                "description": "A chronic inflammatory disease of the airways causing airway hyperresponsiveness, mucosal edema, and mucus production. Symptoms include wheezing, shortness of breath, chest tightness, and coughing."
            },
            {
                "id": "d6", 
                "name": "Major Depressive Disorder", 
                "icd_code": "F32", 
                "description": "A mental health condition characterized by persistent feelings of sadness, loss of interest in activities, insomnia, lack of energy, and impairment in daily functioning."
            },
            {
                "id": "d7", 
                "name": "Osteoarthritis", 
                "icd_code": "M15", 
                "description": "A degenerative joint disease that occurs when flexible tissue at the end of bones wears down. Symptoms include joint pain, joint stiffness, tenderness, and loss of flexibility."
            },
            {
                "id": "d8", 
                "name": "Migraine Headache", 
                "icd_code": "G43", 
                "description": "A neurological disorder characterized by recurrent moderate-to-severe throbbing headaches, typically affecting one side of the head, and associated with nausea and sensitivity to light/sound."
            }
        ]
        
        logger.info("Computing Disease description embeddings and inserting...")
        for dis in diseases:
            emb = get_embedding(dis["description"])
            client.query(
                """
                CREATE (d:Disease {
                    id: $id, 
                    name: $name, 
                    icd_code: $icd_code, 
                    description: $description, 
                    embedding: $embedding
                })
                """,
                {**dis, "embedding": emb}
            )

        # 3. Define Medicines with Names, Dosage, Manufacturers & Embeddings
        medicines = [
            {"id": "m1", "name": "Metformin", "dosage": "500mg", "manufacturer": "Sandoz"},
            {"id": "m2", "name": "Insulin Glargine", "dosage": "100 units/mL", "manufacturer": "Sanofi"},
            {"id": "m3", "name": "Lisinopril", "dosage": "10mg", "manufacturer": "Lupin"},
            {"id": "m4", "name": "Amlodipine", "dosage": "5mg", "manufacturer": "Pfizer"},
            {"id": "m5", "name": "Paxlovid", "dosage": "150mg/100mg", "manufacturer": "Pfizer"},
            {"id": "m6", "name": "Remdesivir", "dosage": "100mg", "manufacturer": "Gilead"},
            {"id": "m7", "name": "Tamoxifen", "dosage": "20mg", "manufacturer": "AstraZeneca"},
            {"id": "m8", "name": "Albuterol Inhaler", "dosage": "90mcg", "manufacturer": "Teva"},
            {"id": "m9", "name": "Fluticasone", "dosage": "50mcg", "manufacturer": "GSK"},
            {"id": "m10", "name": "Sertraline", "dosage": "50mg", "manufacturer": "Pfizer"},
            {"id": "m11", "name": "Ibuprofen", "dosage": "400mg", "manufacturer": "Advil"},
            {"id": "m12", "name": "Sumatriptan", "dosage": "50mg", "manufacturer": "GlaxoSmithKline"}
        ]
        
        logger.info("Computing Medicine embeddings and inserting...")
        for med in medicines:
            # We embed name + dosage + manufacturer for semantic similarity search
            text_to_embed = f"{med['name']} {med['dosage']} manufacturer {med['manufacturer']}"
            emb = get_embedding(text_to_embed)
            client.query(
                """
                CREATE (m:Medicine {
                    id: $id, 
                    name: $name, 
                    dosage: $dosage, 
                    manufacturer: $manufacturer, 
                    embedding: $embedding
                })
                """,
                {**med, "embedding": emb}
            )

        # 4. Define Doctors
        doctors = [
            {"id": "doc1", "name": "Dr. Sarah Jenkins", "specialization": "Cardiology", "hospital": "Metro Health Hospital"},
            {"id": "doc2", "name": "Dr. Robert Chen", "specialization": "Endocrinology", "hospital": "Valley Medical Center"},
            {"id": "doc3", "name": "Dr. Emily Taylor", "specialization": "Oncology", "hospital": "Hope Cancer Care"},
            {"id": "doc4", "name": "Dr. David Miller", "specialization": "Pulmonology", "hospital": "City Chest Clinic"},
            {"id": "doc5", "name": "Dr. Lisa Anderson", "specialization": "Psychiatry", "hospital": "Mind & Body Wellness"}
        ]
        
        logger.info("Inserting Doctors...")
        for doc in doctors:
            client.query(
                "CREATE (d:Doctor {id: $id, name: $name, specialization: $specialization, hospital: $hospital})",
                doc
            )

        # 5. Define Patients
        patients = [
            {"id": "p1", "name": "John Doe", "age": 45, "gender": "Male"},
            {"id": "p2", "name": "Jane Smith", "age": 38, "gender": "Female"},
            {"id": "p3", "name": "Alice Johnson", "age": 65, "gender": "Female"},
            {"id": "p4", "name": "Bob Brown", "age": 50, "gender": "Male"},
            {"id": "p5", "name": "Charlie Green", "age": 29, "gender": "Male"},
            {"id": "p6", "name": "David White", "age": 72, "gender": "Male"},
            {"id": "p7", "name": "Emma Black", "age": 34, "gender": "Female"},
            {"id": "p8", "name": "Frank Harris", "age": 58, "gender": "Male"},
            {"id": "p9", "name": "Grace Lee", "age": 52, "gender": "Female"},
            {"id": "p10", "name": "Henry Wilson", "age": 61, "gender": "Male"}
        ]
        
        logger.info("Inserting Patients...")
        for pat in patients:
            # Generate patient embedding based on details if requested (filled with dummy 384 vector or similar)
            dummy_emb = [0.0] * 384
            client.query(
                "CREATE (p:Patient {id: $id, name: $name, age: $age, gender: $gender, embedding: $embedding})",
                {**pat, "embedding": dummy_emb}
            )

        # 6. Establish Relationships

        # Disease HAS_SYMPTOM Symptom
        disease_symptoms = [
            ("d1", ["s1", "s2", "s3"]),       # Diabetes: Polyuria, Polydipsia, Fatigue
            ("d2", ["s4", "s3"]),             # Hypertension: Chest Pain, Fatigue
            ("d3", ["s5", "s6", "s7", "s3"]), # COVID-19: Shortness of Breath, Cough, Loss of Taste/Smell, Fatigue
            ("d4", ["s8", "s3"]),             # Breast Cancer: Breast Lump, Fatigue
            ("d5", ["s5", "s6", "s9"]),       # Asthma: Shortness of breath, Cough, Wheezing
            ("d6", ["s10", "s11", "s3"]),     # Depression: Chronic sadness, Insomnia, Fatigue
            ("d7", ["s12", "s13"]),           # Osteoarthritis: Joint stiffness, Joint pain
            ("d8", ["s14", "s15", "s3"])      # Migraine: Throbbing headache, Nausea, Fatigue
        ]
        logger.info("Linking Diseases to Symptoms...")
        for dis_id, sym_ids in disease_symptoms:
            for sym_id in sym_ids:
                client.query(
                    """
                    MATCH (d:Disease {id: $dis_id}), (s:Symptom {id: $sym_id})
                    CREATE (d)-[:HAS_SYMPTOM]->(s)
                    """,
                    {"dis_id": dis_id, "sym_id": sym_id}
                )

        # Medicine TREATS Disease
        medicine_treats = [
            ("m1", "d1"),   # Metformin treats Diabetes
            ("m2", "d1"),   # Insulin Glargine treats Diabetes
            ("m3", "d2"),   # Lisinopril treats Hypertension
            ("m4", "d2"),   # Amlodipine treats Hypertension
            ("m5", "d3"),   # Paxlovid treats COVID-19
            ("m6", "d3"),   # Remdesivir treats COVID-19
            ("m7", "d4"),   # Tamoxifen treats Breast Cancer
            ("m8", "d5"),   # Albuterol treats Asthma
            ("m9", "d5"),   # Fluticasone treats Asthma
            ("m10", "d6"),  # Sertraline treats Depression
            ("m11", "d7"),  # Ibuprofen treats Osteoarthritis
            ("m11", "d8"),  # Ibuprofen treats Migraine
            ("m12", "d8")   # Sumatriptan treats Migraine
        ]
        logger.info("Linking Medicines to Diseases they treat...")
        for med_id, dis_id in medicine_treats:
            client.query(
                """
                MATCH (m:Medicine {id: $med_id}), (d:Disease {id: $dis_id})
                CREATE (m)-[:TREATS]->(d)
                """,
                {"med_id": med_id, "dis_id": dis_id}
            )

        # Medicine CONTRAINDICATED_WITH Medicine / Disease
        # Seed both drug-drug and drug-disease contraindications
        contraindications = [
            # Drug-Drug
            ("m5", "m4", "MEDICINE"),  # Paxlovid contraindicated with Amlodipine (Drug-Drug)
            ("m12", "m10", "MEDICINE"), # Sumatriptan contraindicated with Sertraline (Drug-Drug)
            
            # Drug-Disease (directly from Medicine to Disease)
            ("m11", "d5", "DISEASE"),  # Ibuprofen contraindicated with Asthma (Drug-Disease)
            ("m1", "d3", "DISEASE"),   # Metformin contraindicated with COVID-19 (Drug-Disease)
            ("m4", "d3", "DISEASE"),   # Amlodipine contraindicated with COVID-19 (Drug-Disease)
        ]
        logger.info("Inserting Contraindications...")
        for source_id, target_id, target_type in contraindications:
            if target_type == "MEDICINE":
                client.query(
                    """
                    MATCH (m1:Medicine {id: $source_id}), (m2:Medicine {id: $target_id})
                    CREATE (m1)-[:CONTRAINDICATED_WITH]->(m2)
                    CREATE (m2)-[:CONTRAINDICATED_WITH]->(m1)
                    """,
                    {"source_id": source_id, "target_id": target_id}
                )
            else:
                client.query(
                    """
                    MATCH (m:Medicine {id: $source_id}), (d:Disease {id: $target_id})
                    CREATE (m)-[:CONTRAINDICATED_WITH]->(d)
                    """,
                    {"source_id": source_id, "target_id": target_id}
                )

        # Patient DIAGNOSED_WITH, PRESCRIBED, and TREATED_BY
        # (Patient)-[:DIAGNOSED_WITH {date, severity}]->(Disease)
        # (Patient)-[:PRESCRIBED {date, dosage, duration}]->(Medicine)
        # (Patient)-[:TREATED_BY]->(Doctor)
        patient_data = [
            # 1. John Doe - Diabetes, treated by Dr. Chen, Metformin
            {
                "pat_id": "p1", "doc_id": "doc2", 
                "diagnoses": [{"dis_id": "d1", "severity": "Moderate"}],
                "prescriptions": [{"med_id": "m1", "dosage": "500mg daily", "duration": "90 days"}]
            },
            # 2. Jane Smith - Hypertension, treated by Dr. Jenkins, Lisinopril
            {
                "pat_id": "p2", "doc_id": "doc1", 
                "diagnoses": [{"dis_id": "d2", "severity": "Mild"}],
                "prescriptions": [{"med_id": "m3", "dosage": "10mg daily", "duration": "30 days"}]
            },
            # 3. Alice Johnson - Breast Cancer, treated by Dr. Taylor, Tamoxifen
            {
                "pat_id": "p3", "doc_id": "doc3", 
                "diagnoses": [{"dis_id": "d4", "severity": "Severe"}],
                "prescriptions": [{"med_id": "m7", "dosage": "20mg daily", "duration": "365 days"}]
            },
            # 4. Bob Brown - Asthma & Osteoarthritis, treated by Dr. Miller (pulmonologist), Albuterol & Ibuprofen
            # Ibuprofen is contraindicated with Asthma -> Drug-Disease Conflict!
            {
                "pat_id": "p4", "doc_id": "doc4", 
                "diagnoses": [
                    {"dis_id": "d5", "severity": "Moderate"},
                    {"dis_id": "d7", "severity": "Mild"}
                ],
                "prescriptions": [
                    {"med_id": "m8", "dosage": "2 puffs as needed", "duration": "60 days"},
                    {"med_id": "m11", "dosage": "400mg twice daily", "duration": "14 days"}
                ]
            },
            # 5. Charlie Green - Depression, treated by Dr. Anderson, Sertraline
            {
                "pat_id": "p5", "doc_id": "doc5", 
                "diagnoses": [{"dis_id": "d6", "severity": "Moderate"}],
                "prescriptions": [{"med_id": "m10", "dosage": "50mg daily", "duration": "180 days"}]
            },
            # 6. David White - Osteoarthritis, treated by Dr. Jenkins, Ibuprofen
            {
                "pat_id": "p6", "doc_id": "doc1", 
                "diagnoses": [{"dis_id": "d7", "severity": "Moderate"}],
                "prescriptions": [{"med_id": "m11", "dosage": "400mg twice daily", "duration": "30 days"}]
            },
            # 7. Emma Black - Migraine, treated by Dr. Anderson (Psychiatrist / Wellness), Sumatriptan
            {
                "pat_id": "p7", "doc_id": "doc5", 
                "diagnoses": [{"dis_id": "d8", "severity": "Severe"}],
                "prescriptions": [{"med_id": "m12", "dosage": "50mg as needed", "duration": "30 days"}]
            },
            # 8. Frank Harris - COVID-19 & Hypertension, treated by Dr. Miller, Paxlovid & Amlodipine
            # Paxlovid is contraindicated with Amlodipine -> Drug-Drug Conflict!
            {
                "pat_id": "p8", "doc_id": "doc4", 
                "diagnoses": [
                    {"dis_id": "d3", "severity": "Moderate"},
                    {"dis_id": "d2", "severity": "Moderate"}
                ],
                "prescriptions": [
                    {"med_id": "m5", "dosage": "300mg/100mg twice daily", "duration": "5 days"},
                    {"med_id": "m4", "dosage": "5mg daily", "duration": "30 days"}
                ]
            },
            # 9. Grace Lee - Diabetes, treated by Dr. Chen, Insulin Glargine
            {
                "pat_id": "p9", "doc_id": "doc2", 
                "diagnoses": [{"dis_id": "d1", "severity": "Severe"}],
                "prescriptions": [{"med_id": "m2", "dosage": "15 units nightly", "duration": "90 days"}]
            },
            # 10. Henry Wilson - Hypertension, treated by Dr. Jenkins, Amlodipine
            {
                "pat_id": "p10", "doc_id": "doc1", 
                "diagnoses": [{"dis_id": "d2", "severity": "Moderate"}],
                "prescriptions": [{"med_id": "m4", "dosage": "10mg daily", "duration": "60 days"}]
            }
        ]
        
        logger.info("Creating patient relationships...")
        current_date = datetime.now().strftime("%Y-%m-%d")
        
        for p_info in patient_data:
            pat_id = p_info["pat_id"]
            doc_id = p_info["doc_id"]
            
            # Link patient to doctor
            client.query(
                """
                MATCH (p:Patient {id: $pat_id}), (doc:Doctor {id: $doc_id})
                CREATE (p)-[:TREATED_BY]->(doc)
                """,
                {"pat_id": pat_id, "doc_id": doc_id}
            )
            
            # Link diagnoses
            for diag in p_info["diagnoses"]:
                client.query(
                    """
                    MATCH (p:Patient {id: $pat_id}), (d:Disease {id: $dis_id})
                    CREATE (p)-[:DIAGNOSED_WITH {date: $date, severity: $severity}]->(d)
                    """,
                    {"pat_id": pat_id, "dis_id": diag["dis_id"], "date": current_date, "severity": diag["severity"]}
                )
                
            # Link prescriptions
            for presc in p_info["prescriptions"]:
                client.query(
                    """
                    MATCH (p:Patient {id: $pat_id}), (m:Medicine {id: $med_id})
                    CREATE (p)-[:PRESCRIBED {date: $date, dosage: $dosage, duration: $duration}]->(m)
                    """,
                    {
                        "pat_id": pat_id, 
                        "med_id": presc["med_id"], 
                        "date": current_date, 
                        "dosage": presc["dosage"], 
                        "duration": presc["duration"]
                    }
                )

        logger.info("Successfully seeded database with clinical mock data!")
        
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        raise e
    finally:
        client.close()

if __name__ == "__main__":
    seed_database()
