# Sécurité du déploiement

## Proxys Edge

Les proxys OpenAI et Ollama Cloud :

- limitent les routes et méthodes ;
- contrôlent la taille des requêtes ;
- limitent la taille des réponses ;
- imposent des délais par route ;
- refusent certains contextes cross-site ;
- ne mettent pas les réponses en cache ;
- n’enregistrent volontairement ni les clés ni les prompts dans le code du dépôt.

## Limite importante

Les contrôles `Origin` et `Sec-Fetch-Site` réduisent certains abus provenant d’un navigateur tiers, mais ne constituent pas une authentification.

Un client serveur peut fabriquer ces headers.

Les fonctions Edge restent publiquement adressables.

## Rate limiting

Un rate limiting réellement distribué nécessite une protection au niveau de la plateforme ou un stockage partagé.

Pour une publication publique, activer selon l’hébergement :

- Vercel Firewall ;
- règles de rate limiting ;
- limites de concurrence ;
- surveillance des volumes et erreurs ;
- alertes de dépenses ou quotas.

Ne pas présenter un compteur en mémoire dans une fonction Edge comme une protection fiable : les instances sont distribuées et éphémères.

## Headers et compatibilité

La CSP conserve `connect-src 'self' https: http:` parce que les adresses Ollama et MCP sont configurables. Cette compatibilité élargit les destinations réseau autorisées ; le consentement utilisateur, la validation des URLs et les politiques de transport restent donc nécessaires.

`Cross-Origin-Embedder-Policy: require-corp` n’est pas activé sans preuve de compatibilité complète avec WebLLM, OCR, les polices et les téléchargements de modèles.

## Confidentialité

Ne jamais journaliser :

- clés API ;
- headers Authorization ;
- prompts ;
- images ;
- réponses complètes ;
- arguments ou résultats MCP sensibles.

Un identifiant de requête aléatoire peut être exposé pour faciliter le diagnostic sans contenir de donnée utilisateur.
