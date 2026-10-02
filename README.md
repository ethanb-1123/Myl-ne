# Bonjour Mylène

Petite app interne : on dépose un MP3, elle renvoie le texte transcrit, à copier.
Transcription via l'API Groq (Whisper).

## Lancer
1. Installer Node.js 20.6 ou plus récent
2. Vérifier que `.env` contient la clé (`GROQ_API_KEY`)
3. `npm start`, puis ouvrir http://localhost:3000

La clé reste côté serveur (jamais envoyée au navigateur).
Ne partage pas le fichier `.env`.
