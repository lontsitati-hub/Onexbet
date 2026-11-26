# Sources du catalogue football

Recherche effectuée le 24 novembre 2026.

- [Wikidata Query Service](https://query.wikidata.org/sparql) : l’extraction a interrogé les équipes de football associatif avec le champ de compétition `P118` et le pays `P17`. Après correspondance exacte des noms normalisés et du pays, le fichier local retient uniquement une compétition Wikidata distincte par logo. Les associations ambiguës et les logos rangés sous `Tournaments` sont exclues. Cette propriété et cette extraction ne garantissent pas à elles seules que chaque association soit encore à jour.
- [Documentation API-Football v3](https://www.api-football.com/documentation-v3) : la source fournit des endpoints séparés pour les pays, ligues, équipes et rencontres et requiert un en-tête `x-apisports-key`.
- [Offre API-Football](https://www.api-football.com/) : le site indique plus de 1 200 compétitions couvertes et une limite de 100 requêtes par jour pour l’offre gratuite. Aucune clé n’était configurée dans l’environnement de travail; cette API n’a donc pas servi à produire le catalogue local.
- [Dépôt OpenFootball Leagues](https://github.com/openfootball/leagues) : le dépôt décrit des données publiques pour les compétitions internationales et nationales et dédie son schéma/données au domaine public. Il fournit un répertoire de compétitions, mais pas le roster courant complet requis pour relier les milliers de logos du projet.
- [FootballClubsMap](https://footballclubsmap.com/) : la page annonce une carte compilée depuis Wikidata et Wikimedia Commons et précise que les droits sur sa base de données sont réservés; cette base n’a pas été réutilisée.

Le catalogue produit à partir de Wikidata comprend 1 128 liens club-compétition retenus sur 4 678 logos de clubs; 87 autres entrées de l’index sont des logos de tournois et ne sont pas traitées comme des équipes. Les chiffres décrivent le rapprochement local, pas la couverture totale de Wikidata.
