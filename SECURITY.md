# Politique de sécurité

## Modèle de menace

Ce projet ne stocke rien côté serveur : pas de base de données, pas de compte,
pas d'analytics. Les clés API et les conversations restent dans le navigateur
de l'utilisateur (IndexedDB / localStorage). La surface d'attaque principale
est donc :

1. **XSS** — la seule vraie défense est la CSP stricte (`vercel.json`) et
   l'absence totale de script tiers/CDN. Aucune bibliothèque de "chiffrement"
   côté client n'est un substitut à cette défense.
2. **Le proxy OpenAI** (unique composant serveur) — stateless, sans log,
   sans stockage. Code dans `api/` (Edge Function Vercel), lisible en entier.
3. **Fuite d'information vers le dépôt privé AIDUSIA** — ce dépôt est
   volontairement isolé de tout code des autres produits AIDUSIA ; un scan
   anti-fuite tourne en CI sur chaque PR (voir `scripts/leak-scan.mjs`).

## Signaler une vulnérabilité

Merci de ne pas ouvrir d'issue publique pour une vulnérabilité de sécurité.
Contacter directement l'équipe AIDUSIA (coordonnées dans le profil GitHub de
l'organisation).
