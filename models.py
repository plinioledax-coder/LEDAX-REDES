# models.py
from sqlalchemy import Column, Integer, String, Float, Date, Boolean
from database import Base

# =============================================================
# TABELA: Mapeamento de Redes (LojaRede)
# =============================================================
class LojaRede(Base):
    __tablename__ = "lojas_rede"

    id = Column(Integer, primary_key=True, index=True)

    # Dados originais do CSV
    rede = Column(String)
    loja = Column(String)
    endereco = Column(String) 
    cnpj = Column(String)
    ultimo_pv = Column(String)
    data_ultima_venda = Column(Date)
    valor = Column(Float)
    funil_ultima_venda = Column(String)
    checklist_projeto = Column(String)

    # Coordenadas finais (obtidas via geocoding)
    endereco_usado_geocode = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    teve_venda = Column(Boolean, default=False, nullable=False)
    def __repr__(self):
        return f"<LojaRede(rede='{self.rede}', loja='{self.loja}', teve_venda={self.teve_venda})>"