# Sources API sportives

Vérifié le 15 novembre 2026 pour conserver le comportement de secours sans inventer de données.

La documentation officielle TheSportsDB indique que la clé actuelle gratuite de l’API V1 est `123`, que la clé apparaît dans l’URL, que le service applique des limites par niveau et que les livescores font partie des fonctionnalités Premium. La page du forfait gratuit décrit l’API comme donnant accès aux données sportives et aux illustrations, avec des fonctionnalités étendues dans Premium. Les exemples officiels V1 utilisent la clé `123` et montrent les logos fournis dans la réponse JSON. Le code source fourni utilisait `3`; les appels testés depuis l’environnement du projet recevaient HTTP 403 avec `3`, tandis que les routes testées répondaient HTTP 200 avec `123`. Le test du livescore sous clé gratuite ne contenait aucun événement au moment de la vérification; cette observation ponctuelle ne garantit pas la disponibilité à d’autres horaires.

API-Football utilise une clé privée séparée. Pour la version Web, cette clé est injectée au serveur sous `API_FOOTBALL_KEY`; les requêtes correspondantes passent par une liste d’endpoints serveur autorisés. Elle ne doit pas être intégrée au JavaScript public. Les logos de matchs restent ceux des champs fournis par l’API, sans image ou drapeau de secours.

Références :

- [Guide officiel TheSportsDB — clés, limites et V1](https://www.thesportsdb.com/docs_api_guide)
- [API sportive gratuite TheSportsDB](https://www.thesportsdb.com/free_sports_api)
- [Exemples officiels d’API TheSportsDB](https://www.thesportsdb.com/docs_api_examples)


Vérification API-Football à travers le proxy et directement depuis le serveur, le 15 novembre 2026 : HTTP 200, mais `errors.token` signale `Error/Missing application key` et aucune ligue/fixture n’est renvoyée. La valeur du secret n’a pas été affichée. L’utilisateur a demandé de la conserver telle quelle; elle n’a pas été remplacée. La livraison utilise donc uniquement les résultats réellement fournis par le repli TheSportsDB tant que le flux API-Football n’est pas corrigé.
