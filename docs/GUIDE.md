# Cartographie des décès — version SSP Cloud sans données embarquées

Cette archive reprend la migration du Shiny modifié, avec les filtres, les symboles d’armée, les infobulles, l’animation, le plein écran et le bouton d’affichage des effectifs. **Aucun catalogue ni lot de données n’est embarqué.** Le site lit ses données dans votre bucket SSP Cloud.

## Adresse déjà configurée

Le lien fourni ouvre l’explorateur :
https://datalab.sspcloud.fr/s3/vloonis/bundles/?profile=anonymous

L’application utilise les adresses directes des objets, et non la page de l’explorateur :

- Catalogue : `https://minio.lab.sspcloud.fr/vloonis/bundles/catalog.json`
- Lots : `https://minio.lab.sspcloud.fr/vloonis/bundles/NOM-DU-LOT.json`

Dans `assets/config.js`, la configuration est :

```js
dataBaseUrl: 'https://minio.lab.sspcloud.fr/vloonis/',
catalogUrl: 'https://minio.lab.sspcloud.fr/vloonis/bundles/catalog.json',
```

La racine du bucket dans `dataBaseUrl` est volontaire : le catalogue produit par le préparateur contient déjà des chemins `bundles/...json`. Il ne faut pas ajouter une seconde fois `bundles/` à cette adresse. `catalogUrl` place le catalogue à côté de vos lots.

## À faire dans votre bucket avant d’utiliser la carte

Lors de la vérification du 5 octobre 2026, les lots JSON du dossier étaient lisibles anonymement. Un lot a été téléchargé et son format est compatible : `version`, `strings`, `series`. Le serveur a renvoyé l’en-tête CORS attendu pour l’origine `https://vloonis.github.io`.

**En revanche, `bundles/catalog.json` renvoyait HTTP 404.** Il faut donc déposer dans ce dossier **le catalogue issu de la même préparation que les lots déjà déposés**. Le catalogue contient les choix des menus, les identifiants des séries et les noms des lots. N’utilisez pas le catalogue de l’échantillon si les lots correspondent aux données complètes.

Si vous avez déjà préparé vos données, prenez simplement le `catalog.json` situé à la racine du dossier de sortie et téléversez-le ici :

```text
Bucket vloonis
└── bundles/
    ├── catalog.json
    ├── 00a3178e0bdcfdbeac48.json
    ├── ... autres lots JSON ...
```

Les noms sont ceux de votre préparation ; l’exemple ci-dessus montre un lot déjà observé dans votre répertoire. Ne renommez pas les lots : le catalogue les référence par leur nom.

Le fichier doit être lisible sans connexion, comme les lots. Ouvrez l’adresse directe du catalogue dans un navigateur : elle doit afficher ou télécharger du JSON. Une page de connexion ou un message XML `AccessDenied` / `NoSuchKey` ne convient pas. Le lien de l’explorateur avec `profile=anonymous` ne remplace pas les droits de lecture des objets.

## Publier maintenant sur GitHub Pages

Le site est déjà construit dans `docs/`.

1. Décompressez l’archive.
2. Dans votre dépôt GitHub, remplacez le dossier `docs/` par celui de cette archive.
3. Supprimez l’ancien `docs/data/` du dépôt s’il y est encore : l’envoi de nouveaux fichiers via le navigateur ne supprime pas les anciens. GitHub Desktop permet de publier les ajouts, changements et suppressions ensemble.
4. Dans **Settings → Pages**, utilisez **Deploy from a branch → main → /docs**.

Cette nouvelle version n’a pas besoin de `docs/data/`. Ne supprimez pas vos données du bucket. Les configurations source et publiée sont toutes deux déjà renseignées.

Pour conserver et publier aussi les sources Quarto, envoyez le contenu complet du dossier du projet dans le dépôt, avec `.github/`, puis choisissez **GitHub Actions** dans Settings → Pages. Le workflow vérifie les adresses, le préparateur et les règles JavaScript, puis génère et publie le site. Il ne dépend plus de données locales. Une vérification du workflow réussie ne garantit pas à elle seule la présence ou les permissions du catalogue distant.

## Préparer les prochains jeux de données

Python 3.10+ est requis, sans autre dépendance pour la préparation. Depuis la racine du projet :

```bash
python scripts/prepare_data.py chemin/Ensemble.csv --output ../export-bucket
python tests/check_data.py ../export-bucket
```

Depuis R / RStudio :

```r
source("scripts/prepare_data.R")
prepare_ensemble("chemin/Ensemble.csv", output = "../export-bucket")
```

Le fichier R est un lanceur du même préparateur Python. La structure du CSV est inchangée. La préparation conserve une ligne valide par point, sans agrégation cartographique supplémentaire ; elle prépare les dates, les groupes d’armée et les informations d’infobulle. Les exclusions éventuelles figurent dans `quality-report.json`.

Le résultat local est organisé ainsi : `export-bucket/catalog.json`, `export-bucket/quality-report.json` et `export-bucket/bundles/*.json`.

**Pour votre organisation SSP Cloud actuelle :**

1. Téléversez les fichiers contenus dans `export-bucket/bundles/` dans le dossier SSP Cloud `vloonis/bundles/`.
2. Téléversez ensuite `export-bucket/catalog.json` dans ce même dossier SSP Cloud `vloonis/bundles/`.
3. Conservez les noms de fichiers et téléversez le catalogue en dernier, après tous les nouveaux lots.

Ne créez pas un sous-dossier supplémentaire `vloonis/bundles/bundles/`. `quality-report.json` est utile pour vous, mais le site n’en a pas besoin. Vous n’avez pas à régénérer ni à republier le site lorsque seules les données changent et que les adresses restent identiques. Rechargez la page pour lire le nouveau catalogue.

## Modifier le rendu et reconstruire le site

- `assets/styles.css` : couleurs, polices, dimensions et disposition.
- `_includes/app.html` : titres, boutons et panneaux.
- `assets/core.js` : tailles, SVG, infobulles et choix des points annotés.
- `assets/app.js` : filtres, animation, carte et lecture du bucket.
- `assets/config.js` : adresses de données et fond de carte.

Avec Quarto installé :

```bash
quarto render
```

Sans Quarto :

```bash
python scripts/build_static.py
```

Le constructeur autonome copie uniquement les ressources de l’application et retire les anciens fichiers de données du dossier de publication. Le projet Quarto n’inclut plus `data/**` dans ses ressources. Les dossiers de données locales sont également exclus par `.gitignore`.

Pour un aperçu local :

```bash
python -m http.server 8000 --directory docs
```

Ouvrez `http://localhost:8000/` ; la carte chargera toujours les données du bucket. Évitez l’ouverture de `index.html` par double clic.

## Fonctionnement et vérifications

Le catalogue est téléchargé au démarrage. Le navigateur charge ensuite uniquement les lots nécessaires, avec un cache estimé à 32 Mio et un accès direct aux lignes par date pour l’animation. Les symboles et les étiquettes sont dessinés sur Canvas. Les infobulles sont construites au clic. Les filtres, le cas particulier des régiments, l’année 9999 « Toutes les années » et les tailles communes à chaque série sont conservés.

Vérifications locales, indépendantes des données du bucket :

```bash
node tests/core.test.cjs
node tests/config.test.cjs
python tests/test_prepare.py
```

Les tests d’interaction DOM nécessitent les données de l’échantillon de référence, qui ne sont volontairement pas dans cette archive. Ils peuvent être exécutés avec Node.js et `npm install`, en désignant ce dossier par `MAP_TEST_DATA_DIR`, puis `npm run test:ui`. L’intégrité d’un autre jeu préparé peut être contrôlée avec `python tests/check_data.py CHEMIN-DOSSIER`.

Le rendu Quarto et les tests des interactions ont été vérifiés avec un DOM simulé et Leaflet réel ; Canvas et images sont simulés. La vérification visuelle dans un navigateur reste à faire. La lecture complète du bucket reste conditionnée au dépôt du catalogue correspondant aux lots. Aucun fichier du bucket n’a été modifié par cette livraison.

Leaflet 1.9.4 et sa licence sont inclus dans `assets/vendor/leaflet/`. Le code R fourni est conservé dans `reference/app-shiny-modifiee.R`.


## Modifications de la carte et commentaires privés

Le titre précise désormais l’armée française et la période 1914–1918. Les effectifs sont accessibles en plein écran et les deux boutons restent synchronisés. La source apparaît dans la carte, au-dessus de l’attribution OpenStreetMap, y compris en plein écran. La lecture continue utilise un bouton bleu avec un libellé explicite.

Le formulaire « Une remarque ou une correction ? » est replié par défaut. Le message est obligatoire ; le nom et l’adresse e-mail sont facultatifs. Aucune réponse ni coordonnée n’est enregistrée dans le navigateur ou dans le dépôt.

### Activer la réception

Dans `assets/config.js`, renseigner `feedbackEndpoint` avec l’URL HTTPS de votre service de réception privé. Celui-ci doit accepter les champs POST `message`, `name` et `email`, fournir une confirmation après envoi, et réserver la consultation/export des réponses à votre compte administrateur. N’y mettre aucune clé secrète. Configurer côté service les destinataires, la protection antispam et la conservation des réponses ; vérifier avec un message d’essai et en navigation déconnectée qu’aucune liste publique n’existe. Le code client ne peut pas garantir les permissions du service choisi.

Tant que cette URL n’est pas renseignée, les champs et l’envoi sont désactivés avec une explication visible. Le site statique seul ne permet pas la collecte privée. L’envoi utilise un POST natif sans placer le message ou les coordonnées dans l’URL.

Après modification de la configuration : `python3 scripts/build_static.py` (ou le rendu Quarto habituel), puis publier le dossier `docs/`.


## Mise à jour du 8 octobre 2026

Voir `MODIFICATIONS.md` pour les améliorations, la portée du total et les vérifications. Le formulaire comprend aussi les champs POST `organization` et `cases`.
