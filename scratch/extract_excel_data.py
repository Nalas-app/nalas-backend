import pandas as pd
import json
import os

def extract_data():
    wb_path = 'nrc-datasets/NRC  MENU (1).xlsx'
    xl = pd.ExcelFile(wb_path)
    
    ingredients = []
    menu_items = []
    recipes = []
    
    # 1. Extract Ingredients from Inventory List and Price sheets
    print("Extracting Ingredients...")
    
    def to_float(val):
        try:
            if pd.isnull(val): return 0.0
            return float(val)
        except:
            return 0.0

    # Extract from Inventory List
    df_inv = pd.read_excel(wb_path, sheet_name='Inventory List')
    for idx, row in df_inv.iterrows():
        name = str(row.get('Unnamed: 3', '')).strip()
        category = str(row.get('Unnamed: 4', '')).strip()
        rate = row.get('Unnamed: 8', 0)
        
        if name and name != 'nan' and name != 'Materials' and name != 'Description' and name != 'Total Stock':
            ingredients.append({
                'name': name,
                'category': category if category != 'nan' else 'Other',
                'unit': 'Kg',
                'price': to_float(rate)
            })

    # Extract from Price sheet (contains fresh items like Meat, Veg, etc.)
    df_price = pd.read_excel(wb_path, sheet_name='Price')
    # Column 0 is Name, Column 1 is Category, Column 3 is Rate
    for idx, row in df_price.iterrows():
        name = str(row.iloc[0]).strip()
        category = str(row.iloc[1]).strip()
        rate = row.iloc[3]
        
        if name and name != 'nan' and name != 'ITEM NAME' and name != 'None':
            # Skip if already added from Inventory List
            if not any(i['name'].lower() == name.lower() for i in ingredients):
                ingredients.append({
                    'name': name,
                    'category': category if category != 'nan' else 'Other',
                    'unit': 'Kg',
                    'price': to_float(rate)
                })

    # 2. Extract Menu Items and Recipes from sheets
    print("Extracting Menu Items and Recipes...")
    item_sheets = [s for s in xl.sheet_names if s not in ['Inventory List', 'Sheet2', 'Price']]
    
    for sheet in item_sheets:
        df = pd.read_excel(wb_path, sheet_name=sheet)
        
        # The sheet name is usually the menu item name
        # But sometimes it's grouped like 'COFFEE TEA SUKKU PAAL'
        # For now, we'll treat the sheet as a single menu item if it has one major recipe
        # or multiple if we see multiple headers.
        
        # Basic approach: One sheet = One Menu Item
        menu_items.append({
            'name': sheet,
            'base_unit': '25 portions' # Source data is for 25 people
        })
        
        # Extract Recipe rows
        for idx, row in df.iterrows():
            ing_name = str(row.get('Unnamed: 0', '')).strip()
            # Based on inspection, Unnamed: 2 often has the quantity
            qty = row.get('Unnamed: 2', None)
            
            # Filter out non-ingredients
            if (ing_name and ing_name != 'nan' and 
                ing_name not in [sheet, 'Price', 'Rate', 'Total', 'Sub Total'] and
                not ing_name.startswith('25 PERSONS')):
                
                # Make sure qty is numeric
                try:
                    q = float(qty) if pd.notnull(qty) else 0.0
                    if q >= 0:
                        recipes.append({
                            'menu_item': sheet,
                            'ingredient': ing_name,
                            'qty_25': q
                        })
                except:
                    continue

    # Save to JSON
    data = {
        'ingredients': ingredients,
        'menu_items': menu_items,
        'recipes': recipes
    }
    
    output_path = 'nalas-backend/scratch/nrc_data.json'
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"Extraction complete. Found {len(ingredients)} ingredients, {len(menu_items)} items, and {len(recipes)} recipe rows.")

if __name__ == "__main__":
    extract_data()
