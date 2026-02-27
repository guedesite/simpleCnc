# Architecture Technique : Mini-SaaS de Gravure CNC (100% Front-end)

Ce document récapitule les technologies, algorithmes et processus nécessaires pour créer une application web de FAO (Fabrication Assistée par Ordinateur) simplifiée, fonctionnant entièrement dans le navigateur de l'utilisateur.

*Note : Pour une CNC standard, le format de sortie visé est le **G-code** (`.nc` ou `.gcode`), et non le format Gerber (réservé aux circuits imprimés).*

---

## 1. La Stack Technique (100% Front-end)

L'objectif est de faire tourner l'application de manière fluide sans serveur (Serverless/Client-side only) en utilisant les capacités modernes de Typescript et WebAssembly.

| Composant | Technologie recommandée | Rôle |
| :--- | :--- | :--- |
| **Framework UI** | **Svelte**, React ou Vue.js | Gérer l'interface, les formulaires d'outils et l'état de l'application (Svelte est particulièrement performant et léger pour ça). |
| **Moteur 3D** | **Three.js** | Afficher l'objet (STL/SVG), le plateau de la CNC, et tracer visuellement le chemin de l'outil en 3D. |
| **Opérations Booléennes (2D)** | **Clipper.js** (ou Javascript Clipper) | Crucial pour le SVG : permet de décaler les tracés (offset) pour prendre en compte le rayon de la fraise. |
| **Multithreading** | **Web Workers** | Exécuter les calculs de trajectoire en arrière-plan pour ne pas figer l'interface web (freeze) pendant le calcul. |
| **Génération de fichier** | API `Blob` + `FileSaver.js` | Permet de créer le fichier G-code virtuellement dans le navigateur et de déclencher le téléchargement localement. |

---

## 2. Algorithmes et Traitement par type de fichier

### A. Le flux de travail SVG (Gravure 2D / V-Carving)
Le SVG étant en 2D, l'objectif est de calculer des tracés plats et de définir une profondeur Z de plongée fixe ou variable (V-Carve).

1. **Parsing :** Utiliser les API natives du navigateur (`DOMParser`) pour extraire les balises géométriques (`<path>`, `<circle>`, `<rect>`).
2. **Discrétisation :** Transformer les courbes de Bézier du SVG en une suite de petits segments de droites (polylignes). La CNC comprend principalement des lignes droites (G1) et des arcs simples (G2/G3).
3. **Compensation d'outil (Offsetting) :** Utilisation de **Clipper.js**. Si la fraise fait 2mm de diamètre, l'outil ne doit pas couper sur le trait géométrique, mais à 1mm (le rayon) à l'intérieur ou à l'extérieur du tracé.
4. **Optimisation du trajet (Path Optimization) :** Pour minimiser les déplacements à vide de la machine. Une approche algorithmique gloutonne (Greedy algorithm du Voyageur de Commerce : *aller toujours au point de départ le plus proche du point de fin actuel*) est rapide et suffisante.

### B. Le flux de travail STL (Gravure en relief 3D)
Le STL est un maillage complexe. Au lieu de calculs de collision 3D lourds, on utilise la méthode d'échantillonnage de la carte des hauteurs (Z-Map).

1. **Chargement & Manipulation :** **Three.js** charge le fichier via `STLLoader`. L'utilisateur positionne, oriente et redimensionne l'objet avec des outils visuels (`TransformControls`).
2. **Algorithme "Drop Cutter" (Z-Map) :**
   * Génération d'une grille (matrice) virtuelle au-dessus du modèle 3D en fonction de la précision souhaitée.
   * Utilisation d'un **Raycaster** (lancer de rayon) avec Three.js : pour chaque point de la grille, on "fait tomber" l'outil virtuel (axe Z positif vers négatif).
   * Le point d'impact avec le maillage STL (en prenant en compte la forme de l'outil : plat, sphérique, en V) donne la hauteur Z maximale autorisée.
3. **Génération du chemin (Rastering) :** La trajectoire est générée par un balayage en zigzag (aller-retour sur l'axe X ou Y), la hauteur Z s'ajustant selon la matrice calculée précédemment.

---

## 3. La Configuration (Le setup utilisateur)

L'interface doit rester épurée. Les paramètres essentiels seront regroupés dans un panneau latéral :

* **Outil (Tool) :**
  * Type/Forme : Fraise droite (Flat end), Hémisphérique (Ball nose), Pointe à graver (V-Bit).
  * Diamètre (`D`).
  * Angle (spécifique aux pointes à graver).
* **Coupe (Feeds & Speeds) :**
  * Vitesse d'avance de coupe (Feedrate - `F` en mm/min).
  * Vitesse de plongée (Plunge rate).
  * Vitesse de rotation de la broche (Spindle speed - `S` en RPM).
* **Matériau / Positionnement :**
  * Position X, Y (Définition de l'origine de la pièce, ex: coin inférieur gauche).
  * Épaisseur du brut (Stock thickness).

---

## 4. Génération du G-code (Export)

Une fois les trajectoires générées sous forme de coordonnées X, Y, Z, la conversion en G-code se fait par simple concaténation de chaînes de caractères en Javascript :

* `G90` (Mode de positionnement absolu)
* `G21` (Unités en millimètres)
* `S[vitesse] M3` (Allumage de la broche et rotation horaire)
* `G0 X[x] Y[y] Z[z_securité]` (Déplacement rapide au-dessus du premier point de coupe)
* `G1 Z[z_profondeur] F[vitesse_plongée]` (Plongée dans la matière)
* `G1 X[x] Y[y] Z[z] F[vitesse_coupe]` (Interpolation linéaire de coupe)
* `G0 Z[z_securité]` (Dégagement de l'outil en Z de sécurité)
* `M5` (Arrêt de la broche)

Batterie énorme de test unitaire pour validé chaque fonctionnalité une par une