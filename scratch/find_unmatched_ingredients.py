import pandas as pd
from collections import defaultdict
import json

MENU_FILE = '../nrc-datasets/NRC  MENU (1).xlsx'
KITCHEN_FILE = '../nrc-datasets/NRC Kithen_Outsource-Inn (1).xls'

def clean_name(name):
    return str(name).strip().upper()

def extract_master_inventory():
    inventory_names = set()
    
    xl_menu = pd.ExcelFile(MENU_FILE)
    df_inv = pd.read_excel(xl_menu, sheet_name='Inventory List')
    for val in df_inv.get('Unnamed: 3', []):
        if pd.notnull(val) and str(val).strip() not in ['Materials', 'Description', 'Total Stock', 'nan']:
            inventory_names.add(clean_name(val))
            
    df_price = pd.read_excel(xl_menu, sheet_name='Price')
    for val in df_price.iloc[:, 0]:
        if pd.notnull(val) and str(val).strip() not in ['ITEM NAME', 'None', 'nan']:
            inventory_names.add(clean_name(val))
            
    try:
        df_k_price = pd.read_excel(KITCHEN_FILE, sheet_name='Prices')
        name_col = [c for c in df_k_price.columns if 'name' in c.lower() or 'item' in c.lower()][0]
        for val in df_k_price[name_col]:
            if pd.notnull(val):
                inventory_names.add(clean_name(val))
    except:
        pass
        
    return inventory_names

def find_unmatched_with_recipes(master_inventory):
    # Map of generic_name -> set(recipe_names)
    unmatched_map = defaultdict(set)
    noise_filters = ['Price', 'Rate', 'Total', 'Sub Total', 'nan', 'Amount']
    
    def is_valid_name(name, sheet):
        return (name and name != 'nan' and 
                name not in noise_filters and 
                name != sheet and 
                not str(name).startswith('25 PERS') and 
                not str(name).replace('.','',1).isdigit())

    # MENU
    xl_menu = pd.ExcelFile(MENU_FILE)
    for sheet in xl_menu.sheet_names:
        if sheet in ['Inventory List', 'Sheet2', 'Price']: continue
        df = pd.read_excel(xl_menu, sheet_name=sheet)
        for val in df.get('Unnamed: 0', []):
            name = str(val).strip()
            if is_valid_name(name, sheet):
                cleaned = clean_name(name)
                if cleaned not in master_inventory:
                    unmatched_map[clean_name(name)].add(sheet)

    # KITCHEN
    xl_kitchen = pd.ExcelFile(KITCHEN_FILE)
    kitchen_recipes = ['KCF', 'C Curry', 'Changezhi', 'Ghee Rice', 'M Varuval', 'Pongal', 'Sambar']
    for sheet in kitchen_recipes:
        try:
            df = pd.read_excel(xl_kitchen, sheet_name=sheet)
            for _, row in df.iterrows():
                val = row.dropna().values
                if len(val) >= 2:
                    name = str(val[0]).strip()
                    if is_valid_name(name, sheet):
                        cleaned = clean_name(name)
                        if cleaned not in master_inventory:
                            unmatched_map[clean_name(name)].add(sheet)
        except: continue
        
    return unmatched_map

def run():
    master = extract_master_inventory()
    unmatched = find_unmatched_with_recipes(master)
    
    # We only care about the explicit ambiguous ones the AI listed for the user
    targets = [
        "TOMATO",
        "BIG ONION",
        "SMALL ONION",
        "CHICKEN",
        "MUTTON",
        "PASI PARUPPU", "PAASI PARUPPU", "PASI PARRUPU",
        "ORID DHAL", "URID DHAL",
        "THUVARAM PARUPPU", "THUVARAM PARUPU",
        "KADALA PARUPPU", "KADALAI PARUPPU", "KASDALAI PARUPPU",
        "KADUGU", "JEERA", "VENDHAYAM",
        "G.G PASTE", "G.G.PASTE", "GINGER GARLIC PASTE", "GINGER/GARLICE PASTE"
    ]
    
    print("--- RECIPE OCCURRENCES ---\n")
    for t in targets:
        # Match case-insensitively or loosely
        found_recipes = set()
        for k, v in unmatched.items():
            if t in k or k in t:
                found_recipes.update(v)
        
        if found_recipes:
            print(f"[{t}] is used in:")
            print(f"  {', '.join(sorted(list(found_recipes)))}\n")

if __name__ == "__main__":
    run()
