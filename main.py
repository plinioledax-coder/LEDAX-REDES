# main.py
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import SessionLocal
from models import LojaRede 
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="LEDAX REDES MAPA API")

# CORS - libera acesso ao front
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir arquivos estáticos (o mapa_redes.html)
app.mount("/app", StaticFiles(directory=".", html=True), name="static")

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------------------------------
# ENDPOINT: LOJAS DE REDE
# -------------------------------
@app.get("/api/lojas_rede/")
def get_lojas_rede(db: Session = Depends(get_db)):
    """
    Retorna todos os registros de lojas com Lat/Lon válidas.
    """
    # Filtra apenas os registros que conseguiram ser geocodificados
    lojas = db.query(LojaRede).filter(
        LojaRede.latitude != None, 
        LojaRede.longitude != None
    ).all()

    # Mapeia para um formato JSON simples
    return [{
        "id": loja.id,
        "rede": loja.rede,
        "loja": loja.loja,
        "endereco": loja.endereco,
        "cnpj": loja.cnpj,
        "data_venda": loja.data_ultima_venda.isoformat() if loja.data_ultima_venda else None,
        "latitude": loja.latitude,
        "longitude": loja.longitude,
        # 💡 NOVO CAMPO: Adiciona o status de venda (True/False)
        "teve_venda": loja.teve_venda, 
        "funil_ultima_venda": loja.funil_ultima_venda # Campo faltando no retorno anterior
    } for loja in lojas] # Adicionado funil_ultima_venda para o popup