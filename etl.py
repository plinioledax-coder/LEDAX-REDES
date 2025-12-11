# etl.py

import os
import re
import json
import time
import pandas as pd
from sqlalchemy import Column, Boolean # Importação extra para a verificação, caso o models não esteja disponível
from sqlalchemy.orm import sessionmaker
from database import Base, engine 
from models import LojaRede
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
from tqdm import tqdm

# ---------------------------
# Config
# ---------------------------
GEOCACHE_PATH = "data/redes_geocache.json" 
EXCEL_PATH = "data/MAPEAMENTO_REDES.xlsx"
SAVE_CACHE_EVERY = 100
USER_AGENT = "ledax-redes-etl/1.0"

geolocator = Nominatim(user_agent=USER_AGENT, timeout=10)
# Limite a 1 requisição a cada 1.5 segundos
geocode_remote = RateLimiter(geolocator.geocode, min_delay_seconds=1.5) 

GEOCACHE = {}
if os.path.exists(GEOCACHE_PATH):
    with open(GEOCACHE_PATH, "r", encoding="utf-8") as f:
        GEOCACHE = json.load(f)

def save_cache(path=GEOCACHE_PATH):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(GEOCACHE, f, ensure_ascii=False, indent=4)

def chave_cache(tipo, valor):
    return f"{tipo}::{valor.strip().upper()}"

# ---------------------------
# Geocoding Único (Endereço)
# ---------------------------
def geocode_loja(endereco):
    """
    Geocodifica o endereço da loja (prioridade única) usando cache.
    """
    if isinstance(endereco, str) and endereco.strip():
        chave = chave_cache("ENDERECO_LOJA", endereco.strip())
        
        if chave in GEOCACHE:
            lat, lon, endereco_g = GEOCACHE[chave]
            return lat, lon, endereco_g

        try:
            location = geocode_remote(endereco.strip())
            if location:
                lat = location.latitude
                lon = location.longitude
                endereco_g = location.address
                
                GEOCACHE[chave] = [lat, lon, endereco_g]
                return lat, lon, endereco_g
        except Exception as e:
            print(f"⚠️ Erro no Nominatim para '{endereco}': {e}")
            time.sleep(5) 

    return None, None, None


# ---------------------------
# Processamento Principal
# ---------------------------
def processar_excel_redes(excel_path=EXCEL_PATH): 
    print(f"\n===== PROCESSANDO: {excel_path} (Lojas de Rede) =====")
    
    try:
        df = pd.read_excel(excel_path)
    except FileNotFoundError:
        print(f"⚠️ ERRO: Arquivo {excel_path} não encontrado. Coloque o XLSX em 'data/'.")
        return

    # Normalizar nomes das colunas
    df.columns = [re.sub(r"[^a-z0-9]+", "_", c.lower()) for c in df.columns]
    
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        for idx, row in tqdm(df.iterrows(), total=len(df), desc="Processando Lojas de Rede"):
            
            rede = row.get("rede")
            loja = row.get("loja")
            # Tenta a forma normalizada ou com acento para endereço
            endereco_loja = row.get("endere_o") or row.get("endereço") 
            cnpj = row.get("cnpj")
            ultimo_pv = row.get("ltimo_pv")
            data_venda = row.get("data_da_ltima_venda")
            valor = row.get("valor")
            funil = row.get("funil_da_ltima_venda")
            checklist = row.get("checklist_de_projeto_ltima_venda")

            data_formatada = None
            if data_venda and pd.notna(data_venda):
                try:
                    data_formatada = pd.to_datetime(data_venda).date()
                except Exception:
                    pass
            
            # ===========================================
            # NOVO: Lógica para determinar se houve venda
            # ===========================================
            # 1. Verifica se 'valor' é um número válido, não nulo e maior que zero
            # pd.to_numeric(..., errors='coerce') tenta converter e coloca NaN se falhar
            houve_valor = pd.notna(valor) and (pd.to_numeric(valor, errors='coerce') > 0)
            
            # 2. Verifica se a data de venda é válida
            houve_data = data_formatada is not None
            
            # A loja teve venda se o valor for maior que zero OU se houver uma data válida
            teve_venda_final = bool(houve_valor or houve_data) 
            # ===========================================
            
            lat, lon, endereco_usado = geocode_loja(endereco_loja) 
            
            loja_rede = LojaRede(
                rede=rede, loja=loja, endereco=endereco_loja, cnpj=cnpj,
                ultimo_pv=ultimo_pv, data_ultima_venda=data_formatada, valor=valor,
                funil_ultima_venda=funil, checklist_projeto=checklist,
                endereco_usado_geocode=endereco_usado, latitude=lat, longitude=lon,
                teve_venda=teve_venda_final # NOVO CAMPO ATUALIZADO
            )

            db.add(loja_rede)

            if (idx + 1) % SAVE_CACHE_EVERY == 0:
                db.commit()
                save_cache() 

        db.commit() 
        save_cache() 

    except Exception as e:
        print(f"\n🚨 ERRO FATAL ao processar Lojas de Rede. Rollback: {e}")
        db.rollback()
    finally:
        db.close()
        print("✅ Processamento de Lojas de Rede concluído.")

# ---------------------------
# Execução Principal
# ---------------------------
if __name__ == "__main__":
    # Limpa e recria todas as tabelas
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    processar_excel_redes(EXCEL_PATH)