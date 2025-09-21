# FusionAI: The Multimodal Semantic Architect

A unified AI platform built on BigQuery AI. It transforms a fragmented architecture into a single, scalable solution, fusing Multimodal, Vector Search, and Generative AI for end-to-end RAG. It intelligently processes unstructured data (docs, images) to provide context-aware, powerful insights.

---

## Overview

**FusionAI** is an innovative generative AI assistant that intelligently processes unstructured data (docs, images) to provide context-aware, powerful insights. This project is the solution for existing fragmented stack to multi-service architecture with a streamlined, scalable solution built entirely on **Google Cloud's BigQuery AI**.

---

## The Problem: A Fragmented Stack

The current RAG applications rely on a complex chain of disparate services (e.g. OpenAI, Pinecone, LangChain), resulting in:

- Brittle systems
- High latency
- Data transfer overhead
- Significant management complexity

---

## The Solution: A Unified, Single-Platform Workflow

**The "FusionAI" solution unifies the entire AI workflow within a single, serverless platform: BigQuery.**  
By bringing AI to the data, we eliminate complexity and unlock new levels of efficiency and insight.

---

## Key Features

- **End-to-end RAG Pipeline:** Demonstrates a full Retrieval-Augmented Generation pipeline leveraging BigQuery AI features.
- **Multimodality:** Ingest/process diverse unstructured data (documents, images) in BigQuery using Object Tables. No data silos—a holistic knowledge base.
- **Vector Search:**
  - Generate semantic embeddings with `ML.GENERATE_EMBEDDING`.
  - Run fast, accurate similarity searches using `VECTOR_SEARCH` for context-aware, factually grounded responses.
- **Generative AI:** Use `ML.GENERATE_TEXT` with a Gemini model to provide natural, insightful, and personalized feedback—all with simple SQL.

---

## Architecture & Workflow

A logical, four-step pipeline managed entirely within BigQuery:

1. **Ingestion (Multimodal):**
   - Documents and images in Cloud Storage are referenced by BigQuery via Object Tables.
2. **Analysis (Vector Search):**
   - `ML.GENERATE_EMBEDDING` converts unstructured data into vectors.
3. **Intelligent Assessment (RAG):**
   - User query triggers a `VECTOR_SEARCH` to find relevant context.
4. **Generative Feedback (Generative AI):**
   - Retrieved context augments the prompt for `ML.GENERATE_TEXT` to generate the final response.

---

## How to Run the Project

This project is intended for use in a Google Cloud environment.

### Prerequisites

- Google Cloud project with billing enabled
- BigQuery and Vertex AI APIs enabled
- Google Cloud Storage bucket with your unstructured data files

### Steps

1. **Set up BigQuery Tables:**
   - Run the SQL commands (in `sql/` directory) to create the Object Table and Vector Index.
2. **Run the Analysis Pipeline:**
   - Execute queries to generate embeddings and populate the vector index.
3. **Connect the Front End:**
   - The front-end app (`app/` directory) uses Google Cloud client libraries to send user queries and receive AI-generated responses from BigQuery.

---

## Technologies Used

- **Google Cloud BigQuery:** Core data platform
- **BigQuery ML:** `ML.GENERATE_EMBEDDING`, `ML.GENERATE_TEXT`
- **Google Cloud Storage:** Stores unstructured data files
- **Vertex AI:** Provides the underlying LLM (Gemini)

---
