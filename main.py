from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import SessionLocal
from models import LojaRede
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os # Necessário para a função de servir o HTML

app = FastAPI(title="LEDAX REDES MAPA API")

# ----------------------------------------------------
# 1. Configuração de Middleware
# ----------------------------------------------------

# CORS - libera acesso ao front
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------
# 2. Configuração de Arquivos Estáticos e HTML
# ----------------------------------------------------

# Monta a pasta 'static' para servir arquivos estáticos (CSS, JS, assets)
# A URL para acessar será /static/...
app.mount("/static", StaticFiles(directory="static"), name="static")

# ----------------------------------------------------
# 3. Dependency Injection
# ----------------------------------------------------

# Dependency para obter a sessão do banco de dados
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ----------------------------------------------------
# 4. Rotas (Endpoints)
# ----------------------------------------------------

# ROTA RAIZ: Serve o HTML principal
@app.get("/", include_in_schema=False)
async def serve_index():
    """
    Retorna o arquivo HTML principal da aplicação quando o usuário acessa a URL raiz (/).
    Resolve o erro 404 e o health check do Render.
    """
    # 💡 Se o seu arquivo for 'mapa_redes.html', ajuste esta linha:
    HTML_FILE = "index.html" 
    
    # O caminho completo é 'static/index.html' dentro do container /app
    file_path = f"static/{HTML_FILE}"
    
    # Verifica se o arquivo existe
    if not os.path.exists(file_path):
        return {"error": f"Arquivo HTML principal não encontrado em: {file_path}"}
        
    return FileResponse(file_path)


# ENDPOINT: LOJAS DE REDE
@app.get("/api/lojas_rede/")
def get_lojas_rede(db: Session = Depends(get_db)):
    """
    Retorna todos os registros de lojas com Lat/Lon válidas para serem plotadas no mapa.
    """
    # Filtra apenas os registros que conseguiram ser geocodificados
    lojas = db.query(LojaRede).filter(
        LojaRede.latitude != None, 
        LojaRede.longitude != None
    ).all()

    # Mapeia para o formato JSON
    return [{
        "id": loja.id,
        "rede": loja.rede,
        "loja": loja.loja,
        "endereco": loja.endereco,
        "cnpj": loja.cnpj,
        "data_venda": loja.data_ultima_venda.isoformat() if loja.data_ultima_venda else None,
        "latitude": loja.latitude,
        "longitude": loja.longitude,
        "teve_venda": loja.teve_venda, 
        "funil_ultima_venda": loja.funil_ultima_venda 
    } for loja in lojas]
