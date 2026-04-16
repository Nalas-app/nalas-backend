import pandas as pd
import os
import json

MENU_FILE = '../nrc-datasets/NRC  MENU (1).xlsx'
KITCHEN_FILE = '../nrc-datasets/NRC Kithen_Outsource-Inn (1).xls'
GOLD_DIR = '../nrc-datasets/gold'

os.makedirs(GOLD_DIR, exist_ok=True)

# ----------------------------------------
# ALIAS DICTIONARY (User Validated)
# ----------------------------------------
ALIAS_MAP = {
    "TOMATO": "TOMATO RED",
    "BIG ONION": "ONION BIG",
    "SMALL ONION": "ONION SMALL",
    "CHICKEN": "CHICKEN KDF",
    "MUTTON": "MUTTON BONELESS", # Default fallback
    "ORID DHAL": "URAD DHAL",
    "URID DHAL": "URAD DHAL",
    "THUVARAM PARUPPU": "TOOR DHAL",
    "THUVARAM PARUPU": "TOOR DHAL",
    "KADALA PARUPPU": "BENGAL GRAM DHAL",  # Or CHANA DHAL depending on inventory
    "KADALAI PARUPPU": "BENGAL GRAM DHAL",
    "KASDALAI PARUPPU": "BENGAL GRAM DHAL",
    "KADUGU": "MUSTARD",
    "JEERA": "CUMIN SEEDS",
    "VENDHAYAM": "FENUGREEK",
    "G.G PASTE": "GINGER GARLIC PASTE",
    "G.G.PASTE": "GINGER GARLIC PASTE",
    "GINGER/GARLICE PASTE": "GINGER GARLIC PASTE",
}

def normalize_str(s):
    if pd.isnull(s): return ""
    return str(s).strip().upper()

def extract_ingredients():
    ingredients = {}
    ing_counter = 1
    
    def add_ingredient(name, category, unit, price):
        nonlocal ing_counter
        norm_name = normalize_str(name)
        if not norm_name or norm_name in ['NAN', 'MATERIALS', 'DESCRIPTION', 'TOTAL STOCK', 'ITEM NAME', 'NONE']:
            return
            
        try:
            p = float(price)
        except:
            p = 0.0
            
        if norm_name not in ingredients:
            ingredients[norm_name] = {
                'ingredient_id': f"ING-{str(ing_counter).zfill(3)}",
                'name': norm_name,
                'category': str(category).strip().title() if pd.notnull(category) else 'Other',
                'unit': str(unit).strip().lower() if pd.notnull(unit) else 'kg',
                'price_per_unit': p,
                'needs_review': p == 0.0
            }
            ing_counter += 1

    # 1. Menu File -> Inventory List
    try:
        xl_menu = pd.ExcelFile(MENU_FILE)
        df_inv = pd.read_excel(xl_menu, sheet_name='Inventory List')
        for _, row in df_inv.iterrows():
            add_ingredient(row.get('Unnamed: 3'), row.get('Unnamed: 4'), 'kg', row.get('Unnamed: 8'))
            
        # Menu File -> Price
        df_price = pd.read_excel(xl_menu, sheet_name='Price')
        for _, row in df_price.iterrows():
            add_ingredient(row.iloc[0], row.iloc[1], 'kg', row.iloc[3])
    except Exception as e:
        print(f"Error parsing Menu Inventory: {e}")

    # 2. Kitchen File -> Prices
    try:
        df_k_price = pd.read_excel(KITCHEN_FILE, sheet_name='Prices')
        name_col = [c for c in df_k_price.columns if 'name' in c.lower() or 'item' in c.lower()][0]
        cat_col = [c for c in df_k_price.columns if 'categ' in c.lower()][0]
        unit_col = [c for c in df_k_price.columns if 'unit' in c.lower() or 'measur' in c.lower()][0]
        price_col = [c for c in df_k_price.columns if 'rate' in c.lower() or 'cost' in c.lower()][0]
        
        for _, row in df_k_price.iterrows():
            add_ingredient(row[name_col], row[cat_col], row[unit_col], row[price_col])
    except Exception as e:
        print(f"Error parsing Kitchen Prices: {e}")
        
    # Auto-resolve ALIAS names immediately to point to existing IDs if possible.
    # We don't want to create new ingredients for aliases. We'll handle mapping in the recipe stage.

    return ingredients, ing_counter

def process_recipes():
    print("Extracting Master Inventory...")
    ingredients, next_ing_id = extract_ingredients()
    
    menu_items = []
    seen_menu_items = set()
    recipes = []
    noise_filters = ['PRICE', 'RATE', 'TOTAL', 'SUB TOTAL', 'NAN', 'AMOUNT']
    
    item_counter = 1
    recipe_counter = 1
    
    def get_or_create_ingredient(recipe_name):
        nonlocal next_ing_id
        
        norm_name = normalize_str(recipe_name)
        
        # Apply alias mapping if it exists
        if norm_name in ALIAS_MAP:
            norm_name = normalize_str(ALIAS_MAP[norm_name])
            
        # Attempt to map
        if norm_name in ingredients:
            return ingredients[norm_name]['ingredient_id']
            
        # Fallback: fuzzy match via contains? Not reliable. Let's just create a new 'Other' ingredient
        # so the user knows they need to fix it manually.
        new_id = f"ING-{str(next_ing_id).zfill(3)}"
        ingredients[norm_name] = {
            'ingredient_id': new_id,
            'name': norm_name,
            'category': 'Other',
            'unit': 'kg',
            'price_per_unit': 0.0,
            'needs_review': True # Flag it!
        }
        next_ing_id += 1
        return new_id

    def extract_from_sheet(df, file_source, item_name, is_25_scale):
        nonlocal item_counter, recipe_counter
        
        norm_item_name = normalize_str(item_name)
        if norm_item_name in seen_menu_items:
            return  # Skip duplicate menu items like 'Pongal' vs 'PONGAL'
        seen_menu_items.add(norm_item_name)
        
        item_id = f"ITEM-{str(item_counter).zfill(3)}"
        menu_items.append({
            'menu_item_id': item_id,
            'name': item_name,
            'category': 'Uncategorized',
            'base_unit': '1 portion'
        })
        item_counter += 1
        
        for _, row in df.iterrows():
            if is_25_scale:
                # Structure: Ingredient Name at column 0, Quantity at column 2 (usually)
                ing_val = row.get('Unnamed: 0')
                qty_val = row.get('Unnamed: 2')
            else:
                # Kitchen files typically have ingredients in Col 0, Qtys in Col 1 or scattered
                vals = row.dropna().values
                if len(vals) < 2: continue
                ing_val = vals[0]
                qty_val = None
                # Scan for first numeric
                for v in vals[1:]:
                    try:
                        qty_val = float(v)
                        break
                    except ValueError: pass

            name = normalize_str(ing_val)
            if not name or name in noise_filters or str(name).startswith('25 PERS') or name.replace('.','',1).isdigit():
                continue
                
            qty = 0.0
            needs_review = False
            try:
                if pd.notnull(qty_val):
                    qty = float(qty_val)
                    if is_25_scale:
                        qty = qty / 25.0
                else:
                    needs_review = True
            except ValueError:
                needs_review = True
                
            ing_id = get_or_create_ingredient(name)
            
            recipes.append({
                'recipe_id': f"RCP-{str(recipe_counter).zfill(4)}",
                'menu_item_id': item_id,
                'ingredient_id': ing_id,
                'quantity_per_base_unit': round(qty, 4),
                'wastage_factor': 1.05,
                'flags': 'REQUIRES_MANUAL_REVIEW (Missing Qty)' if needs_review else ''
            })
            recipe_counter += 1

    # 1. Parse Menu File
    print("Processing Menu Workbooks (25-scale)...")
    xl_menu = pd.ExcelFile(MENU_FILE)
    for sheet in xl_menu.sheet_names:
        if sheet in ['Inventory List', 'Sheet2', 'Price']:
            continue
        df = pd.read_excel(xl_menu, sheet_name=sheet)
        extract_from_sheet(df, 'Menu', sheet, is_25_scale=True)

    # 2. Parse Kitchen File
    print("Processing Kitchen Workbooks (1-scale)...")
    xl_kitchen = pd.ExcelFile(KITCHEN_FILE)
    kitchen_recipes = ['KCF', 'C Curry', 'Changezhi', 'Ghee Rice', 'M Varuval', 'Pongal', 'Sambar'] # Specific recipes
    for sheet in kitchen_recipes:
        try:
            df = pd.read_excel(xl_kitchen, sheet_name=sheet)
            extract_from_sheet(df, 'Kitchen', sheet, is_25_scale=False)
        except Exception as e:
            pass

    # Process ingredients dict for export
    ing_list = []
    for k, v in ingredients.items():
        ing_list.append({
            'ingredient_id': v['ingredient_id'],
            'name': v['name'],
            'category': v['category'],
            'unit': v['unit'],
            'price_per_unit': v['price_per_unit'],
            'flags': 'REQUIRES_MANUAL_REVIEW (Price=0)' if v['needs_review'] or float(v['price_per_unit']) == 0.0 else ''
        })

    # Export
    print("Saving Gold Standard CSVs...")
    pd.DataFrame(ing_list).to_csv(os.path.join(GOLD_DIR, 'gold_ingredients.csv'), index=False)
    pd.DataFrame(menu_items).to_csv(os.path.join(GOLD_DIR, 'gold_menu_items.csv'), index=False)
    pd.DataFrame(recipes).to_csv(os.path.join(GOLD_DIR, 'gold_recipes.csv'), index=False)
    
    # Stats
    flagged_recipes = sum(1 for r in recipes if 'REQUIRES' in r['flags'])
    flagged_ings = sum(1 for i in ing_list if 'REQUIRES' in i['flags'])
    
    print(f"\n--- SUCCESS ---")
    print(f"Generated {len(ing_list)} total Ingredients (Flagged to check: {flagged_ings})")
    print(f"Generated {len(menu_items)} pure Menu Items")
    print(f"Generated {len(recipes)} Recipe Matrix Rows (Flagged to check: {flagged_recipes})")
    print(f"\nYour Gold Standard CSVs are ready to review in:")
    print(f"-> {os.path.abspath(GOLD_DIR)}")

if __name__ == "__main__":
    process_recipes()
