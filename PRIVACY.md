# Confidentialité

Les protections et limites des proxys de déploiement sont documentées dans [docs/deployment-security.md](./docs/deployment-security.md).

Dernière mise à jour : 21 juillet 2026.

Ce document décrit le comportement du code de ce dépôt. Un déploiement tiers
peut ajouter des journaux, cookies, proxies ou outils d’observabilité ; vérifiez
sa propre politique avant de l’utiliser.

## Résumé

AIDUSIA Studio ne requiert pas de compte et n’intègre pas d’analytics ou de
cookie publicitaire. Les conversations, réglages et clés sont principalement
stockés dans le navigateur. Des données quittent toutefois l’appareil lorsque
vous choisissez un fournisseur distant, un serveur MCP, la dictée du navigateur,
un modèle à télécharger ou une instance Ollama non locale.

## Données conservées sur l’appareil

- conversations et pièces jointes dans IndexedDB ;
- clés API dans `sessionStorage` par défaut ; une persistance optionnelle dans
  `localStorage` peut être activée par l’utilisateur, et les anciennes installations
  peuvent conserver leur préférence historique après migration ;
- préférence de persistance, langue, thème, URL Ollama et métadonnées MCP dans
  `localStorage` ;
- brouillons de messages non envoyés dans `localStorage` ; ils sont retirés
  après envoi, avec leur conversation, ou lors d’une remise à zéro ;
- en-têtes et jetons MCP uniquement dans `sessionStorage`, jusqu’à la fermeture
  complète de la session du navigateur ;
- modèles WebLLM, ressources PWA et autres fichiers dans les caches du navigateur.

Toute personne ou extension ayant accès au même profil de navigateur peut
potentiellement accéder à ces données. Désactivez la persistance des clés sur un
appareil partagé et effacez les données du site lorsque nécessaire.

## Transferts réseau

| Action | Destinataire |
|---|---|
| Anthropic, Gemini, Mistral, OpenRouter, Groq ou xAI | Fournisseur choisi, directement depuis le navigateur |
| OpenAI | Fonction Edge du déploiement, puis OpenAI |
| Ollama Cloud | Fonction Edge du déploiement, puis Ollama Cloud |
| Ollama | URL configurée ; elle peut être locale ou distante |
| Modèle navigateur | Infrastructure de téléchargement utilisée par WebLLM |
| Outil MCP | Serveur MCP configuré et éventuellement ses services reliés |
| Comparaison | Chacun des deux modèles sélectionnés reçoit séparément la question |
| Synthèse de comparaison | Le modèle choisi reçoit la question et le texte des deux réponses |
| Dictée | Implémentation Web Speech du navigateur/OS, potentiellement distante |
| OCR Tesseract | Aucun transfert prévu par le code ; traitement local |

Un message envoyé à un modèle peut comprendre l’historique nécessaire au
contexte. Une analyse vision transmet l’image au modèle concerné. Quand MCP est
activé, les noms, descriptions et schémas des outils configurés sont transmis au
modèle choisi. Un appel MCP transmet les arguments approuvés au serveur d’outils ;
son résultat est ensuite renvoyé au modèle afin qu’il poursuive la réponse. Un
serveur MCP distant doit utiliser HTTPS. HTTP n’est accepté que sur la boucle
locale (`localhost`, `127.0.0.0/8` ou `::1`) et sans jeton ni en-tête configuré.

Le mode comparaison n’envoie ni l’historique de conversation ni les outils MCP :
seule la question est traitée séparément par les deux modèles. Une synthèse est
un nouvel appel explicite qui transmet au modèle choisi la question et le texte
des deux réponses, considérés comme du contenu non fiable et délimité. Les
résultats restent en mémoire tant que la vue est ouverte ; ils ne rejoignent
IndexedDB que si l’utilisateur choisit « Continuer dans le chat ». L’export
Markdown crée uniquement un fichier local demandé par l’utilisateur.

Les images déclarées dans le Markdown d’une réponse ne sont jamais chargées
automatiquement : le Studio affiche un avertissement et, uniquement pour une
URL HTTP(S) valide, un lien externe à ouvrir volontairement. Ce clic direct
révèle alors au site cible les informations réseau habituelles d’une navigation.

Les politiques de rétention, d’entraînement, de localisation et de suppression
des fournisseurs et serveurs tiers s’appliquent indépendamment du Studio.

## Proxies OpenAI et Ollama Cloud

Les deux fonctions Edge reçoivent la clé et le contenu requis pour relayer la
requête. Le code du dépôt ne les écrit pas dans une base et ne contient pas de
journalisation volontaire de ces valeurs. Cela ne constitue pas une garantie
sur les journaux techniques de l’hébergeur, des intermédiaires réseau ou du
fournisseur. L’opérateur d’un déploiement est responsable de documenter sa
configuration réelle.

## Export et import

L’export des réglages peut contenir les clés API, l’URL Ollama et certaines
préférences. Il est chiffré dans le navigateur avec AES-GCM à partir d’une phrase
secrète. Le fichier reste sensible : choisissez une phrase longue et unique,
transmettez-la par un canal séparé et supprimez les copies inutiles. Le projet ne
peut pas récupérer une phrase oubliée.

## Contrôle et suppression

Depuis l’application, vous pouvez supprimer des conversations, des brouillons,
des clés, des connecteurs et des modèles téléchargés. La remise à zéro efface
IndexedDB, les stockages AIDUSIA, ainsi que le service worker et les caches du
shell appartenant au Studio ; elle préserve les caches et workers étrangers si
l’origine web est partagée. Les réglages du navigateur permettent aussi
d’effacer toutes les données de l’origine. La suppression locale n’efface pas
les données déjà transmises à un fournisseur ou serveur tiers ; utilisez alors
les mécanismes de ce tiers.

## Enfants et données sensibles

Le Studio n’est pas conçu comme un service destiné aux enfants et ne fournit pas
de mécanisme de consentement parental. N’envoyez pas de données médicales,
financières, professionnelles confidentielles ou d’identification à un service
qui n’est pas explicitement autorisé à les traiter.

## Questions

Pour une question de confidentialité, utilisez le contact publié dans
[MENTIONS-LEGALES.md](./MENTIONS-LEGALES.md). Pour une vulnérabilité, suivez
exclusivement la procédure privée de [SECURITY.md](./SECURITY.md).
