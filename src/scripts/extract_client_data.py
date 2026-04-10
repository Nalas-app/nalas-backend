"""
NRC Dataset Extraction Script
==============================
Parses the NRC Menu Excel file into a structured JSON for database seeding.
Author: Jai
"""

import pandas as pd
import json
import os

# Config
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_PATH = 'c:/Users/jaisu/Projects/nalas/nrc-datasets/NRC  MENU (1).xlsx'
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'client_data_seed.json')

# Definitions
CONSUMABLE_CATEGORIES = [
    'Cleaning Materials', 
    'Utilities', 
    "OTHER'S"
]

def clean_name(name):
    if pd.isna(name): return None
    return str(name).strip()

def extract():
    print(f"Reading {DATASET_PATH}...")
    try:
        # Read the 'Price' sheet
        df = pd.read_excel(DATASET_PATH, sheet_name='Price')
    except Exception as e:
        print(f"Error reading Excel: {e}")
        return

    # Filter out empty rows
    df = df.dropna(subset=['Item Name', 'Category Name'])

    seed_data = {
        "categories": [],
        "items": []
    }

    unique_categories = df['Category Name'].unique().tolist()
    for cat in unique_categories:
        if pd.isna(cat): continue
        seed_data["categories"].append({
            "name": clean_name(cat),
            "is_consumable": clean_name(cat) in CONSUMABLE_CATEGORIES
        })

    for _, row in df.iterrows():
        item_name = clean_name(row['Item Name'])
        cat_name = clean_name(row['Category Name'])
        unit = clean_name(row['Purchasing Measurement Unit']) or 'Unit'
        rate = row['Rate']
        
        if not item_name or not cat_name:
            continue

        item_type = 'consumable' if cat_name in CONSUMABLE_CATEGORIES else 'food'
        
        # Simple parsing of Rate if it's a string
        try:
            val = float(rate)
            rate_val = val if not pd.isna(val) else 0.0
        except:
            rate_val = 0.0

        seed_data["items"].append({
            "name": item_name,
            "category": cat_name,
            "unit": unit,
            "price": rate_val,
            "type": item_type
        })

    print(f"Extracted {len(seed_data['items'])} items across {len(seed_data['categories'])} categories.")

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(seed_data, f, indent=2)
    
    print(f"Saved seed data to {OUTPUT_PATH}")

if __name__ == "__main__":
    extract()
