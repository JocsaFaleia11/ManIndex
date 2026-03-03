import webview
import os
import sys
from google_auth_oauthlib.flow import InstalledAppFlow

def resource_path(relative_path):
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_path, relative_path)

# Escopos do Google
SCOPES = ['openid', 'https://www.googleapis.com', 'https://www.googleapis.com']

class Api:
    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    def login_google(self):
        """Esta função será chamada pelo seu botão no HTML"""
        try:
            caminho_json = resource_path('client_secrets.json')
            flow = InstalledAppFlow.from_client_secrets_file(caminho_json, scopes=SCOPES)
            
            # Abre o navegador externo e aguarda o token
            creds = flow.run_local_server(port=0)
            
            # Retorna os dados do usuário para o seu HTML/JavaScript
            user_data = {
                "token": creds.token,
                "id_token": creds.id_token
            }
            return user_data
        except Exception as e:
            return {"error": str(e)}

def iniciar_app():
    api = Api()
    window = webview.create_window(
        "Meu App Executável", 
        resource_path("index.html"),
        js_api=api, # Importante: conecta o JS com o Python
        width=1000,
        height=700
    )
    api.set_window(window)
    
    webview.start(
        http_server=True,
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    )

if __name__ == '__main__':
    iniciar_app()
