import sys
import os
from PyQt6.QtWidgets import QApplication, QMainWindow
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEngineSettings
from PyQt6.QtCore import QUrl

class AppModerno(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ManIndex")
        self.resize(1200, 800)

        # Criar o componente de navegação
        self.browser = QWebEngineView()
        
        # Configurações para Web Moderna
        settings = self.browser.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)

        # Caminho absoluto para o seu index.html
        diretorio = os.path.dirname(os.path.abspath(__file__))
        caminho_html = os.path.join(diretorio, "index.html")
        
        # Carrega o arquivo local
        self.browser.setUrl(QUrl.fromLocalFile(caminho_html))
        self.setCentralWidget(self.browser)

if __name__ == "__main__":
    # Necessário para algumas renderizações modernas em GPUs específicas
    os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--disable-web-security" 
    
    app = QApplication(sys.argv)
    janela = AppModerno()
    janela.show()
    sys.exit(app.exec())
