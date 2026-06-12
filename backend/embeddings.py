import os
from typing import List
from sentence_transformers import SentenceTransformer

# Initialize the model. It will cache locally.
# all-MiniLM-L6-v2 produces 384-dimensional dense vectors.
model = SentenceTransformer('all-MiniLM-L6-v2')

def get_embedding(text: str) -> List[float]:
    """
    Generate a 384-dimensional embedding for a given text string.
    """
    if not text:
        return [0.0] * 384
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding.tolist()

def get_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for a list of text strings in batch.
    """
    if not texts:
        return []
    embeddings = model.encode(texts, convert_to_numpy=True)
    return embeddings.tolist()
